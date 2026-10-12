// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import StockNCEOResearchWatchboard from '../client/src/components/StockNCEOResearchWatchboard';

const spies = vi.hoisted(() => ({ create: vi.fn(), reorder: vi.fn() }));

vi.mock('@/lib/trpc', () => ({ trpc: {
  useUtils: () => ({ stockNceoWatchlist: { getBoard: { invalidate: vi.fn() } } }),
  stockNceoWatchlist: {
    getBoard: { useQuery: () => ({ data: { status: 'available', defaultCollectionName: '默认研究观察池', collections: [{ id: 7, name: '科技重点池', description: null }], collectionLayouts: [], layout: null, items: [{ id: 1, collectionId: null, itemType: 'stock', symbol: 'AAPL', displayName: 'AAPL 股票研究观察', optionSide: null, expiryDays: null, updatedAt: new Date('2026-08-20') }, { id: 2, collectionId: null, itemType: 'stock', symbol: 'MSFT', displayName: 'MSFT 股票研究观察', optionSide: null, expiryDays: null, updatedAt: new Date('2026-08-21') }, { id: 3, collectionId: 7, itemType: 'stock', symbol: 'NVDA', displayName: 'NVDA 股票研究观察', optionSide: null, expiryDays: null, updatedAt: new Date('2026-08-22') }], sourceBoundary: '仅保存研究偏好。' }, isLoading: false, isError: false }) },
    createCollection: { useMutation: (options: { onSuccess?: (result: { status: string; collectionId: number | null; sourceBoundary: string }) => void }) => ({ mutate: (input: unknown) => { spies.create(input); options.onSuccess?.({ status: 'available', collectionId: 8, sourceBoundary: '仅保存研究偏好。' }); }, isPending: false }) },
    renameCollection: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    deleteCollection: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    addItem: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    removeItem: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    reorderItems: { useMutation: (options: { onSuccess?: (result: { status: string; sourceBoundary: string }) => void }) => ({ mutate: (input: unknown) => { spies.reorder(input); options.onSuccess?.({ status: 'available', sourceBoundary: '仅保存研究偏好。' }); }, isPending: false }) },
    saveLayout: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
  },
} }));

describe('股票与 NCEO 研究屏风', () => {
  afterEach(() => { cleanup(); spies.create.mockClear(); spies.reorder.mockClear(); });

  it('switches named pools, creates a named pool, persists default-pool order, and returns a stock item to the cockpit', () => {
    const onSelectStock = vi.fn();
    render(<StockNCEOResearchWatchboard symbol="AAPL" leg="call" onSelectStock={onSelectStock} onOpenNceo={vi.fn()} />);
    expect(screen.getByText('默认研究观察池')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '下移 AAPL 股票研究观察' }));
    expect(spies.reorder).toHaveBeenCalledWith({ collectionId: null, itemIds: [2, 1] });
    fireEvent.click(screen.getByRole('button', { name: '科技重点池' }));
    fireEvent.click(screen.getByText('NVDA 股票研究观察'));
    expect(onSelectStock).toHaveBeenCalledWith('NVDA');
    fireEvent.click(screen.getByRole('button', { name: '新建池' }));
    fireEvent.change(screen.getByLabelText('观察池名称'), { target: { value: '成长研究池' } });
    fireEvent.click(screen.getByRole('button', { name: '创建并切换' }));
    expect(spies.create).toHaveBeenCalledWith({ name: '成长研究池', description: null });
  });
});
