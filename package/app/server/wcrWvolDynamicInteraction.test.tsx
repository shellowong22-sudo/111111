// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import WCRPanel from '../client/src/components/WCRPanel';
import WVOLPanel from '../client/src/components/WVOLPanel';

vi.mock('@/components/forex/DynamicFxInstrumentChart', () => ({
  DynamicFxInstrumentChart: ({ instrument }: { instrument: string }) => <div data-testid="dynamic-fx-chart">动态模拟图：{instrument}</div>,
}));

vi.mock('recharts', () => {
  const Shape = () => null;
  const Container = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return { ResponsiveContainer: Container, BarChart: Shape, Bar: Shape, Cell: Shape, CartesianGrid: Shape, Tooltip: Shape, XAxis: Shape, YAxis: Shape };
});

vi.stubGlobal('ResizeObserver', class {
  observe() {}
  unobserve() {}
  disconnect() {}
});

describe('WCR and WVOL dynamic interactions', () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('opens a WCR dynamic chart from a row or the view command and exports the current dynamic table', () => {
    render(<WCRPanel />);
    fireEvent.click(screen.getByRole('button', { name: '96) 视图' }));
    expect(screen.getByTestId('dynamic-fx-chart').textContent).toContain('EUR/CHF');
  });

  it('opens a WVOL dynamic risk-path chart from the view command and preserves explicit simulation status', () => {
    render(<WVOLPanel />);
    fireEvent.click(screen.getByRole('button', { name: '96) 视图' }));
    expect(screen.getByTestId('dynamic-fx-chart').textContent).toContain('WVOL-');
    expect(screen.getAllByText(/非真实隐含波动率/).length).toBeGreaterThan(0);
  });
});
