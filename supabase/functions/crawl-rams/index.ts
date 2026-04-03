import { createClient } from 'jsr:@supabase/supabase-js@2'

import {
  extractLowestPriceFromHtml,
  getCurrentKstMonthWindow,
  RAM_TARGETS,
  type RamTarget,
} from './rams.ts'

async function alreadyCollectedThisMonth(
  supabase: ReturnType<typeof createClient>,
  target: RamTarget,
  monthStartIso: string,
  nextMonthStartIso: string,
) {
  const { count, error } = await supabase
    .from('ram_month')
    .select('*', { count: 'exact', head: true })
    .eq('ram_type', target.ramType)
    .eq('ram_size', target.ramSize)
    .gte('create_date_time', monthStartIso)
    .lt('create_date_time', nextMonthStartIso)

  if (error) {
    throw error
  }

  return (count ?? 0) > 0
}

async function collectPrice(target: RamTarget) {
  const response = await fetch(target.productUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
    },
  })

  if (!response.ok) {
    throw new Error(`Danawa request failed: ${response.status}`)
  }

  const html = await response.text()
  const price = extractLowestPriceFromHtml(html)

  if (price == null) {
    throw new Error(`No price found for ${target.productName}`)
  }

  return price
}

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

    const { monthStartIso, nextMonthStartIso } = getCurrentKstMonthWindow()
    let inserted = 0
    let skipped = 0
    const failures: Array<{ ramType: string; ramSize: string; message: string }> = []

    for (const target of RAM_TARGETS) {
      try {
        const exists = await alreadyCollectedThisMonth(
          supabase,
          target,
          monthStartIso,
          nextMonthStartIso,
        )

        if (exists) {
          skipped++
          continue
        }

        const price = await collectPrice(target)

        const { error } = await supabase.from('ram_month').insert({
          ram_type: target.ramType,
          ram_size: target.ramSize,
          current_price: price,
          register_date: monthStartIso,
          create_date_time: monthStartIso,
        })

        if (error) {
          throw error
        }

        inserted++
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error('[crawl-rams error]', target.ramType, target.ramSize, message)
        failures.push({
          ramType: target.ramType,
          ramSize: target.ramSize,
          message,
        })
      }
    }

    return new Response(
      JSON.stringify({
        success: failures.length === 0,
        inserted,
        skipped,
        failed: failures.length,
        failures,
      }),
      {
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      },
    )
  } catch (error) {
    console.error('[crawl-rams fatal]', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: String(error),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      },
    )
  }
})
