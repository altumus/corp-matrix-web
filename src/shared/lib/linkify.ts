/**
 * Convert plain text to HTML with clickable links.
 * Escapes HTML entities first, then wraps URLs in <a> tags.
 */
export function linkifyPlainText(text: string): string {
  // 1. Escape HTML
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // 2. Convert newlines
  html = html.replace(/\n/g, '<br />')

  // 3. Linkify URLs — match http(s) and bare domain URLs
  html = html.replace(
    /(?:https?:\/\/|www\.)[^\s<>"'`,;)}\]]+/gi,
    (url) => {
      // Remove trailing punctuation that's likely not part of the URL
      let href = url
      const trailingMatch = href.match(/[.),:;!?]+$/)
      let trailing = ''
      if (trailingMatch) {
        // Keep trailing chars only if they have matching openers in the URL
        const last = trailingMatch[0]
        if (last === ')' && (href.match(/\(/g)?.length ?? 0) >= (href.match(/\)/g)?.length ?? 0)) {
          // Balanced parens — keep (common in Wikipedia URLs)
        } else {
          trailing = last
          href = href.slice(0, -last.length)
        }
      }

      const fullHref = href.startsWith('http') ? href : `https://${href}`
      return `<a href="${fullHref}" target="_blank" rel="noopener noreferrer">${href}</a>${trailing}`
    },
  )

  return html
}
