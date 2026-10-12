/* @vitest-environment jsdom */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import FTWPanel from '../client/src/components/FTWPanel';

const runtime = vi.hoisted(() => ({
  search: null as any, facts: null as any, input: null as any, options: null as any,
  refetchSearch: vi.fn(), refetchFacts: vi.fn(),
}));
vi.mock('../client/src/lib/trpc', () => ({ trpc: { stockMarketResearch: {
  searchIssuers: { useQuery: () => ({ ...runtime.search, refetch: runtime.refetchSearch }) },
  getCompanyFacts: { useQuery: (input: any, options: any) => {
    runtime.input = input; runtime.options = options;
    return { ...runtime.facts, refetch: runtime.refetchFacts };
  } },
} } }));
vi.mock('recharts', async () => {
  const original = await vi.importActual<typeof import('recharts')>('recharts');
  return { ...original, ResponsiveContainer: ({ children }: { children: React.ReactElement }) => React.cloneElement(children as React.ReactElement<any>, { width: 640, height: 300 }) };
});
vi.mock('react-resizable-panels', () => vi.importActual('../node_modules/react-resizable-panels/dist/react-resizable-panels.browser.development.js'));
Object.defineProperty(window, 'matchMedia', { writable: true, value: () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }) });
vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });

beforeEach(() => {
  runtime.search = { data: { status: 'unavailable', results: [], sourceBoundary: '当前无法读取 SEC 主体目录；系统不显示示例主体。' }, isFetching: false, isError: false };
  runtime.facts = { data: { sourceStatus: 'unavailable', metrics: [], issuer: null, sourceBoundary: '当前无法读取 SEC XBRL 公司事实。' }, isFetching: false, isError: false };
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('FTW source recovery and numeric CIK access', () => {
  it('distinguishes unavailable directory from an empty match and retries the actual query', () => {
    render(<FTWPanel />);
    expect(screen.getByRole('status').textContent).toContain('无法读取 SEC 主体目录');
    expect(screen.getByRole('status').textContent).not.toContain('没有匹配');
    fireEvent.click(screen.getByRole('button', { name: '重试主体目录' }));
    expect(runtime.refetchSearch).toHaveBeenCalledOnce();
    expect((screen.getByRole('button', { name: '按CIK读取事实' }) as HTMLButtonElement).disabled).toBe(true);
  });
  it('reads only the explicit valid CIK without a successful directory response or ticker inference', () => {
    render(<FTWPanel />);
    fireEvent.change(screen.getByLabelText('FTW SEC 主体'), { target: { value: '320193' } });
    fireEvent.click(screen.getByRole('button', { name: '按CIK读取事实' }));
    expect(runtime.input).toEqual({ cik: '0000320193' }); expect(runtime.options.enabled).toBe(true);
    expect(screen.getByRole('status').textContent).toContain('无法读取 SEC XBRL 公司事实');
    fireEvent.click(screen.getByRole('button', { name: '刷新年度事实' })); expect(runtime.refetchFacts).toHaveBeenCalledOnce();
    expect(runtime.refetchSearch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '更换主体' }));
    for (const value of ['0', '0000000000', '3201931x', '12345678901']) {
      fireEvent.change(screen.getByLabelText('FTW SEC 主体'), { target: { value } });
      expect((screen.getByRole('button', { name: '按CIK读取事实' }) as HTMLButtonElement).disabled).toBe(true);
    }
    fireEvent.change(screen.getByLabelText('FTW SEC 主体'), { target: { value: '1' } });
    fireEvent.keyDown(screen.getByLabelText('FTW SEC 主体'), { key: 'Enter' });
    expect(runtime.input).toEqual({ cik: '0000000001' });
  });
  it('shows genuine empty directory search distinctly and keeps transport errors readable', () => {
    runtime.search.data = { status: 'available', results: [] };
    const view = render(<FTWPanel />);
    expect(screen.getByRole('status').textContent).toContain('已读取，但没有匹配结果');
    runtime.search = { ...runtime.search, isError: true, error: { message: 'NETWORK_FAILURE' } };
    view.rerender(<FTWPanel />); expect(screen.getByRole('status').textContent).toContain('NETWORK_FAILURE');
  });
  it('keeps numerical evidence hidden after a failed refresh rather than marking cached ratios current', () => {
    const observation = { start: '2024-01-01', end: '2024-12-31', value: 100, periodType: 'annual', accessionNumber: '2025-001', filed: '2025-02-01', form: '10-K' };
    runtime.facts.data = { sourceStatus: 'available', issuer: { cik: '0000000001', name: 'Fixture from SEC' }, metrics: [
      { id: 'RevenueFromContractWithCustomerExcludingAssessedTax', unit: 'USD', observations: [observation] },
      { id: 'NetIncomeLoss', unit: 'USD', observations: [{ ...observation, value: 20 }] },
    ] };
    const view = render(<FTWPanel />);
    fireEvent.change(screen.getByLabelText('FTW SEC 主体'), { target: { value: '1' } }); fireEvent.click(screen.getByRole('button', { name: '按CIK读取事实' }));
    expect(screen.getByRole('columnheader', { name: '净利率%' })).toBeTruthy();
    expect(screen.getByText(/Fixture from SEC/)).toBeTruthy();
    runtime.facts.isError = true; runtime.facts.error = { message: 'FACT_REFRESH_FAILED' };
    view.rerender(<FTWPanel />);
    expect(screen.queryByRole('columnheader', { name: '净利率%' })).toBeNull();
    expect(screen.getByRole('status').textContent).toContain('FACT_REFRESH_FAILED');
  });
});
