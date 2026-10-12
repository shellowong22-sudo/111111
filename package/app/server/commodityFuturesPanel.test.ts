import { describe, expect, it } from 'vitest';
import type { ModuleLiveFeedItem } from '../client/src/hooks/useModuleLiveFeed';
import { derivativeArchivePath, readArchivedFuturesRows, readCftcPositions } from '../client/src/pages/DerivativesBase';

function delivery(label: string, rows: NonNullable<ModuleLiveFeedItem['dataset']>['rows']): ModuleLiveFeedItem {
  return {
    itemKey: label,
    title: label,
    body: label,
    topic: label,
    category: '参考历史',
    sourceKind: 'observation',
    dataset: {
      label,
      columns: Object.keys(rows[0] ?? {}),
      rows,
      metadata: {
        provider: '归档观察',
        queriedAt: null,
        observedAt: '2026-09-30',
        timezone: 'Asia/Taipei',
        rowCount: rows.length,
        displayedRowCount: rows.length,
        truncated: false,
        quality: 'available',
        realtimeStatus: 'delayed',
        schemaVersion: 'module-observation-history-v1',
        checksum: label,
      },
    },
  };
}

describe('商品期货原页面归档呈现', () => {
  it('期货和指数期权各自只读取所属功能路径', () => {
    expect(derivativeArchivePath('openbb://derivatives_futures_curve')).toBe('/commodity-futures');
    expect(derivativeArchivePath('openbb://derivatives_options_chains')).toBe('/_index-options');
    expect(derivativeArchivePath('openbb://unknown')).toBe('');
  });

  it('结算价为零时选有效收盘价，不把零价或空值冒充行情', () => {
    const rows = readArchivedFuturesRows([delivery('台湾期货日成交', [
      { symbol: 'TX:202610', name: '台湾加权指数', contract_name: '台股指数期货 2026年10月', settlement_price: 0, close: 48479, value: 0, volume: 500, date: '2026-09-30' },
      { symbol: 'TX:202611', name: '台湾加权指数', contract_name: '台股指数期货 2026年11月', settlement_price: 0, close: 0, value: 0, volume: 300, date: '2026-09-30' },
    ])]);
    expect(rows.find(row => row.symbol === 'TX:202610')?.price).toBe(48479);
    expect(rows.find(row => row.symbol === 'TX:202611')?.price).toBeNull();
  });

  it('同一合约保留最新观察，独立合约不折叠', () => {
    const rows = readArchivedFuturesRows([delivery('期货公开快照', [
      { symbol: 'CL', name: 'WTI', contract_name: 'WTI 10月', value: 71, date: '2026-09-29' },
      { symbol: 'CL', name: 'WTI', contract_name: 'WTI 10月', value: 72, date: '2026-09-30' },
      { symbol: 'CL', name: 'WTI', contract_name: 'WTI 11月', value: 73, date: '2026-09-30' },
    ])]);
    expect(rows).toHaveLength(2);
    expect(rows.find(row => row.contractName === 'WTI 10月')?.price).toBe(72);
  });

  it('不展示与涨跌额方向相反的涨跌幅', () => {
    const rows = readArchivedFuturesRows([delivery('中国期货公开快照', [
      { symbol: 'TA0', name: 'PTA连续', value: 6300, change: -50, change_pct: 0.74, date: '2026-09-30' },
    ])]);
    expect(rows[0]).toMatchObject({ change: -50, changePct: null });
  });

  it('周度 CFTC 只展示最新报告与真实结构字段，不混入行情表', () => {
    const item = delivery('CFTC 全球期货持仓周报', [
      { symbol: 'WTI', contract_name: 'WTI 原油', open_interest: 100000, producer_net: -92812, managed_money_net: 96038, date: '2026-09-22' },
      { symbol: 'WTI', contract_name: 'WTI 原油', open_interest: 99000, producer_net: -90000, date: '2026-09-15' },
    ]);
    expect(readArchivedFuturesRows([item])).toEqual([]);
    expect(readCftcPositions([item])).toEqual([expect.objectContaining({
      name: 'WTI 原油', date: '2026-09-22', producerNet: -92812, managedMoneyNet: 96038,
    })]);
  });
});
