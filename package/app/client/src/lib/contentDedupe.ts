/** Final-render guard for delivered/public content. One event = one visible item. */
export function decodePublicText(value: unknown): string {
  return String(value ?? '')
    .replace(/&nbsp;|&#160;|&#xA0;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[ \t\r\f]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .trim();
}

export function contentFingerprint(value: unknown): string {
  return decodePublicText(value).toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

function grams(value: string): Set<string> {
  const normalized = contentFingerprint(value);
  if (normalized.length < 12) return new Set(normalized ? [normalized] : []);
  const result = new Set<string>();
  for (let index = 0; index <= normalized.length - 4; index += 1) result.add(normalized.slice(index, index + 4));
  return result;
}

function similarity(left: string, right: string): number {
  const a = grams(left); const b = grams(right);
  if (!a.size || !b.size) return 0;
  let overlap = 0; a.forEach((item) => { if (b.has(item)) overlap += 1; });
  return overlap / Math.max(a.size, b.size);
}

/** Keeps the newest item and suppresses title-only variants of the same article. */
export function distinctPublicItems<T extends { title?: unknown; body?: unknown; summary?: unknown; id?: unknown; publishedAt?: unknown }>(items: T[]): T[] {
  const kept: T[] = [];
  const exact = new Set<string>();
  for (const item of items) {
    const body = decodePublicText(item.body ?? item.summary ?? '');
    const title = decodePublicText(item.title);
    const key = contentFingerprint(body || title);
    if (!key || exact.has(key)) continue;
    if (body && kept.some((previous) => similarity(body, decodePublicText(previous.body ?? previous.summary ?? '')) >= 0.86)) continue;
    exact.add(key);
    kept.push({ ...item, title, ...(item.body !== undefined ? { body } : {}), ...(item.summary !== undefined ? { summary: body } : {}) });
  }
  return kept;
}
