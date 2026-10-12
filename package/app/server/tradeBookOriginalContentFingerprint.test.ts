import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('交易账簿原内容字节级保护', () => {
  it('keeps the original TradeBook workspace byte-for-byte unchanged', () => {
    const actual = createHash('sha256').update(readFileSync('client/src/pages/TradeBook.tsx')).digest('hex');
    expect(actual).toBe('a91495a1a3260df53162584487d54f4d84fc2284170b2400697c3757e5416953');
  });
});
