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
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'form', 'input', 'textarea'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
  })
}
