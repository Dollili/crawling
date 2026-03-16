import { createClient } from 'jsr:@supabase/supabase-js@2'

const PROMPT = `
[SYSTEM: STRICT FACT-CHECK MODE]
당신은 오직 제공된 URL의 실시간 본문 텍스트만을 추출하여 요약하는 로봇입니다.
[CRITICAL RULES]
1. 당신이 과거에 학습한 모든 사전 지식을 망각하십시오.
2. 아래 링크와 해당하는 제목의 기사를 방문하여 현재 화면에 출력된 텍스트 데이터만 사용하십시오.
3. 만약 본문에 기준, 기간, 구체적 수치 등이 명시되어 있지 않다면, 절대 임의로 지어내지 마십시오.
4. 본문에 없는 내용을 단 하나라도 포함할 경우, 이는 데이터 오염으로 간주되어 실패 처리됩니다.
5. 오직 <ul>, <li> 태그를 사용한 5줄 요약 HTML 결과만 출력하십시오. (No intro, No outro)
`

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  'X-Accel-Buffering': 'no',
  'Access-Control-Allow-Origin': '*',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    })
  }

  try {
    const url = new URL(req.url)
    const pathParts = url.pathname.split('/')
    const newsId = parseInt(pathParts[pathParts.length - 1])
    const articleUrl = url.searchParams.get('url') ?? ''
    const title = url.searchParams.get('title') ?? ''

    if (isNaN(newsId) || !articleUrl) {
      return new Response('Missing parameters', { status: 400 })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      {
        db: { schema: 'newsproject' },
        global: {
          headers: { 'Accept-Profile': 'newsproject', 'Content-Profile': 'newsproject' },
        },
      },
    )

    // DB 캐시 조회를 스트림 밖에서 먼저 처리
    const { data: cached } = await supabase
      .from('summary')
      .select('summary')
      .eq('news_id', newsId)
      .maybeSingle()

    const encoder = new TextEncoder()

    // 캐시가 있으면 즉시 반환 (스트리밍 불필요)
    if (cached?.summary) {
      const payload =
        `data: ${cached.summary.replace(/\n/g, '\\n')}\n\n` +
        `data: [DONE]\n\n`
      return new Response(encoder.encode(payload), { headers: SSE_HEADERS })
    }

    // 캐시 없음 → Gemini 스트리밍
    const geminiKey = Deno.env.get('GEMINI_API_KEY')!
    const finalPrompt = PROMPT + `\n기사 제목: ${title}\n링크: ${articleUrl}\n`

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:streamGenerateContent?alt=sse&key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: finalPrompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 2048,
            topK: 40,
            topP: 0.8,
          },
        }),
      },
    )

    if (!geminiRes.ok || !geminiRes.body) {
      const errText = await geminiRes.text()
      console.error('Gemini error:', geminiRes.status, errText)
      return new Response('data: [ERROR]\n\n', { headers: SSE_HEADERS })
    }

    // Gemini 스트림을 프론트로 그대로 중계
    const stream = new ReadableStream({
      async start(controller) {
        const reader = geminiRes.body!.getReader()
        const decoder = new TextDecoder()
        let fullText = ''
        let buffer = ''

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const events = buffer.split('\n\n')
            buffer = events.pop() ?? ''

            for (const event of events) {
              const lines = event.split('\n')
              const dataLines = lines
                .filter(line => line.startsWith('data:'))
                .map(line => line.slice(5).trim())

              const jsonStr = dataLines.join('\n')
              if (!jsonStr || jsonStr === '[DONE]') continue

              try {
                const parsed = JSON.parse(jsonStr)
                const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
                if (text) {
                  fullText += text
                  // 줄바꿈 이스케이프 후 단일 data: 라인으로 전송
                  controller.enqueue(
                    encoder.encode(`data: ${text.replace(/\n/g, '\\n')}\n\n`)
                  )
                }
              } catch (e) {
                console.error('JSON parse error:', e)
              }
            }
          }

          // 스트리밍 완료 후 DB 저장
          if (fullText) {
            await supabase.from('summary').insert({ news_id: newsId, summary: fullText })
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        } catch (e) {
          console.error('[stream error]', e)
          controller.enqueue(encoder.encode('data: [ERROR]\n\n'))
          controller.close()
        }
      },
    })

    return new Response(stream, { headers: SSE_HEADERS })

  } catch (e) {
    console.error('[summarize fatal]', e)
    return new Response('Internal Server Error', { status: 500 })
  }
})
