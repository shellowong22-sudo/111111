// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import StockNCEOCockpitPanel from '../client/src/components/StockNCEOCockpitPanel';

const reorderSpy = vi.fn();

vi.mock('@/lib/trpc', () => ({ trpc: {
  useUtils: () => ({ stockNceoWatchlist: { getBoard: { invalidate: vi.fn() } } }),
  market: { getHistory: { useQuery: () => ({ data: { available: true, source: 'Yahoo Finance', limitation: '公共日频观察，不是可执行报价。', history: Array.from({ length: 12 }, (_, index) => ({ date: `2026-08-${String(index + 10).padStart(2, '0')}`, open: 190 + index, high: 201 + index, low: 189 + index, close: 198 + index, volume: 1000 + index * 50 })) }, isLoading: false, isError: false, refetch: vi.fn() }) } },
  futuresOptions: { getOptionChain: { useQuery: () => ({ data: { underlying: { symbol: 'AAPL', price: 200 }, chain: [{ strike: 200, daysToExpiry: 30, callBid: 5.1, callAsk: 5.4, callIV: 23.4, callDelta: 0.52, putBid: 4.8, putAsk: 5, putIV: 24.1, putDelta: -0.48 }] }, isLoading: false, isError: false, refetch: vi.fn() }) } },
  adminNewsIngestion: { getPublished: { useQuery: () => ({ data: [{ id: 18, sourceHeadline: 'AAPL 相关财经新闻', aiTitle: 'AAPL 站内审核摘要', aiSummary: '该文章为已审核的站内财经摘要。', category: '公司', sentiment: 'neutral', tickers: ['AAPL'], sourceName: '许可 RSS', provider: '测试来源', publishedAt: new Date('2026-08-27T08:00:00Z'), sourcePublishedAt: new Date('2026-08-27T07:30:00Z') }], isLoading: false, isError: false }) } },
  adminDataModules: {
    getFeedsForPath: { useQuery: () => ({ data: [], isLoading: false, error: null, refetch: vi.fn() }) },
    acknowledgeFeeds: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
  },
  stockNceoWatchlist: {
    getBoard: { useQuery: () => ({ data: { status: 'available', defaultCollectionName: '默认研究观察池', collections: [], collectionLayouts: [], layout: null, items: [{ id: 1, collectionId: null, itemType: 'stock', symbol: 'AAPL', displayName: 'AAPL 股票研究观察', optionSide: null, expiryDays: null, updatedAt: new Date('2026-08-20') }, { id: 2, collectionId: null, itemType: 'stock', symbol: 'MSFT', displayName: 'MSFT 股票研究观察', optionSide: null, expiryDays: null, updatedAt: new Date('2026-08-21') }], sourceBoundary: '仅保存研究偏好。' }, isLoading: false, isError: false }) },
    createCollection: { useMutation: (options: { onSuccess?: (result: { status: string; collectionId: number | null; sourceBoundary: string }) => void }) => ({ mutate: () => options.onSuccess?.({ status: 'available', collectionId: 7, sourceBoundary: '仅保存研究偏好。' }), isPending: false }) },
    renameCollection: { useMutation: (options: { onSuccess?: (result: { status: string; sourceBoundary: string }) => void }) => ({ mutate: () => options.onSuccess?.({ status: 'available', sourceBoundary: '仅保存研究偏好。' }), isPending: false }) },
    deleteCollection: { useMutation: (options: { onSuccess?: (result: { status: string; sourceBoundary: string }) => void }) => ({ mutate: () => options.onSuccess?.({ status: 'available', sourceBoundary: '仅保存研究偏好。' }), isPending: false }) },
    addItem: { useMutation: (options: { onSuccess?: (result: { status: string; sourceBoundary: string }) => void }) => ({ mutate: () => options.onSuccess?.({ status: 'available', sourceBoundary: '仅保存研究偏好。' }), isPending: false }) },
    removeItem: { useMutation: (options: { onSuccess?: (result: { status: string; sourceBoundary: string }) => void }) => ({ mutate: () => options.onSuccess?.({ status: 'available', sourceBoundary: '仅保存研究偏好。' }), isPending: false }) },
    reorderItems: { useMutation: (options: { onSuccess?: (result: { status: string; sourceBoundary: string }) => void }) => ({ mutate: (input: unknown) => { reorderSpy(input); options.onSuccess?.({ status: 'available', sourceBoundary: '仅保存研究偏好。' }); }, isPending: false }) },
    saveLayout: { useMutation: (options: { onSuccess?: (result: { status: string; sourceBoundary: string }) => void }) => ({ mutate: () => options.onSuccess?.({ status: 'available', sourceBoundary: '仅保存研究偏好。' }), isPending: false }) },
  },
} }));
vi.mock('recharts', () => { const Box = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>; const Shape = () => null; return { ResponsiveContainer: Box, LineChart: Box, BarChart: Box, Line: Shape, Bar: Shape, CartesianGrid: Shape, Tooltip: Shape, XAxis: Shape, YAxis: Shape, ReferenceLine: Shape, Legend: Shape }; });

describe('终端内股票智能驾驶舱', () => {
  afterEach(() => cleanup());

  it('displays source-backed stock observations without generating a substitute option chain', () => {
    const onOpenNceo = vi.fn();
    render(<StockNCEOCockpitPanel onOpenNceo={onOpenNceo} />);
    expect(screen.getByText(/AAPL · 公共日频 K 线与技术研究/)).toBeTruthy();
    expect(screen.getByRole('img', { name: '公共日频 OHLC K 线与技术研究图' })).toBeTruthy();
    expect(screen.getByText('NCEO · AAPL 期权数据接入状态')).toBeTruthy();
    expect(screen.getByText(/不生成 ATM 合约/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'NCEO 暂不可用' }).hasAttribute('disabled')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '1 分' }));
    expect(screen.getByText(/1 分 K 线、分时均价、实时资金流和盘口没有接入可授权来源/)).toBeTruthy();
    expect(screen.getByText('股票与 NCEO 研究屏风')).toBeTruthy();
    expect(screen.getByRole('region', { name: '股票相关财经新闻与数据图' })).toBeTruthy();
    expect(screen.getByText('AAPL 站内审核摘要')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '添加 AAPL 股票' }));
    expect(screen.getByText(/已保存至当前登录用户的当前观察池/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '下移 AAPL 股票研究观察' }));
    expect(reorderSpy).toHaveBeenCalledWith({ collectionId: null, itemIds: [2, 1] });
    expect(onOpenNceo).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('MSFT 股票研究观察'));
    expect(screen.getByText('MSFT · 公共日频 K 线与技术研究')).toBeTruthy();
  });
});
