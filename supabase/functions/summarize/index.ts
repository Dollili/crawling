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

    // isNaN으로 명확하게 체크 (0 오탐 방지)
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

    const { data: cached } = await supabase
      .from('summary')
      .select('summary')
      .eq('news_id', newsId)
      .maybeSingle()

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        const send = (data: string) => {
          controller.enqueue(encoder.encode(`data: ${data}\n\n`))
        }

        try {
          if (cached?.summary) {
            send(cached.summary)
            send('[DONE]')
            controller.close()
            return
          }

          const geminiKey = Deno.env.get('GEMINI_API_KEY')!
          const finalPrompt = PROMPT + `\n기사 제목: ${title}\n링크: ${articleUrl}\n`

          const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key=${geminiKey}`,
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
            send('[ERROR]')
            controller.close()
            return
          }

          const reader = geminiRes.body.getReader()
          const decoder = new TextDecoder()
          let fullText = ''

          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const chunk = decoder.decode(value, { stream: true })
            const lines = chunk.split('\n')

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue
              const jsonStr = line.slice(6).trim()
              if (!jsonStr || jsonStr === '[DONE]') continue

              try {
                const parsed = JSON.parse(jsonStr)
                const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
                if (text) {
                  fullText += text
                  send(text)
                }
              } catch {
                // JSON 파싱 실패 시 무시
              }
            }
          }

          if (fullText) {
            await supabase.from('summary').insert({
              news_id: newsId,
              summary: fullText,
            })
          }

          send('[DONE]')
          controller.close()
        } catch (e) {
          console.error('[summarize error]', e)
          send('[ERROR]')
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (e) {
    console.error('[summarize fatal]', e)
    return new Response('Internal Server Error', { status: 500 })
  }
})
