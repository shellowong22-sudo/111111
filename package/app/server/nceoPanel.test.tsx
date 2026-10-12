// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import NCEOPanel from '../client/src/components/NCEOPanel';

vi.mock('@/lib/trpc', () => ({
  trpc: {
    useUtils: () => ({ nceoSimulation: { getLedger: { invalidate: vi.fn() } } }),
    auth: { me: { useQuery: () => ({ data: { id: 7, role: 'user' } }) } },
    futuresOptions: {
      getUnderlyings: {
        useQuery: () => ({ data: [{ symbol: 'SPY', name: 'S&P 500 ETF', price: 500, change: 2, changePct: 0.4, iv30: 21.4 }], isLoading: false, isError: false, refetch: vi.fn() }),
      },
      getOptionChain: {
        useQuery: () => ({
          data: {
            underlying: { symbol: 'SPY', price: 500 },
            chain: [{ strike: 500, expiry: '2026-09-30', daysToExpiry: 30, callBid: 12.1, callAsk: 12.3, callLast: 12.2, callVol: 1450, callOI: 5200, callIV: 21.4, callDelta: 0.52, callGamma: 0.0341, callVega: 0.118, callTheta: -0.08, putBid: 11.7, putAsk: 11.9, putLast: 11.8, putVol: 1320, putOI: 4800, putIV: 22.1, putDelta: -0.48, putGamma: 0.0337, putVega: 0.115, putTheta: -0.076, pcRatio: 0.91, intrinsicCall: 0, intrinsicPut: 0, arbitrageSignal: null, arbitrageScore: 0 }],
          },
          isLoading: false,
          isError: false,
          refetch: vi.fn(),
        }),
      },
      getContractIVHistory: {
        useQuery: () => ({ data: { ivHistory: [{ date: '2026-08-20', iv: 20.8 }, { date: '2026-08-21', iv: 21.4 }] }, isLoading: false, isError: false, refetch: vi.fn() }),
      },
      getLiveQuoteStatus: {
        useQuery: () => ({ data: { available: false, provider: null, delay: null, bid: null, ask: null, observedAt: null, reason: '尚未配置可授权的期权市场数据提供方，因此不能显示真实或延迟 Bid／Ask。', boundary: '不创建券商会话，也不发送订单。' }, isLoading: false, isError: false, refetch: vi.fn() }),
      },
    },
    nceoSimulation: {
      getLedger: { useQuery: () => ({ data: { status: 'available', positions: [], events: [] }, isLoading: false, isError: false }) },
      createPosition: { useMutation: (options: { onSuccess?: (result: { status: string }) => void }) => ({ mutate: () => options.onSuccess?.({ status: 'available' }), isPending: false }) },
      closePosition: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      recordModelRefresh: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      recordCsvExport: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
  },
}));

vi.mock('recharts', () => {
  const Container = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  const Shape = () => null;
  return { ResponsiveContainer: Container, LineChart: Container, Line: Shape, CartesianGrid: Shape, Tooltip: Shape, XAxis: Shape, YAxis: Shape, ReferenceLine: Shape, Legend: Shape };
});

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

describe('NCEO 诺诚增强期权原面板', () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('keeps contract information and simulated long/short status inside the NCEO panel', () => {
    render(<NCEOPanel />);
    expect(screen.getByText('佑诚期权 · 诺诚增强期权')).toBeTruthy();
    expect(screen.getAllByText(/模拟可做多/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText('SPY 500 P'));
    fireEvent.click(screen.getByRole('button', { name: '空头情景' }));
    expect(screen.getByText(/模拟可做空／可新开/)).toBeTruthy();
    expect(screen.getByText(/不发送真实订单/)).toBeTruthy();
  });

  it('requires explicit risk acknowledgement before it creates a local simulation position', () => {
    render(<NCEOPanel />);
    fireEvent.click(screen.getByLabelText('确认 NCEO 风险提示'));
    fireEvent.click(screen.getByRole('button', { name: '创建模拟仓位（不发送订单）' }));
    expect(screen.getByText('已保存的 NCEO 模拟仓位')).toBeTruthy();
    expect(screen.getByText('未路由订单')).toBeTruthy();
    expect(screen.getByText(/不构成监管留档/)).toBeTruthy();
  });

  it('keeps model T-chain, greek studies and session-only price observation inside the NCEO panel', () => {
    render(<NCEOPanel />);
    expect(screen.getByText('NCEO 模型 T 型期权链')).toBeTruthy();
    expect(screen.getByText('模型希腊值曲线')).toBeTruthy();
    expect(screen.getByText('模型 IV 期限锥')).toBeTruthy();
    expect(screen.getByText('模型时间衰减预览')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('NCEO 模型合约会话阈值'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: '检查阈值' }));
    expect(screen.getAllByText(/当前模型参考价/).length).toBeGreaterThan(0);
    expect(screen.getByText(/已触及或高于会话阈值/)).toBeTruthy();
  });

  it('shows an explicit authorization boundary instead of presenting model prices as real bid ask quotes', () => {
    render(<NCEOPanel />);
    expect(screen.getByText(/授权期权买卖报价/)).toBeTruthy();
    expect(screen.getByText('未配置')).toBeTruthy();
    expect(screen.getByText(/不能显示真实或延迟 Bid／Ask/)).toBeTruthy();
    expect(screen.getByText(/不会用 NCEO 模型链、网页抓取或静态数字替代/)).toBeTruthy();
  });
});
