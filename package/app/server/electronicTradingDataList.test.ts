import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { filterAndSortElectronicTradingRows, type ElectronicTradingListFilters, type ElectronicTradingListRow } from '../client/src/components/electronic-trading/ElectronicTradingDataList';

const filters: ElectronicTradingListFilters = { keyword: '', side: 'all', eventType: 'all', venue: 'all', broker: 'all', strategy: 'all', route: 'all', review: 'all', alert: 'all', from: '', to: '', sortKey: 'latestEventAt', sortDirection: 'desc' };
const row = (orderId: string, latestEventAt: string, side: 'buy' | 'sell', deviation: number | null): ElectronicTradingListRow => ({ orderId, instrument: 'TEST-BOND', side, latestEventType: 'fill', latestEventAt: new Date(latestEventAt), executedQty: 10, executedNotional: 1000, executionCount: 1, eligibleExecutionCount: 1, eligibleExecutionQty: 10, weightedAdverseDeviationBps: deviation, firstExecutionLatencySeconds: 60, venue: 'TEST-VENUE', broker: 'TEST-BROKER', strategyLabel: 'TEST-STRATEGY', routeId: 'TEST-ROUTE' });

describe('账户私有交易数据列表', () => {
  it('只在传入的账户记录集合中执行筛选、告警与排序', () => {
    const rows = [row('ORDER-OLD', '2026-08-20T08:00:00Z', 'buy', 5), row('ORDER-NEW', '2026-08-21T08:00:00Z', 'sell', 35)];
    const result = filterAndSortElectronicTradingRows(rows, new Map([['ORDER-NEW', 'investigating']]), { bps: 25, latencySeconds: 300 }, { ...filters, side: 'sell', alert: 'alert' });
    expect(result.map((item) => item.orderId)).toEqual(['ORDER-NEW']);
  });

  it('刷新、导出和空状态均绑定账户已导入数据而非前端示例', () => {
    const listSource = readFileSync('client/src/components/electronic-trading/ElectronicTradingDataList.tsx', 'utf8');
    const exportSource = readFileSync('client/src/components/electronic-trading/ElectronicTradingFilteredInsights.tsx', 'utf8');
    expect(listSource).toContain('Promise.all([batches.refetch(), dossier.refetch(), settings.refetch(), reviews.refetch()])');
    expect(listSource).toContain('当前账户尚无已导入执行批次');
    expect(exportSource).toContain('disabled={!data.length}');
    expect(exportSource).toContain('当前筛选结果为空，无法导出。');
    expect(exportSource).toContain('导出仅包含当前筛选结果与筛选口径');
    expect(exportSource).toContain('XLSX.writeFile');
  });
});
