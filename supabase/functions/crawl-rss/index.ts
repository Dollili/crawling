import { createClient } from 'jsr:@supabase/supabase-js@2'

const RSS_URL =
  'https://news.google.com/rss/search?q=%EC%9D%80%ED%96%89+when:7d&hl=ko&gl=KR&ceid=KR:ko'

Deno.serve(async () => {
  try {
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

    const res = await fetch(RSS_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
    const xmlText = await res.text()

    const parser = new DOMParser()
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml')
    const items = xmlDoc.querySelectorAll('item')

    const limit = Math.min(items.length, 30)
    let insertCount = 0

    for (let i = 0; i < limit; i++) {
      const item = items[i]
      const title = item.querySelector('title')?.textContent?.trim() ?? ''
      const url = item.querySelector('link')?.textContent?.trim() ?? ''
      const pubDate = item.querySelector('pubDate')?.textContent?.trim() ?? ''
      const media = item.querySelector('source')?.textContent?.trim() ?? ''

      if (!url) continue

      const { count } = await supabase
        .from('news')
        .select('*', { count: 'exact', head: true })
        .eq('url', url)

      if ((count ?? 0) > 0) continue

      const writeDatetime = new Date(pubDate).toISOString()

      const { error } = await supabase.from('news').insert({
        title,
        url,
        media,
        write_date_time: writeDatetime,
      })

      if (error) {
        console.error('[insert error]', error.message)
        continue
      }

      insertCount++
    }

    console.log(`[RSS 수집 완료] ${insertCount}건 저장`)
    return new Response(JSON.stringify({ success: true, inserted: insertCount }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('[RSS 수집 오류]', e)
    return new Response(JSON.stringify({ success: false, error: String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
