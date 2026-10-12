// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DynamicCurrencyRankBoard } from '../client/src/components/forex/DynamicCurrencyRankBoard';
import { ForexDynamicResearchDesk } from '../client/src/components/forex/ForexDynamicResearchDesk';

vi.mock('@/components/forex/DynamicFxInstrumentChart', () => ({
  DynamicFxInstrumentChart: ({ instrument, title }: { instrument: string; title: string }) => <div data-testid="dynamic-fx-chart">{title} · {instrument}</div>,
}));
vi.mock('@/lib/trpc', () => ({
  trpc: { forexResearch: { getPublicReferenceRates: { useQuery: () => ({ data: { asOf: '2026-08-26', readings: [{ pair: 'EUR/USD' }] }, isLoading: false, error: null }) } } },
}));

describe('advanced forex workspaces', () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('keeps WCRS as a simulated ranking with a selectable chart detail', () => {
    render(<DynamicCurrencyRankBoard />);
    expect(screen.getByText(/动态模拟行情 · 非真实市场数据/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '1Y' }));
    expect(screen.getByTestId('dynamic-fx-chart').textContent).toContain('WCRS-');
  });

  it('switches RES and MARS FX research tracks without presenting them as execution', () => {
    const { rerender } = render(<ForexDynamicResearchDesk code="RES" />);
    fireEvent.click(screen.getByRole('button', { name: /利差与套息敏感度/ }));
    expect(screen.getByTestId('dynamic-fx-chart').textContent).toContain('USD/JPY');
    expect(screen.getByText(/非真实市场数据 · 非投资建议/)).toBeTruthy();
    expect(screen.getByText(/公开日频来源可用/)).toBeTruthy();
    rerender(<ForexDynamicResearchDesk code="MARS FX" />);
    expect(screen.getByTestId('dynamic-fx-chart').textContent).toContain('MARS FX');
  });
});
