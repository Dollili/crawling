import { createClient } from 'jsr:@supabase/supabase-js@2'

const PROMPT = `
[SYSTEM: STRICT FACT-CHECK MODE]
당신은 오직 제공된 기사 URL의 실제 본문 텍스트만을 바탕으로 요약하는 시스템입니다.
[CRITICAL RULES]
1. 추측, 과장, 일반화, 외부 지식 보충을 금지합니다.
2. 기사 제목과 링크에 해당하는 실제 기사 내용을 기준으로만 요약합니다.
3. 본문에 없는 수치, 기간, 인물, 기관명은 추가하지 않습니다.
4. 결과는 반드시 <ul>, <li> 중심의 짧은 HTML로 작성합니다.
5. 서론, 결론, 코드블록 없이 요약 결과만 반환합니다.
`

const DEFAULT_ALLOWED_ORIGINS = ['http://localhost:5173', 'https://localhost:5173']

function getAllowedOrigins() {
  const configured = Deno.env.get('ALLOWED_ORIGINS')
  if (!configured) {
    return DEFAULT_ALLOWED_ORIGINS
  }

  return configured
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
}

function createCorsHeaders(req: Request) {
  const requestOrigin = req.headers.get('origin') ?? ''
  const allowedOrigins = getAllowedOrigins()
  const allowOrigin = requestOrigin && allowedOrigins.includes(requestOrigin)
    ? requestOrigin
    : allowedOrigins[0]

  return {
    'Content-Type': 'text/event-stream; charset=UTF-8',
    'Cache-Control': 'no-cache',
    'X-Accel-Buffering': 'no',
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Vary': 'Origin',
  }
}

function isAllowedOrigin(req: Request) {
  const requestOrigin = req.headers.get('origin')
  if (!requestOrigin) {
    return false
  }

  return getAllowedOrigins().includes(requestOrigin)
}

Deno.serve(async (req) => {
  const corsHeaders = createCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (!isAllowedOrigin(req)) {
    return new Response('허용되지 않은 출처입니다.', { status: 403, headers: corsHeaders })
  }

  try {
    if (req.method !== 'GET') {
      return new Response('허용되지 않은 메서드입니다.', { status: 405, headers: corsHeaders })
    }

    const requestUrl = new URL(req.url)
    const pathParts = requestUrl.pathname.split('/')
    const newsId = Number.parseInt(pathParts[pathParts.length - 1] ?? '', 10)
    const articleUrl = requestUrl.searchParams.get('url') ?? ''

    if (
      Number.isNaN(newsId) ||
      newsId <= 0 ||
      !articleUrl ||
      articleUrl.length > 500 ||
      (!articleUrl.startsWith('http://') && !articleUrl.startsWith('https://'))
    ) {
      return new Response('잘못된 요청입니다.', { status: 400, headers: corsHeaders })
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

    const { data: newsRow, error: newsError } = await supabase
      .from('news')
      .select('id, title, url')
      .eq('id', newsId)
      .maybeSingle()

    if (newsError) {
      console.error('[news lookup error]', newsError.message)
      return new Response('잘못된 요청입니다.', { status: 400, headers: corsHeaders })
    }

    if (!newsRow || newsRow.url !== articleUrl) {
      return new Response('잘못된 요청입니다.', { status: 400, headers: corsHeaders })
    }

    const { data: cached } = await supabase
      .from('summary')
      .select('summary')
      .eq('news_id', newsId)
      .maybeSingle()

    if (cached?.summary) {
      const payload =
        `data: ${cached.summary.replace(/\n/g, '\\n')}\n\n` +
        'data: [DONE]\n\n'

      return new Response(encoder.encode(payload), { headers: corsHeaders })
    }

    const geminiKey = Deno.env.get('GEMINI_API_KEY')!
    const finalPrompt = `${PROMPT}\n기사 제목: ${newsRow.title}\n링크: ${newsRow.url}\n`

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:streamGenerateContent?alt=sse&key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
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
      console.error('[gemini error]', geminiRes.status, errText)
      return new Response('data: [ERROR]\n\n', { headers: corsHeaders })
    }

    const { readable, writable } = new TransformStream()
    const writer = writable.getWriter()

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
          const events = buffer.split(/\r?\n\r?\n/)
          buffer = events.pop() ?? ''

          for (const event of events) {
            const lines = event.split('\n')
            const dataLines = lines
              .filter((line) => line.startsWith('data:'))
              .map((line) => line.slice(5).trim())

            const jsonStr = dataLines.join('\n')
            if (!jsonStr || jsonStr === '[DONE]') continue

            try {
              const parsed = JSON.parse(jsonStr)
              const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

              if (text) {
                fullText += text
                await writer.write(encoder.encode(`data: ${text.replace(/\n/g, '\\n')}\n\n`))
              }
            } catch (error) {
              console.error('[json parse error]', error)
            }
          }
        }

        if (fullText) {
          await supabase.from('summary').insert({ news_id: newsId, summary: fullText })
        }

        await writer.write(encoder.encode('data: [DONE]\n\n'))
      } catch (error) {
        console.error('[pipe error]', error)
        await writer.write(encoder.encode('data: [ERROR]\n\n'))
      } finally {
        await writer.close()
      }
    }

    pipe()

    return new Response(readable, { headers: corsHeaders })
  } catch (error) {
    console.error('[summarize fatal]', error)
    return new Response('Internal Server Error', { status: 500, headers: corsHeaders })
  }
})
