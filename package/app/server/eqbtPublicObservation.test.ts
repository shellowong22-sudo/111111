import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('EQBT public observation display boundary', () => {
  it('formats a header price only when the explicit observation response is available and non-null', () => {
    const source = read('client/src/components/EQBTPanel.tsx');
    expect(source).toContain('priceData?.available && priceData.price != null');
    expect(source).toContain('priceData.price.toFixed(2)');
    expect(source).not.toContain('{priceData && (');
  });

  it('does not keep a synthetic market-data branch in the active display contract', () => {
    const source = read('client/src/components/EQBTPanel.tsx');
    const route = read('server/routers/eqbt.ts');
    expect(source).not.toContain('priceData.synthetic');
    expect(source).not.toContain('backtest.data.synthetic');
    expect(route).not.toContain('synthetic: false');
    expect(route).toContain('系统不会以合成价格替代');
  });
});
