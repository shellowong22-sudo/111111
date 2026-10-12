import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('定价与风险原工作区字节级保护', () => {
  it('keeps the original PricingRisk page unchanged', () => {
    const source = readFileSync(resolve(process.cwd(), 'client/src/pages/PricingRisk.tsx'));
    expect(createHash('sha256').update(source).digest('hex')).toBe('9b284b369f9b2776193ab2ee2e4a9d122bc20f862256f352680923ddc0074fd0');
  });
});
