import DOMPurify from 'dompurify'

const ALLOWED_TAGS = [
  'a', 'b', 'i', 'u', 'em', 'strong', 'del', 'sup', 'sub',
  'p', 'br', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'div',
  'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr',
  'img', 'mx-reply',
]

const ALLOWED_ATTR = [
  'href', 'src', 'alt', 'title', 'class',
  'data-mx-color', 'data-mx-bg-color', 'data-mx-spoiler',
  'data-event-id', 'target', 'rel',
]

export function sanitizeHtml(dirty: string): string {
  const clean = DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'form', 'input', 'textarea'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
  })

  // Linkify bare URLs that are not already inside an <a> tag.
  // Split by existing tags to only process text nodes.
  const linked = clean.replace(
    /(<a\s[^>]*>[\s\S]*?<\/a>)|(?:https?:\/\/[^\s<>"'`,;)}\]]+)/gi,
    (match, insideAnchor) => {
      // Already inside <a>...</a> — keep as-is
      if (insideAnchor) return insideAnchor
      // Bare URL — wrap in <a>
      let href = match
      const trailingMatch = href.match(/[.),:;!?]+$/)
      let trailing = ''
      if (trailingMatch) {
        const last = trailingMatch[0]
        // Keep trailing paren if balanced (Wikipedia-style URLs)
        if (!(last === ')' && (href.match(/\(/g)?.length ?? 0) >= (href.match(/\)/g)?.length ?? 0))) {
          trailing = last
          href = href.slice(0, -last.length)
        }
      }
      return `<a href="${href}" target="_blank" rel="noopener noreferrer">${href}</a>${trailing}`
    },
  )

  // Highlight hashtags in text nodes only (don't touch attributes/inside tags)
  return linked.replace(
    /(^|>|\s)(#[а-яА-ЯёЁa-zA-Z0-9_]{2,})/g,
    (_, prefix, tag) => `${prefix}<span class="hashtag">${tag}</span>`,
  )
}
