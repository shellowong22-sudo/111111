import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('TOMS execution evidence boundary', () => {
  it('defaults to no authorized execution evidence and contains simulated orders only in a disabled historical area', () => {
    const panel = read('client/src/components/order-management/TOMSPanel.tsx');
    const server = read('server/tomsWebSocket.ts');
    expect(panel).toContain('data-toms-execution-evidence-desk="true"');
    expect(panel).toContain('未接入经授权的 OMS、券商路由、交易场所、做市商 RFQ');
    expect(panel).toContain('不能产生警报或桌面通知');
    expect(panel).toContain('function HistoricalTOMSPanel()');
    expect(panel).toContain('showHistorical && <div className="pointer-events-none select-none');
    expect(panel).toContain('data-toms-historical-boundary="true"');
    expect(server).toContain('function genBondOrder');
    expect(server).toContain('Math.random');
  });
});
