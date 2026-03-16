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

      // pg_net 비동기 지연으로 인해 실행 시각이 부정확하므로, KST 09:00으로 명시적 지정
      // cron은 UTC 00:00(= KST 09:00)에 실행되므로 오늘 날짜의 UTC 00:00 = KST 09:00
      const now = new Date()
      const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000)
      const createDatetime = new Date(
        Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate(), 0, 0, 0)
      ).toISOString()

      const { error } = await supabase.from('news').insert({
        title,
        url,
        media,
        write_date_time: writeDatetime,
        create_date_time: createDatetime,
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
