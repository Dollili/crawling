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

    const encoder = new TextEncoder()

    // 1. DB 캐시 조회
    const { data: cached } = await supabase
      .from('summary')
      .select('summary')
      .eq('news_id', newsId)
      .maybeSingle()


    if (cached?.summary) {
      const payload =
        `data: ${cached.summary.replace(/\n/g, '\\n')}\n\n` +
        `data: [DONE]\n\n`
      return new Response(encoder.encode(payload), { headers: SSE_HEADERS })
    }

    // 2. Gemini API 호출
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
            maxOutputTokens: 8192,
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

    // 3. Gemini 응답이 확보된 상태에서 TransformStream으로 중계
    //    → Response 반환 시점에 이미 스트림 데이터가 흐르기 시작하므로 EarlyDrop 없음
    const { readable, writable } = new TransformStream()
    const writer = writable.getWriter()

    // 백그라운드에서 Gemini → 프론트 중계 (Response 반환과 동시에 실행)
    const pipe = async () => {
      const reader = geminiRes.body!.getReader()
      const decoder = new TextDecoder()
      let fullText = ''
      let buffer = ''

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          // Gemini SSE는 \r\n\r\n 또는 \n\n 으로 이벤트 구분
          const events = buffer.split(/\r?\n\r?\n/)
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
                await writer.write(
                  encoder.encode(`data: ${text.replace(/\n/g, '\\n')}\n\n`)
                )
              }
            } catch (e) {
              console.error('JSON parse error:', e)
            }
          }
        }

        if (fullText) {
          await supabase.from('summary').insert({ news_id: newsId, summary: fullText })
        }

        await writer.write(encoder.encode('data: [DONE]\n\n'))
      } catch (e) {
        console.error('[pipe error]', e)
        await writer.write(encoder.encode('data: [ERROR]\n\n'))
      } finally {
        await writer.close()
      }
    }

    // pipe()를 await 하지 않고 백그라운드 실행 → Response를 즉시 반환
    pipe()

    return new Response(readable, { headers: SSE_HEADERS })

  } catch (e) {
    console.error('[summarize fatal]', e)
    return new Response('Internal Server Error', { status: 500 })
  }
})
