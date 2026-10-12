/* @vitest-environment jsdom */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import StockFactorLabWorkspace, { buildFactorRegression, factorChangeUnit, type FactorSeries } from '../client/src/components/stock/StockFactorLabWorkspace';

const runtime = vi.hoisted(() => ({ data: null as any, error: false, loading: false, refetch: vi.fn(), options: null as any }));
vi.mock('../client/src/lib/trpc', () => ({ trpc: { stockMarketResearch: { getEnvironment: { useQuery: (_input: unknown, options: unknown) => {
  runtime.options = options; return { data: runtime.data, isLoading: runtime.loading, isFetching: false, isError: runtime.error, refetch: runtime.refetch };
} } } } }));
// Only responsive measurement is fixed for jsdom; chart and click logic remains real.
vi.mock('recharts', async () => {
  const original = await vi.importActual<typeof import('recharts')>('recharts');
  return { ...original, ResponsiveContainer: ({ children }: { children: React.ReactElement }) => React.cloneElement(children as React.ReactElement<any>, { width: 640, height: 300 }) };
});
vi.mock('react-resizable-panels', () => vi.importActual('../node_modules/react-resizable-panels/dist/react-resizable-panels.browser.development.js'));
Object.defineProperty(window, 'matchMedia', { writable: true, value: () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }) });

const history = (values: number[]) => values.map((value, index) => ({ date: '2026-01-' + String(index + 1).padStart(2, '0'), value }));
const series = (id: string, values: number[], group = 'equity', unit = 'index_points'): FactorSeries => ({ id, label: id,
  group, unit, source: 'FRED', status: 'available', observationDate: '2026-01-05', history: history(values) });
const x = () => series('DGS10', [4, 4.01, 4.03, 4.06, 4.10], 'rates', '%');
const y = () => series('SP500', [100, 102, 106, 112, 120]);
const defaults = { xTransform: 'change' as const, yTransform: 'change' as const, lag: 0, sampleWindow: null };

beforeEach(() => {
  runtime.data = { retrievedAt: '2026-01-06T12:00:00Z', series: [y(), x(), series('VIXCLS', [10, 12, 15, 14, 19], 'volatility', '%'), series('BAMLH0A0HYM2', [3, 3.04, 3.02, 3.01, 3.06], 'credit', '%')] };
});
afterEach(() => { cleanup(); runtime.data = null; runtime.error = false; runtime.loading = false; vi.clearAllMocks(); });

describe('FACTOR LAB shared-date OLS and units', () => {
  it('regresses shared-interval changes, converts percent rates to bps and retains all raw endpoints', () => {
    const result = buildFactorRegression(x(), y(), defaults);
    expect(result.count).toBe(4);
    expect(result.beta).toBeCloseTo(2, 9);
    expect(result.alpha).toBeCloseTo(0, 9);
    expect(result.rSquared).toBeCloseTo(1, 9);
    expect(result.rmse).toBeCloseTo(0, 9);
    expect(result.xUnit).toBe('bp'); expect(result.yUnit).toBe('指数点');
    expect(result.samples[0]).toMatchObject({ xStart: '2026-01-01', xEnd: '2026-01-02', yStart: '2026-01-01', yEnd: '2026-01-02', xPrevious: 4, xCurrent: 4.01, yPrevious: 100, yCurrent: 102 });
    expect(result.samples[0].x).toBeCloseTo(1); expect(result.samples[0].y).toBe(2);
    expect(factorChangeUnit(x(), 'relative')).toBe('%');
    expect(buildFactorRegression({ ...x(), unit: 'unknown' }, y(), defaults).beta).toBeNull();
  });

  it('aligns lagged X strictly before Y and never shifts across gaps', () => {
    const lagged = buildFactorRegression(x(), series('SP500', [100, 150, 152, 156, 162]), { ...defaults, lag: 1 });
    expect(lagged.count).toBe(3); expect(lagged.beta).toBeCloseTo(2, 9); expect(lagged.rSquared).toBeCloseTo(1);
    expect(lagged.samples[0]).toMatchObject({ xEnd: '2026-01-02', yStart: '2026-01-02', yEnd: '2026-01-03' });
    expect(lagged.samples.every(sample => sample.xEnd <= sample.yStart)).toBe(true);
    const gap = buildFactorRegression(series('X', [1, 2, 4, 7, 11, 16]), { ...series('Y', [3, 5, 9, 15, 23, 33]), history: history([3, 5, 9, 15, 23, 33]).filter(row => row.date !== '2026-01-03') }, { ...defaults, lag: 1 });
    expect(gap.missingLagIntervals).toBe(1); expect(gap.count).toBe(1); expect(gap.beta).toBeNull();
  });

  it('does not turn stationary raw levels, zero variance or too few observations into a model', () => {
    expect(buildFactorRegression(series('X', [1, 2, 3, 4]), series('Y', [10, 20, 30, 40]), defaults).beta).toBeNull();
    expect(buildFactorRegression(series('X', [1, 2, 4]), series('Y', [10, 20, 40]), defaults).rSquared).toBeNull();
    expect(buildFactorRegression(x(), x(), defaults).samples).toEqual([]);
    expect(buildFactorRegression({ ...x(), status: 'unavailable' }, y(), defaults).samples).toEqual([]);
    const constant = buildFactorRegression(x(), series('SP500', [10, 11, 12, 13, 14]), defaults);
    expect(constant.beta).toBeCloseTo(0); expect(constant.rSquared).toBeNull();
  });

  it('removes conflicting observations and rejects nonpositive relative-change denominators', () => {
    const conflict = { ...x(), history: [...history([4, 4.01, 4.03, 4.06, 4.10]), { date: '2026-01-03', value: 8 }] };
    expect(buildFactorRegression(conflict, y(), defaults).count).toBe(2);
    const relative = buildFactorRegression(series('X', [0, 1, 3, 6, 10]), y(), { ...defaults, xTransform: 'relative' });
    expect(relative.count).toBe(3);
    expect(relative.samples[0].x).toBeCloseTo(200);
    expect(relative.samples.every(row => Number.isFinite(row.x))).toBe(true);
  });

  it('uses the selected trailing sample window and records residuals from OLS only', () => {
    const result = buildFactorRegression(x(), series('SP500', [100, 103, 110, 111, 120]), { ...defaults, sampleWindow: 3 });
    expect(result.count).toBe(3); expect(result.samples[0].yStart).toBe('2026-01-02');
    expect(result.samples.reduce((sum, row) => sum + (row.residual ?? 0), 0)).toBeCloseTo(0, 9);
    expect(result.rSquared).toBeGreaterThanOrEqual(0); expect(result.rSquared).toBeLessThanOrEqual(1);
  });
});

describe('FACTOR LAB real component interactions', () => {
  it('changes transforms, selected variables and lag; exposes source-aligned rows and selectable diagnostics', () => {
    render(<StockFactorLabWorkspace />);
    expect(screen.getByLabelText('FACTOR LAB 有效样本').textContent).toBe('4');
    fireEvent.change(screen.getByLabelText('FACTOR LAB Y变换'), { target: { value: 'change' } });
    expect(screen.getByLabelText('FACTOR LAB Beta').textContent).toBe('2.0000');
    expect(screen.getByLabelText('FACTOR LAB R平方').textContent).toBe('1.0000');
    expect(screen.getByRole('columnheader', { name: 'Beta · 指数点/bp' })).toBeTruthy();
    const rows = within(screen.getByRole('table', { name: 'FACTOR LAB 样本明细' })).getAllByRole('row');
    fireEvent.click(rows[1]); expect(rows[1].getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText(/已选样本 Y 2026-01-01/)).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: '残差诊断' }));
    expect(screen.getByRole('tabpanel', { name: '按观测日期残差诊断' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('FACTOR LAB 滞后区间'), { target: { value: '1' } });
    expect(screen.getByLabelText('FACTOR LAB 有效样本').textContent).toBe('3');
    fireEvent.change(screen.getByLabelText('FACTOR LAB 因变量'), { target: { value: 'DGS10' } });
    expect(screen.getByText(/请选择不同的因变量与解释变量/)).toBeTruthy();
    expect(screen.queryByRole('table', { name: 'FACTOR LAB 样本明细' })).toBeNull();
    expect(runtime.options.refetchInterval).toBe(60000);
  });

  it('recomputes when the backend history changes and does not display old regressions on a failed request', () => {
    const mounted = render(<StockFactorLabWorkspace />);
    fireEvent.change(screen.getByLabelText('FACTOR LAB Y变换'), { target: { value: 'change' } });
    expect(screen.getByLabelText('FACTOR LAB Beta').textContent).toBe('2.0000');
    runtime.data = { ...runtime.data, series: [series('SP500', [100, 103, 109, 118, 130]), x()] };
    mounted.rerender(<StockFactorLabWorkspace />);
    expect(screen.getByLabelText('FACTOR LAB Beta').textContent).toBe('3.0000');
    runtime.error = true; mounted.rerender(<StockFactorLabWorkspace />);
    expect(screen.getByRole('alert').textContent).toContain('停止输出回归结果');
    expect(screen.queryByRole('table', { name: '单因子回归统计' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '重新读取 FRED' }));
    expect(runtime.refetch).toHaveBeenCalledOnce();
  });

  it('exports raw observation periods, transformations, units, source and sample fit without generated prices', () => {
    const create = vi.fn((_blob: Blob) => 'blob:factor-lab-test'), revoke = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: create });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revoke });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<StockFactorLabWorkspace />);
    fireEvent.click(screen.getByRole('button', { name: '导出样本' }));
    expect(create).toHaveBeenCalledOnce(); expect(create.mock.calls[0][0]).toBeInstanceOf(Blob);
    expect(click).toHaveBeenCalledOnce(); expect(revoke).toHaveBeenCalledWith('blob:factor-lab-test');
    click.mockRestore();
  });
});
