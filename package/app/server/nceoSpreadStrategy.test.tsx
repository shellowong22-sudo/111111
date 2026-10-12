// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import NCEOPanel from '../client/src/components/NCEOPanel';

const chain = [
  { strike: 480, expiry: '2026-09-30', daysToExpiry: 30, callBid: 26, callAsk: 27, callLast: 26.5, callVol: 900, callOI: 2200, callIV: 24, callDelta: 0.71, callGamma: 0.022, callVega: 0.12, callTheta: -0.08, putBid: 4, putAsk: 4.5, putLast: 4.25, putVol: 820, putOI: 2000, putIV: 25, putDelta: -0.28, putGamma: 0.021, putVega: 0.11, putTheta: -0.07 },
  { strike: 500, expiry: '2026-09-30', daysToExpiry: 30, callBid: 12, callAsk: 12.4, callLast: 12.2, callVol: 1400, callOI: 5000, callIV: 21.5, callDelta: 0.52, callGamma: 0.034, callVega: 0.14, callTheta: -0.09, putBid: 11.8, putAsk: 12.2, putLast: 12, putVol: 1300, putOI: 4700, putIV: 22.1, putDelta: -0.48, putGamma: 0.033, putVega: 0.13, putTheta: -0.08 },
  { strike: 520, expiry: '2026-09-30', daysToExpiry: 30, callBid: 4.2, callAsk: 4.7, callLast: 4.45, callVol: 880, callOI: 2100, callIV: 23.7, callDelta: 0.3, callGamma: 0.024, callVega: 0.12, callTheta: -0.07, putBid: 25.5, putAsk: 26.1, putLast: 25.8, putVol: 790, putOI: 1900, putIV: 25.2, putDelta: -0.7, putGamma: 0.023, putVega: 0.11, putTheta: -0.07 },
];

vi.mock('@/lib/trpc', () => ({ trpc: {
  useUtils: () => ({ nceoSimulation: { getLedger: { invalidate: vi.fn() } } }),
  auth: { me: { useQuery: () => ({ data: { id: 7, role: 'user' } }) } },
  futuresOptions: {
    getUnderlyings: { useQuery: () => ({ data: [{ symbol: 'SPY', name: 'SPY', price: 500 }], isLoading: false, isError: false }) },
    getOptionChain: { useQuery: () => ({ data: { underlying: { symbol: 'SPY', price: 500 }, chain }, isLoading: false, isError: false, refetch: vi.fn() }) },
    getContractIVHistory: { useQuery: () => ({ data: { ivHistory: [{ date: '2026-08-20', iv: 21.1 }, { date: '2026-08-21', iv: 21.5 }] }, isLoading: false, isError: false, refetch: vi.fn() }) },
    getLiveQuoteStatus: { useQuery: () => ({ data: { available: false, provider: null, delay: null, bid: null, ask: null, observedAt: null, reason: '未配置授权期权行情。', boundary: '不发送订单。' }, isLoading: false, isError: false, refetch: vi.fn() }) },
  },
  nceoSimulation: {
    getLedger: { useQuery: () => ({ data: { status: 'available', positions: [], events: [] }, isLoading: false, isError: false }) },
    createPosition: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    closePosition: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    recordModelRefresh: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    recordCsvExport: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
  },
} }));
vi.mock('recharts', () => { const Box = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>; const Shape = () => null; return { ResponsiveContainer: Box, LineChart: Box, Line: Shape, CartesianGrid: Shape, Tooltip: Shape, XAxis: Shape, YAxis: Shape, ReferenceLine: Shape, Legend: Shape }; });
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

describe('NCEO 价差策略自动生成', () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('switches from a bull call spread to straddle and shows legs, breakevens and the payoff view', () => {
    render(<NCEOPanel />);
    expect(screen.getByText('牛市价差 · 到期损益曲线')).toBeTruthy();
    expect(screen.getByText('盈亏平衡点')).toBeTruthy();
    expect(screen.getAllByText('模型买入').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: '跨式' }));
    expect(screen.getByText('跨式 · 到期损益曲线')).toBeTruthy();
    expect(screen.getByText(/理论不封顶/)).toBeTruthy();
    expect(screen.getByText(/不是对真实市场的买卖指令/)).toBeTruthy();
  });

  it('offers bull, bear, straddle and strangle strategy controls in the original NCEO panel', () => {
    render(<NCEOPanel />);
    for (const label of ['牛市价差', '熊市价差', '跨式', '勒式']) expect(screen.getByRole('button', { name: label })).toBeTruthy();
  });
});
