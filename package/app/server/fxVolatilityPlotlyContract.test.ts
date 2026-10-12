import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('FX volatility Plotly runtime contract', () => {
  it('keeps the existing lazy Plotly renderer paired with a local module declaration', () => {
    expect(read('client/src/pages/FXVolatilityAdvanced.tsx')).toContain("import('plotly.js-dist-min')");
    expect(read('client/src/types/plotly-dist.d.ts')).toContain("declare module 'plotly.js-dist-min'");
  });
});
