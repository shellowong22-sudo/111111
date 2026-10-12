// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { mockUseQuery } = vi.hoisted(() => ({ mockUseQuery: vi.fn() }));

vi.mock('@/lib/trpc', () => ({
  trpc: { treasuryHistoricalCurve: { getImported: { useQuery: mockUseQuery } } },
}));

import TreasuryHistoricalCurveAssetDesk from '../client/src/components/curves/TreasuryHistoricalCurveAssetDesk';

afterEach(() => { cleanup(); vi.clearAllMocks(); });

const loadedAsset = {
  available: true as const,
  audit: {
    importKey: 'treasury-par-yield-curve-month-end-v1-1990-2023',
    sourceUrl: 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rate-archives/par-yield-curve-rates-1990-2023.csv',
    sourceSha256: '004461bcf87ec7b34daf035f05fc191d7cf2cd84986533df3e39d5dcdb0d62a4',
    sourceFirstDate: '1990-01-31',
    sourceLastDate: '2023-12-29',
    samplingRule: 'calendar-month last actual Treasury-published observation; no interpolation',
    selectedObservationCount: 408,
    importedPointCount: 4257,
    fetchedAt: '2026-08-25T16:42:00.000Z',
  },
  latestObservations: [{ date: '2023-12-29', points: [{ period: '2Y', value: '4.23' }, { period: '10Y', value: '3.88' }, { period: '30Y', value: '4.03' }] }],
  limitation: '资产由美国财政部 Daily Treasury Par Yield Curve 官方归档的每月最后一个实际发布观测构成；未插值、未预测，且不是可执行报价、订单簿或交易建议。',
};

describe('美国财政部历史曲线资产台渲染契约', () => {
  it('将已加载的覆盖期、点数、来源、哈希和最近观测实际渲染至 DOM', () => {
    mockUseQuery.mockReturnValue({ isLoading: false, data: loadedAsset });
    render(createElement(TreasuryHistoricalCurveAssetDesk));
    expect(screen.getByText('1990-01-31 → 2023-12-29')).not.toBeNull();
    expect(screen.getByText('408 个')).not.toBeNull();
    expect(screen.getByText('4,257 个')).not.toBeNull();
    expect(screen.getByText((_content, element) => element?.textContent === `来源：${loadedAsset.audit.sourceUrl}`)).not.toBeNull();
    expect(screen.getByText((_content, element) => element?.textContent === `SHA-256：${loadedAsset.audit.sourceSha256}`)).not.toBeNull();
    expect(screen.getByText('2023-12-29')).not.toBeNull();
    expect(screen.getByText('3.88%')).not.toBeNull();
  });

  it('在历史资产不可用时显示真实空状态而不虚构替代数据', () => {
    mockUseQuery.mockReturnValue({ isLoading: false, data: { available: false, limitation: '数据库当前不可用；系统未以 ZIP 测试性曲线或合成历史替代官方资产。' } });
    render(createElement(TreasuryHistoricalCurveAssetDesk));
    expect(screen.getByText('数据库当前不可用；系统未以 ZIP 测试性曲线或合成历史替代官方资产。')).not.toBeNull();
    expect(screen.queryByText('4,257 个')).toBeNull();
  });
});
