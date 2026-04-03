import { assertEquals } from 'jsr:@std/assert'

import {
  extractLowestPriceFromHtml,
  getCurrentKstMonthWindow,
} from '../_shared/rams.ts'

Deno.test('extractLowestPriceFromHtml returns the lowest product price and ignores shipping', () => {
  const html = `
    <div>
      <span>Auction 96,900\uC6D0 3,000\uC6D0</span>
      <span>Gmarket 97,430\uC6D0 2,500\uC6D0</span>
      <span>Store 89,000\uC6D0 3,000\uC6D0</span>
    </div>
  `

  assertEquals(extractLowestPriceFromHtml(html), 89_000)
})

Deno.test('extractLowestPriceFromHtml returns null when no valid price exists', () => {
  const html = '<div>No price available.</div>'

  assertEquals(extractLowestPriceFromHtml(html), null)
})

Deno.test('getCurrentKstMonthWindow returns month boundaries in UTC ISO format', () => {
  const now = new Date('2026-04-03T12:34:56.000Z')
  const window = getCurrentKstMonthWindow(now)

  assertEquals(window.monthStartIso, '2026-04-01T00:00:00.000Z')
  assertEquals(window.nextMonthStartIso, '2026-05-01T00:00:00.000Z')
})
