/** URL-safe slug from arbitrary text. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}

/** Append a short random suffix to guarantee uniqueness when needed. */
export function uniqueSlug(base: string, suffix: string): string {
  return `${slugify(base)}-${suffix.toLowerCase()}`;
}
