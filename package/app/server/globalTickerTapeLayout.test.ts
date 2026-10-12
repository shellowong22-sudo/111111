import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('global ticker tape layout', () => {
  it('keeps each unique imported-snapshot item non-shrinking in a manually scrollable row', () => {
    const source = readFileSync(join(process.cwd(), 'client/src/components/GlobalTickerTape.tsx'), 'utf8');
    expect(source).toContain("'flex shrink-0 items-center gap-2 px-3 py-1 whitespace-nowrap group rounded transition-colors'");
    expect(source).toContain('overflow-x-auto');
    expect(source).toContain('ticker-tape-global flex min-w-max gap-6');
    expect(source).not.toContain('animate-ticker-scroll');
    expect(source).not.toContain('<button');
  });
});
