import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
/* @vitest-environment jsdom */
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import ResearchModuleWorkspace from '../client/src/components/ResearchModuleWorkspace';
import PSCHPanel, { buildPschCashflows, parsePschQuotes } from '../client/src/components/PSCHPanel';
import * as pfPanels from '../client/src/components/pf/PFPanels1';
import { PREFERRED_STOCK_CAPABILITIES } from '../shared/threeModuleCapabilityCatalog';
import { solvePreferredAnnualYield } from '../client/src/components/preferredstock/PreferredCapabilityAnalysisTool';

const runtime = vi.hoisted(() => ({ authenticated: false, rows: [] as any[], refetch: vi.fn() }));
vi.mock('../client/src/_core/hooks/useAuth', () => ({ useAuth: () => ({ isAuthenticated: runtime.authenticated }) }));
vi.mock('../client/src/components/ChartEnhancements', () => ({ EnhancedTooltip: () => null, CustomCursor: () => null }));
vi.mock('../client/src/components/ui/resizable', () => ({
  ResizablePanelGroup: ({ children }: any) => React.createElement('div', null, children),
  ResizablePanel: ({ children }: any) => React.createElement('div', null, children),
  ResizableHandle: () => React.createElement('hr'),
}));
vi.mock('../client/src/lib/trpc', () => ({ trpc: { preferredStockResearch: {
  listTerms: { useQuery: () => ({ data: runtime.rows, isLoading: false, isFetching: false, isError: false, dataUpdatedAt: 0, refetch: runtime.refetch }) },
  searchIssuers: { useQuery: () => ({ data: { results: [], status: 'available' }, isFetching: false }) },
  getIssuerFilings: { useQuery: () => ({ data: { filings: [], issuer: null, sourceStatus: 'available' }, isFetching: false, refetch: runtime.refetch }) },
  getFilingExcerpt: { useQuery: () => ({ data: null, isFetching: false }) },
} } }));
Object.defineProperty(window, 'matchMedia', { writable: true, value: () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }) });
afterEach(() => { cleanup(); runtime.authenticated = false; runtime.rows = []; localStorage.clear(); vi.clearAllMocks(); });

const root = resolve(import.meta.dirname, '..');
describe('preferred stock original-content protection', () => {
  it('preserves the existing analysis-tool exports while allowing the instructed menu and data-layer correction', () => {
    expect(Object.keys(pfPanels).sort()).toEqual(['PFSECFPanel', 'PFPSCHPanel', 'PFWBPanel', 'PFWEIPanel', 'PFFITPanel', 'PFQFMPanel'].sort());
    Object.values(pfPanels).forEach(panel => expect(typeof panel).toBe('function'));
    expect(PREFERRED_STOCK_CAPABILITIES).toHaveLength(23);
  });

  it('renders exactly 23 catalog-driven menu entries and one active workspace at a time', () => {
    const menu = readFileSync(resolve(root, 'client/src/components/PreferredStockMenu.tsx'), 'utf8');
    const terminal = readFileSync(resolve(root, 'client/src/pages/Terminal.tsx'), 'utf8');
    expect(menu).toContain('PREFERRED_STOCK_CAPABILITIES.slice');
    expect(menu).toContain('column.map');
    expect(menu).not.toContain('const preferredStockItems');
    expect((terminal.match(/<PreferredStockPreservedModule moduleId=/g) ?? [])).toHaveLength(23);
    expect(terminal).toContain("const winId = `pf-${normalizedItemId}`");
    expect(terminal).toContain('setWindows([{ id: winId');
    expect(terminal).toContain("requestedModule === 'preferred-stock'");
  });

  it('does not retain hidden preferred-stock routes outside the frozen 23 capabilities', () => {
    const terminal = readFileSync(resolve(root, 'client/src/pages/Terminal.tsx'), 'utf8');
    const preferredStart = terminal.indexOf("if (moduleId === 'preferred-stock')");
    const stockStart = terminal.indexOf("// ===== 股票模块 =====", preferredStart);
    const preferredRoutes = terminal.slice(preferredStart, stockStart);
    const routeIds = [...preferredRoutes.matchAll(/^\s*'([^']+)':\s*\{/gm)].map(match => match[1]);
    expect(routeIds).toEqual(PREFERRED_STOCK_CAPABILITIES.map(capability => capability.id));
    expect(preferredRoutes).toMatch(/if \(prefPanel\)[\s\S]*?setWindows\(\[\{ id: winId[\s\S]*?return;\s*}\s*\/\/ The preferred-stock namespace is closed:[\s\S]*?return;/);
    expect(terminal).toContain("if (moduleId === 'stocks')");
    expect(terminal).not.toContain("if (moduleId === 'stocks' || moduleId === 'preferred-stock')");
    for (const removed of ['corr', 'gc', 'crvf', 'gct', 'gc3d', 'ya', 'nim', 'nib', 'eco', 'fibc', 'imgr', 'leag', 'des']) {
      expect(preferredRoutes).not.toContain(`'${removed}':`);
    }
  });

  it('integrates original tools and corrected data in one split workspace without duplicate tab panels', () => {
    const preserved = readFileSync(resolve(root, 'client/src/components/preferredstock/PreferredStockPreservedModule.tsx'), 'utf8');
    expect(preserved).toContain('ResearchModuleWorkspace');
    expect(preserved).toContain('keepExistingTool ? original : <PreferredCapabilityAnalysisTool');
    expect(preserved).toContain('CORRECTED_FIELD_BOUNDARIES');
    expect(preserved).toContain('preferred-stock-research-${moduleId}');
    expect(preserved).not.toMatch(/href=|window\.open|location\.href/);
    render(React.createElement(ResearchModuleWorkspace, { code: 'PSCH', title: 'test workspace', research: React.createElement('p', null, 'research content'), tools: React.createElement('button', null, 'original tool'), boundary: { category: 'terms', boundary: 'source requirements', next: '在后方读取 SEC' } }));
    expect(screen.getByRole('region', { name: 'PSCH 数据与证据' }).textContent).toContain('research content');
    expect(screen.getByRole('button', { name: 'original tool' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'PSCH 分析工具' })).toBeTruthy();
    expect(screen.queryAllByRole('tabpanel')).toHaveLength(0);
  });

  it('opens the real PFPSCH entry and retains all research operations without fake market data', () => {
    const close = vi.fn(); render(React.createElement(pfPanels.PFPSCHPanel, { onClose: close }));
    expect(screen.getByText('优先股条款与微观结构工作台')).toBeTruthy();
    const tabButtons = screen.getAllByRole('tab'); expect(tabButtons).toHaveLength(9);
    for (const tab of tabButtons) { fireEvent.click(tab); expect(tab.getAttribute('aria-selected')).toBe('true'); expect(screen.getByRole('tabpanel').textContent?.length).toBeGreaterThan(10); }
    expect(screen.queryByText('LIVE')).toBeNull();
    expect(screen.queryByText('$25.42')).toBeNull();
    expect(screen.queryByText('WFC-L')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '关闭 PSCH' })); expect(close).toHaveBeenCalledOnce();
  });

  it('does not calculate prices from missing inputs and uses only explicit cashflow assumptions', () => {
    expect(buildPschCashflows({ par: '', coupon: '', frequency: '4', years: '', discount: '', redemption: '' })).toBeNull();
    const inputs = { par: '100', coupon: '5', frequency: '1', years: '2', discount: '5', redemption: '100' };
    const value = buildPschCashflows(inputs);
    expect(value?.presentValue).toBeCloseTo(100, 10);
    expect(value?.rows).toHaveLength(2);
    expect(buildPschCashflows({ ...inputs, years: '0.1' })).toBeNull();
    expect(buildPschCashflows({ ...inputs, years: '1000' })).toBeNull();
    render(React.createElement(PSCHPanel));
    fireEvent.click(screen.getByRole('tab', { name: '定价与现金流' }));
    const labels = ['计息本金', '年票面分配率（%）', '情景存续年数', '年化折现率（%）', '期末偿还金额'];
    const values = ['100', '5', '2', '5', '100'];
    labels.forEach((label, index) => fireEvent.change(screen.getByLabelText(`PSCH ${label}`), { target: { value: values[index] } }));
    fireEvent.change(screen.getByLabelText('PSCH 每年支付次数'), { target: { value: '1' } });
    expect(screen.getByLabelText('PSCH 情景现值').textContent).toBe('100.0000');
  });

  it('solves the preferred annual yield only from complete transparent cash-flow inputs', () => {
    expect(solvePreferredAnnualYield(100, 5, 100, 2)).toBeCloseTo(5, 8);
    expect(solvePreferredAnnualYield(100, 0, 0, 2)).toBeNull();
    expect(solvePreferredAnnualYield(100, 5, 100, 0)).toBeNull();
    expect(solvePreferredAnnualYield(100, 5, 100, 2.5)).toBeNull();
  });

  it('rejects malformed and duplicated observations and links accepted quotes into anomaly checks', () => {
    const quote = '2026-09-10T01:00:00Z\t10\t11\t100\t200\t10.5\t20\tTest licensed feed';
    expect(parsePschQuotes(`${quote}\n${quote}`).errors.join('')).toContain('重复观察');
    expect(parsePschQuotes(quote.replace('T01:00:00Z', 'T01:00:00')).rows).toHaveLength(0);
    const earlier = quote.replace('01:00:00', '00:59:00');
    expect(parsePschQuotes(`${quote}\n${earlier}`).rows[0].timestamp).toContain('00:59:00');
    render(React.createElement(PSCHPanel));
    fireEvent.click(screen.getByRole('tab', { name: '流动性' }));
    fireEvent.change(screen.getByLabelText('PSCH 观察数据'), { target: { value: quote } });
    fireEvent.click(screen.getByRole('button', { name: '校验并载入观察' }));
    expect(screen.getByText('Test licensed feed')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: '异常交易' }));
    expect(screen.getByText('Test licensed feed')).toBeTruthy();
    expect(screen.getByText('未触发当前规则')).toBeTruthy();
  });

  it('loads typed account terms with filtering, details, watchlist preservation and refetch', () => {
    runtime.authenticated = true;
    runtime.rows = [{ id: 1, securityIdentifier: 'TEST-P', securityName: 'Test preferred', issuerName: 'Test issuer', dividendType: 'fixed', couponRatePct: '5.0000', paymentFrequency: 'quarterly', referenceIndex: null, spreadBps: null, resetFrequency: null, firstCallDate: null, maturityDate: null, liquidationPreference: '100.0000', asOfDate: new Date('2026-09-01'), sourceReference: 'Test source', updatedAt: new Date('2026-09-10') }];
    render(React.createElement(PSCHPanel));
    fireEvent.click(screen.getByRole('button', { name: 'TEST-P' }));
    expect(screen.getByText('Test preferred')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('自选 TEST-P'));
    expect(JSON.parse(localStorage.getItem('psch_watchlist') || '[]')[0].ticker).toBe('TEST-P');
    fireEvent.click(screen.getByRole('tab', { name: '自选股' }));
    fireEvent.change(screen.getByLabelText('TEST-P 研究备注'), { target: { value: 'check terms' } });
    expect(JSON.parse(localStorage.getItem('psch_watchlist') || '[]')[0].note).toBe('check terms');
    fireEvent.change(screen.getByLabelText('PSCH 条款搜索'), { target: { value: 'unmatched' } });
    expect(screen.queryByRole('button', { name: 'TEST-P' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '刷新账户条款' })); expect(runtime.refetch).toHaveBeenCalledOnce();
  });
});
