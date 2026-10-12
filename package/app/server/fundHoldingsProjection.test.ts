import { describe, expect, it } from 'vitest';
import { projectVerifiedFundHoldings } from '../client/src/pages/FundHoldings';
import type { ModuleLiveFeedItem } from '../client/src/hooks/useModuleLiveFeed';

function disclosure(symbol: string, observedAt: string, weight: number): ModuleLiveFeedItem {
  return {
    itemKey: `${symbol}:${observedAt}`,
    title: 'ETF holdings',
    body: '',
    topic: 'funds',
    category: 'holdings',
    sourceKind: 'observation',
    dataset: {
      label: 'ETF holdings',
      columns: ['etf_symbol', 'holding_name', 'holding_symbol', 'weight'],
      rows: [{ etf_symbol: symbol, holding_name: 'Example Company', holding_symbol: 'EX', weight }],
      metadata: {
        provider: 'Test Source', queriedAt: observedAt, observedAt, timezone: 'UTC',
        rowCount: 1, displayedRowCount: 1, truncated: false, quality: 'source-observed',
        realtimeStatus: 'daily', schemaVersion: 'openbb-v1', checksum: `${symbol}:${observedAt}`,
      },
    },
  };
}

describe('fund holding disclosure projection', () => {
  it('requires exact parent fund identity and keeps latest same-security disclosure', () => {
    const rows = projectVerifiedFundHoldings([
      disclosure('SPY', '2026-09-29', 5),
      disclosure('QQQ', '2026-09-30', 90),
      disclosure('SPY', '2026-09-30', 6),
    ], 'SPY');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ symbol: 'EX', weight: 6, observedAt: '2026-09-30' });
  });
});
