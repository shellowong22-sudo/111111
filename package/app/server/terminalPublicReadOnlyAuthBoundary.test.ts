import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('terminal public read-only auth boundary', () => {
  it('does not redirect anonymous terminal or News Hub readers away when a separate protected query is rejected', () => {
    const source = readFileSync(resolve(process.cwd(), 'client/src/main.tsx'), 'utf8');

    expect(source).toContain('["/terminal", "/news-hub"].includes(window.location.pathname)');
    expect(source).toContain('if (!isUnauthorized) return;');
    expect(source.indexOf('["/terminal", "/news-hub"].includes(window.location.pathname)')).toBeLessThan(source.indexOf('window.location.href = getLoginUrl();'));
  });
});
