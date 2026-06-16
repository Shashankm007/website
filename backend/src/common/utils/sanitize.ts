import sanitizeHtml from 'sanitize-html';

/** Strip dangerous HTML from user-supplied rich text (descriptions, review bodies). */
export function sanitizeRichText(input?: string | null): string {
  if (!input) return '';
  return sanitizeHtml(input, {
    allowedTags: ['b', 'i', 'em', 'strong', 'a', 'p', 'ul', 'ol', 'li', 'br', 'h2', 'h3', 'blockquote', 'code'],
    allowedAttributes: { a: ['href', 'target', 'rel'] },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer', target: '_blank' }),
    },
  });
}

/** Plain-text sanitization (names, titles) — strips all tags. */
export function sanitizePlain(input?: string | null): string {
  if (!input) return '';
  return sanitizeHtml(input, { allowedTags: [], allowedAttributes: {} }).trim();
}
