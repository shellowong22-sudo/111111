import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('historical VaR observation desk', () => {
  it('uses user-selected imported listings and actual close history while isolating random legacy figures', () => {
    const desk = read('client/src/components/pricing/HistoricalVaRDesk.tsx');
    const legacy = read('client/src/components/pricing/VaRPanel.tsx');
    expect(desk).toContain('trpc.equityListings.list.useQuery');
    expect(desk).toContain("range: '1y' as const");
    expect(desk).toContain('Math.floor((sorted.length - 1) * 0.05)');
    expect(desk).toContain('不生成 VaR、组合损失或风险判断');
    expect(desk).toContain('不以随机分布或旧 VaR 样例替代');
    expect(legacy).toContain('<HistoricalVaRDesk />');
    expect(legacy).toContain('data-var-historical-boundary="true"');
    expect(legacy).toContain('随机损益分布、250 日 P&L 回测');
    expect(legacy).toContain('disabled variant={confidence === c');
  });
});
