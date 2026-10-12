import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

const terminal = read('client/src/pages/Terminal.tsx');
const app = read('client/src/App.tsx');
const factStatus = read('client/src/components/TerminalFactStatus.tsx');
const marketDataPanel = read('client/src/components/MarketDataPanel.tsx');
const commandBar = read('client/src/components/TerminalCommandBar.tsx');
const tickerTape = read('client/src/components/GlobalTickerTape.tsx');
const marketReference = read('client/src/components/LiveNewsTicker.tsx');
const sourceBoundary = read('client/src/components/credit/CreditTerminalSourceBoundary.tsx');
const workbench = read('client/src/components/credit/CreditResearchWorkbench.tsx');
const specialist = read('client/src/components/credit/CreditSpecialistPanels.tsx');
const factStatusWorkspace = read('client/src/components/TerminalFactStatus.tsx');

describe('全局事实状态与终端内来源边界', () => {
  it('保留主终端窗口装配，但不再由根终端启动随机行情更新', () => {
    expect(terminal).toContain('<TerminalFactStatus />');
    expect(app).toContain("location !== '/' && <TerminalFactStatus fixed />");
    expect(terminal).toContain('referenceState="legacy-unverified"');
    expect(terminal).not.toContain('dataEngine.startUpdating(');
    expect(terminal).not.toContain('generateBondData(');
  });

  it('未接入实时来源的历史行情表显示事实状态和真实空状态，而不声称 LIVE', () => {
    expect(marketDataPanel).toContain("referenceState?: 'verified' | 'legacy-unverified'");
    expect(marketDataPanel).toContain('未接入可核验实时来源');
    expect(marketDataPanel).toContain('无已核验实时市场数据');
    expect(factStatus).toContain('不构成实时市场、报价、成交、新闻或投资依据');
  });

  it('全局行情带、命令栏和市场动态不再在客户端制造伪实时波动或伪新闻发布时间', () => {
    [tickerTape, commandBar].forEach((source) => expect(source).not.toContain('useRealtimePrices'));
    expect(tickerTape).toContain('项目数据库导入快照');
    expect(tickerTape).toContain('const seenSymbols = new Set<string>()');
    expect(tickerTape).not.toContain('duplicatedItems');
    expect(commandBar).toContain('项目数据库导入快照');
    expect(commandBar).not.toContain('const doubled');
    expect(marketReference).toContain('市场动态参考');
    expect(marketReference).toContain('内部快照规则文本 · 非新闻');
    expect(marketReference).not.toContain('setInterval(() => setTick');
  });

  it('信用债新增研究层统一拦截外部资料导航，并仅在终端显示来源元数据与读取边界', () => {
    expect(sourceBoundary).toContain('event.preventDefault()');
    expect(sourceBoundary).toContain('onAuxClickCapture={interceptExternalSource}');
    expect(sourceBoundary).toContain('onContextMenuCapture={interceptExternalSource}');
    expect(sourceBoundary).toContain('onDragStartCapture={interceptExternalSource}');
    expect(sourceBoundary).toContain('系统不打开第三方页面');
    expect(sourceBoundary).toContain('终端内来源元数据');
    expect(workbench).toContain('<CreditTerminalSourceBoundary>');
    expect(specialist).toContain('<CreditTerminalSourceBoundary><CreditSpecialistContent moduleId={moduleId} /></CreditTerminalSourceBoundary>');
  });

  it('事实状态层提供终端内公开观察与字段来源覆盖率入口，而不恢复遗留实时展示', () => {
    expect(factStatusWorkspace).toContain('<LegacyMarketDataWorkspace />');
    expect(factStatusWorkspace).toContain('<FieldSourceCoveragePanel />');
    expect(factStatusWorkspace).toContain('公开观察');
    expect(factStatusWorkspace).toContain('字段覆盖率');
  });
});
