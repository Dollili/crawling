export interface RamTarget {
  ramType: 'DDR4' | 'DDR5'
  ramSize: '8GB' | '16GB' | '32GB' | '64GB'
  productName: string
  productUrl: string
}

// 64GB uses ECC/REG product pages because consumer Samsung 64GB listings
// are not consistently exposed on Danawa.
export const RAM_TARGETS: RamTarget[] = [
  {
    ramType: 'DDR4',
    ramSize: '8GB',
    productName: 'Samsung DDR4-3200 (8GB)',
    productUrl: 'https://prod.danawa.com/list/popup/simpleProduct/simpleProductInfo.php?pcode=11541857',
  },
  {
    ramType: 'DDR4',
    ramSize: '16GB',
    productName: 'Samsung DDR4-3200 (16GB)',
    productUrl: 'https://prod.danawa.com/list/popup/simpleProduct/simpleProductInfo.php?pcode=11790199',
  },
  {
    ramType: 'DDR4',
    ramSize: '32GB',
    productName: 'Samsung DDR4-3200 (32GB)',
    productUrl: 'https://prod.danawa.com/list/popup/simpleProduct/simpleProductInfo.php?pcode=11028636',
  },
  {
    ramType: 'DDR4',
    ramSize: '64GB',
    productName: 'Samsung DDR4-3200 ECC/REG (64GB)',
    productUrl: 'https://prod.danawa.com/list/popup/simpleProduct/simpleProductInfo.php?pcode=13433147',
  },
  {
    ramType: 'DDR5',
    ramSize: '8GB',
    productName: 'Samsung DDR5-5600 (8GB)',
    productUrl: 'https://prod.danawa.com/list/popup/simpleProduct/simpleProductInfo.php?pcode=18911771',
  },
  {
    ramType: 'DDR5',
    ramSize: '16GB',
    productName: 'Samsung DDR5-4800 Parallel Import (16GB)',
    productUrl: 'https://prod.danawa.com/list/popup/simpleProduct/simpleProductInfo.php?pcode=16390262',
  },
  {
    ramType: 'DDR5',
    ramSize: '32GB',
    productName: 'Samsung DDR5-5600 (32GB)',
    productUrl: 'https://prod.danawa.com/list/popup/simpleProduct/simpleProductInfo.php?pcode=20644043',
  },
  {
    ramType: 'DDR5',
    ramSize: '64GB',
    productName: 'Samsung DDR5-4800 ECC/REG (64GB)',
    productUrl: 'https://prod.danawa.com/list/popup/simpleProduct/simpleProductInfo.php?pcode=21678716',
  },
]

export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#160;/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function extractLowestPriceFromHtml(html: string): number | null {
  const text = stripHtml(html)
  const won = '\uC6D0'
  const prices = Array.from(text.matchAll(new RegExp(`(\\d{2,3}(?:,\\d{3})+)\\s*${won}`, 'g')))
    .map((match) => Number(match[1].replaceAll(',', '')))
    .filter((price) => Number.isFinite(price) && price >= 10_000)

  if (prices.length === 0) {
    return null
  }

  return Math.min(...prices)
}

export function getCurrentKstMonthWindow(now = new Date()) {
  const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  const year = kstNow.getUTCFullYear()
  const month = kstNow.getUTCMonth()

  return {
    monthStartIso: new Date(Date.UTC(year, month, 1, 0, 0, 0)).toISOString(),
    nextMonthStartIso: new Date(Date.UTC(year, month + 1, 1, 0, 0, 0)).toISOString(),
  }
}
