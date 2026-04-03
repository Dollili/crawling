const ALLOWED_TAGS = new Set(['UL', 'OL', 'LI', 'P', 'BR', 'STRONG', 'EM', 'B', 'I'])

function escapeHtml(text: string) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function sanitizeNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return escapeHtml(node.textContent ?? '')
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return ''
  }

  const element = node as HTMLElement
  const tagName = element.tagName.toUpperCase()
  const children = Array.from(element.childNodes).map(sanitizeNode).join('')

  if (!ALLOWED_TAGS.has(tagName)) {
    return children
  }

  if (tagName === 'BR') {
    return '<br>'
  }

  return `<${tagName.toLowerCase()}>${children}</${tagName.toLowerCase()}>`
}

export function sanitizeSummaryHtml(html: string | null | undefined) {
  if (!html) {
    return ''
  }

  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return escapeHtml(html)
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  return Array.from(doc.body.childNodes).map(sanitizeNode).join('')
}
