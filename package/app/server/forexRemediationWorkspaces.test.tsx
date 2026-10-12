// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { BFIXSourceStatusWorkbench, FXAllQuotesVisualWorkbench, FXControlWatchWorkbench, FXConventionFieldWorkbench, FXForecastScenarioWorkbench, FXHeadlineEvidenceWorkbench, FXIndustrySensitivityWorkbench, FXInformationReadingWorkbench, FXOptionSensitivityWorkbench, FXShockEventWorkbench, FXStrategyScenarioWorkbench, FXTransmissionPreviewWorkbench } from '../client/src/components/forex/ForexRemediationWorkspaces';
import { ALLQPanel, BFIXPanel, ECMIPanel, FXFAPanel, FXIPPanel, FRDPanel, STNIPanel, XDSHPanel } from '../client/src/components/ForexExtPanels';
import { FXIndustryCoverageWorkspace, FXTopNewsWorkspace } from '../client/src/components/forex/ForexRestoredWorkspaces';
import FIRSPanel from '../client/src/components/FIRSPanel';
import FXFCPanel from '../client/src/components/FXFCPanel';
import FXSWPanel from '../client/src/components/FXSWPanel';
import WCRSPanel from '../client/src/components/WCRSPanel';
import FXCPanel from '../client/src/components/FXCPanel';
import GMMPanel from '../client/src/components/GMMPanel';

vi.mock('@/lib/trpc', () => ({
  trpc: {
    useUtils: () => ({ forexResearch: { getPublicReferenceRates: { fetch: vi.fn(), setData: vi.fn() } } }),
    forexResearch: {
      getPublicReferenceRates: {
        useQuery: () => ({ data: { asOf: '2026-08-21', readings: ['EUR/USD', 'USD/JPY', 'GBP/USD', 'USD/CAD', 'AUD/USD'].map((pair, index) => ({ pair, base: pair.split('/')[0], quote: pair.split('/')[1], label: pair, dataMode: 'public_daily', status: 'available', rate: 1.09 + index / 100, previousRate: 1.08 + index / 100, changePct: index % 2 ? -0.12 : 0.16, observationDate: '2026-08-21', history: [{ date: '2026-08-20', value: 1.08 + index / 100 }, { date: '2026-08-21', value: 1.09 + index / 100 }] })) }, isLoading: false, isError: false }),
      },
      getModuleStudy: { useQuery: () => ({ data: { readings: [{ id: 'DGS10', label: '美国国债 10 年期', unit: '%', value: 4.2, observationDate: '2026-08-21', history: [{ date: '2026-08-20', value: 4.1 }, { date: '2026-08-21', value: 4.2 }] }, { id: 'DGS2', label: '美国国债 2 年期', unit: '%', value: 3.8, observationDate: '2026-08-21', history: [{ date: '2026-08-20', value: 3.7 }, { date: '2026-08-21', value: 3.8 }] }, { id: 'DFF', label: '有效联邦基金利率', unit: '%', value: 4.1, observationDate: '2026-08-21', history: [{ date: '2026-08-20', value: 4.05 }, { date: '2026-08-21', value: 4.1 }] }, { id: 'DTWEXBGS', label: '名义广义美元指数', unit: '2006=100', value: 120, observationDate: '2026-08-21', history: [{ date: '2026-08-20', value: 119.8 }, { date: '2026-08-21', value: 120 }] }] }, isLoading: false, error: null, refetch: vi.fn() }) },
    },
    sovereignBonds: {
      getMultipleRateSeries: { useQuery: () => ({ data: { data: { DGS10: { name: 'US 10Y', latest: 4.2, data: [{ date: '2026-08-20', value: 4.1 }, { date: '2026-08-21', value: 4.2 }] }, DGS2: { name: 'US 2Y', latest: 3.8, data: [{ date: '2026-08-20', value: 3.7 }, { date: '2026-08-21', value: 3.8 }] }, SOFR: { name: 'SOFR', latest: 4.1, data: [{ date: '2026-08-20', value: 4.05 }, { date: '2026-08-21', value: 4.1 }] } } }, isLoading: false, error: null, refetch: vi.fn() }) },
      getGlobalBondETFs: { useQuery: () => ({ data: { data: [{ symbol: 'IGOV', name: '全球国债代理', price: 40, changePct: 0.2, history: [{ date: '2026-08-20', close: 39.8 }, { date: '2026-08-21', close: 40 }] }] }, isLoading: false, error: null, refetch: vi.fn() }) },
      getCreditSpreadETFs: { useQuery: () => ({ data: { data: [{ symbol: 'LQD', name: '信用代理', price: 100, changePct: -0.1, history: [{ date: '2026-08-20', close: 100.1 }, { date: '2026-08-21', close: 100 }] }] }, isLoading: false, error: null, refetch: vi.fn() }) },
    },
  },
}));

vi.mock('@/components/forex/DynamicFxInstrumentChart', () => ({
  DynamicFxInstrumentChart: ({ instrument, title }: { instrument: string; title: string }) => <div data-testid="dynamic-detail">{title} · {instrument}</div>,
}));
vi.mock('recharts', () => {
  const Container = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  const Shape = () => null;
  return { ResponsiveContainer: Container, AreaChart: Shape, LineChart: Shape, BarChart: Shape, Area: Shape, Line: Shape, Bar: Shape, Cell: Shape, CartesianGrid: Shape, Tooltip: Shape, XAxis: Shape, YAxis: Shape, Legend: Shape, ReferenceLine: Shape };
});

describe('forex screenshot remediation workspaces', () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('changes forecast scenarios and provides explicit seconds-through-years controls', () => {
    render(<FXForecastScenarioWorkbench />);
    fireEvent.click(screen.getByRole('button', { name: '上行偏移' }));
    fireEvent.click(screen.getByRole('button', { name: '1 年' }));
    expect(screen.getByText('情景中枢')).toBeTruthy();
    expect(screen.getByText(/动态模拟资料 · 非真实市场数据/)).toBeTruthy();
  });

  it('opens real in-terminal details from control and all-quote selections', () => {
    const { rerender } = render(<FXControlWatchWorkbench />);
    fireEvent.click(screen.getAllByRole('button', { name: /USD\/CNY/ })[0]);
    expect(screen.getByTestId('dynamic-detail').textContent).toContain('XDSH');
    rerender(<FXAllQuotesVisualWorkbench />);
    fireEvent.click(screen.getAllByRole('button', { name: '打开站内详情' })[1]);
    expect(screen.getByTestId('dynamic-detail').textContent).toContain('ALLQ');
  });

  it('keeps strategy and option calculations as non-executable user-input scenarios', () => {
    const { rerender } = render(<FXStrategyScenarioWorkbench />);
    fireEvent.change(screen.getByLabelText('风险阈值'), { target: { value: '0.002' } });
    expect(screen.getByText(/不创建订单、不路由订单/)).toBeTruthy();
    rerender(<FXOptionSensitivityWorkbench />);
    fireEvent.change(screen.getByLabelText('模拟权利金'), { target: { value: '0.02' } });
    expect(screen.getByText(/不代表市场波动率、期权报价/)).toBeTruthy();
  });

  it('exposes FXTF code fields and routes their research path through the same visible timeframe controls', () => {
    render(<FXConventionFieldWorkbench />);
    fireEvent.click(screen.getByRole('button', { name: 'USDCNY' }));
    fireEvent.click(screen.getByRole('button', { name: '1 天' }));
    expect(screen.getByText('USDCNY 代码字段覆盖')).toBeTruthy();
    expect(screen.getByTestId('dynamic-detail').textContent).toContain('FXTF-USDCNY');
  });

  it('switches research reading, industry and transmission state without third-party navigation', () => {
    const { rerender } = render(<FXInformationReadingWorkbench />);
    fireEvent.click(screen.getByRole('button', { name: '亚洲' }));
    expect(screen.getByText('风险切片研究摘要')).toBeTruthy();
    rerender(<FXIndustrySensitivityWorkbench />);
    fireEvent.click(screen.getByRole('button', { name: '能源' }));
    expect(screen.getByText(/能源 驱动敏感度/)).toBeTruthy();
    rerender(<FXTransmissionPreviewWorkbench />);
    fireEvent.click(screen.getByLabelText('研究复核开关'));
    expect(screen.getByText(/不发送邮件，不声称实时推送/)).toBeTruthy();
  });

  it('opens a preserved FXIP news card as an in-terminal reading state instead of a toast-only action', () => {
    render(<FXIPPanel />);
    fireEvent.click(screen.getByRole('button', { name: '外汇新闻' }));
    fireEvent.click(screen.getByRole('button', { name: /美联储官员暗示年内降息次数/ }));
    expect(screen.getByText(/归档资料详情/)).toBeTruthy();
    expect(screen.getByText(/不会补写新闻事实、假造全文/)).toBeTruthy();
  });

  it('keeps complete topic reading and its specific observation graph in the TOP FX original area', () => {
    render(<FXTopNewsWorkspace />);
    fireEvent.click(screen.getByRole('button', { name: /TOP-02/ }));
    expect(screen.getAllByText('周度专题提纲').length).toBeGreaterThan(1);
    expect(screen.getByText(/终端内完整资料阅读/)).toBeTruthy();
    expect(screen.getByText(/USD\/JPY 公开日频观察/)).toBeTruthy();
  });

  it('changes the original BICO industry relation cards and their observation chart together', () => {
    render(<FXIndustryCoverageWorkspace />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '能源' } });
    fireEvent.click(screen.getByRole('button', { name: /USD\/CAD/ }));
    expect(screen.getByText('能源 · USD/CAD 数据观察')).toBeTruthy();
    expect(screen.getAllByText(/资源结算与贸易资料/).length).toBeGreaterThan(1);
  });

  it('restores FIRS and expands a preserved news record with a source-labelled inline observation', () => {
    render(<FIRSPanel />);
    fireEvent.click(screen.getByText(/美元指数DXY跌至104.2/));
    expect(screen.getByText(/关联数据观察：EUR\/USD/)).toBeTruthy();
    expect(screen.getByText(/完整保留归档中的时间、地区、类别、优先级、代码与标题字段/)).toBeTruthy();
  });

  it('keeps XDSH and ECMI detail interactions inside their original panels', () => {
    const { rerender } = render(<XDSHPanel />);
    fireEvent.click(screen.getAllByRole('button', { name: /EUR\/USD/ })[0]);
    expect(screen.getByText('EUR/USD 控制面板详情')).toBeTruthy();
    rerender(<ECMIPanel />);
    fireEvent.click(screen.getAllByText('美国非农就业人数超预期')[0]);
    expect(screen.getByText('记录变动：+0.5600')).toBeTruthy();
  });

  it('keeps FXFC public daily reference history inside the original forecast panel', () => {
    render(<FXFCPanel onClose={() => undefined} />);
    expect(screen.getByText(/原机构预测展示字段保留/)).toBeTruthy();
    fireEvent.click(screen.getByText('GBP/USD'));
    expect(screen.getByText('GBP/USD 预测字段与公开日频对照')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '历史走势' }));
    expect(screen.getByText(/公开日频参考走势/)).toBeTruthy();
  });

  it('keeps GMM proxy row selection and source-backed history inside the original driver panel', () => {
    render(<GMMPanel />);
    fireEvent.click(screen.getByText('IGOV'));
    expect(screen.getByText('IGOV 公开代理走势')).toBeTruthy();
    expect(screen.getByText(/不生成宏观预测或交易信号/)).toBeTruthy();
  });

  it('keeps ALLQ cross-rate detail in the original quote list', () => {
    render(<ALLQPanel />);
    fireEvent.click(screen.getByRole('button', { name: '列表' }));
    fireEvent.click(screen.getByText('USD/EUR'));
    expect(screen.getByText('USD/EUR 交叉报价详情')).toBeTruthy();
  });

  it('keeps FXSW observation and non-executable action state in the original strategy panel', () => {
    render(<FXSWPanel />);
    expect(screen.getByTestId('dynamic-detail').textContent).toContain('观察路径');
    fireEvent.click(screen.getByRole('button', { name: '买入 / BUY' }));
    expect(screen.getByText(/买入操作未执行/)).toBeTruthy();
  });

  it('keeps WCRS public-daily ranking and selected trend inside the original rate panel', () => {
    render(<WCRSPanel onClose={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: '货币排行' }));
    expect(screen.getByText('公开日频变动排行')).toBeTruthy();
    fireEvent.click(screen.getByText('EUR/USD'));
    expect(screen.getByText('EUR/USD 公开日频详情')).toBeTruthy();
  });

  it('keeps FXC cross-matrix selection and public-daily detail inside the original matrix', () => {
    render(<FXCPanel />);
    fireEvent.click(screen.getByRole('button', { name: '列表' }));
    fireEvent.click(screen.getByText('USD/EUR'));
    expect(screen.getByText('USD/EUR 公开日频详情')).toBeTruthy();
  });

  it('keeps FRD curve and FXFA sensitivity calculation in their original calculators', () => {
    const { rerender } = render(<FRDPanel />);
    expect(screen.getByText(/远期曲线（USD\/JPY）/)).toBeTruthy();
    rerender(<FXFAPanel />);
    expect(screen.getByText(/远期偏移敏感度（USD\/JPY）/)).toBeTruthy();
    expect(screen.getByText(/不构成可执行套利、报价或交易建议/)).toBeTruthy();
  });

  it('keeps BFIX authorization boundary and comparison detail in the original pricing panel', () => {
    render(<BFIXPanel />);
    expect(screen.getByText(/本终端未配置许可数据源/)).toBeTruthy();
    fireEvent.click(screen.getAllByText('EUR/USD')[0]);
    expect(screen.getByText('EUR/USD 定价授权与公开对照')).toBeTruthy();
    expect(screen.getByText('BFIX 授权源未配置')).toBeTruthy();
  });

  it('keeps STNI actions in session state and does not claim external delivery', () => {
    render(<STNIPanel />);
    fireEvent.change(screen.getByPlaceholderText('添加新闻订阅主题...'), { target: { value: '政策资料复核' } });
    fireEvent.click(screen.getByRole('button', { name: '添加' }));
    expect(screen.getByText(/仅本终端会话内预览 · 未传输/)).toBeTruthy();
    expect(screen.getByText(/不发送邮件、消息或任何外部通知/)).toBeTruthy();
  });

  it('keeps shock, headline and BFIX source state explicit instead of fabricating live data', () => {
    const { rerender } = render(<FXShockEventWorkbench />);
    fireEvent.click(screen.getByRole('button', { name: /商品价格跳变/ }));
    expect(screen.getByText('冲击强度与衰减')).toBeTruthy();
    rerender(<FXHeadlineEvidenceWorkbench />);
    fireEvent.click(screen.getByRole('button', { name: '突发' }));
    expect(screen.getByText('交叉盘波动切片')).toBeTruthy();
    rerender(<BFIXSourceStatusWorkbench />);
    fireEvent.click(screen.getByRole('button', { name: '查看来源说明' }));
    expect(screen.getByText(/不会用 H\.10、动态模拟或任意参考值替代/)).toBeTruthy();
  });
});
