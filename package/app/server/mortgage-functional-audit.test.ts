import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseFhfaRegionalCsv } from './routers/mortgageResearch';

const root = resolve(import.meta.dirname, '..');
const audit = readFileSync(resolve(root, 'mortgage-functional-audit-2026-08-19.md'), 'utf8');
const matrix = readFileSync(resolve(root, 'mortgage-26-differentiation-matrix.md'), 'utf8');
const panels = readFileSync(resolve(root, 'client/src/components/MBSPanels22to26.tsx'), 'utf8');
const firstPanels = readFileSync(resolve(root, 'client/src/components/MBSPanels1to7.tsx'), 'utf8');
const marketPanels = readFileSync(resolve(root, 'client/src/components/MBSPanels8to14.tsx'), 'utf8');
const mapPanels = readFileSync(resolve(root, 'client/src/components/MBSPanels15to21.tsx'), 'utf8');
const accountPanel = readFileSync(resolve(root, 'client/src/components/mortgage/MortgageAccountLedgerPanel.tsx'), 'utf8');
const researchRouter = readFileSync(resolve(root, 'server/routers/mortgageResearch.ts'), 'utf8');
const terminal = readFileSync(resolve(root, 'client/src/pages/Terminal.tsx'), 'utf8');
const publicReference = readFileSync(resolve(root, 'client/src/components/mortgage/MortgagePublicResearchReference.tsx'), 'utf8');
const fieldSourceLabel = readFileSync(resolve(root, 'client/src/components/mortgage/MortgageFieldSourceLabel.tsx'), 'utf8');
const workspaceFieldSources = readFileSync(resolve(root, 'client/src/components/mortgage/MortgageWorkspaceFieldSources.tsx'), 'utf8');

describe('抵押债功能完整性审计', () => {
  it('对原有 1–26 项逐项保留专业职责、操作与数据边界记录', () => {
    for (let id = 1; id <= 26; id += 1) expect(audit).toContain(`| ${id} |`);
    expect(audit).toContain('不以估算、随机曲线或模拟报价填充');
    expect(matrix).toContain('不等同 MBS、TBA 或单券成交价');
  });

  it('公开研究数据只提供抵押利率和房价来源边界，不声称提供无授权 MBS/TBA 单券报价', () => {
    expect(researchRouter).toContain('MORTGAGE30US');
    expect(researchRouter).toContain('FHFA');
    expect(researchRouter).toContain('不是 MBS/TBA 价格');
  });

  it('资产类别模块具有周期切换、风险资本与相对价值可视化，而非静态文本卡片', () => {
    expect(panels).toContain('setSelectedCycle');
    expect(panels).toContain('资产类别对比');
    expect(panels).toContain('Agency MBS');
    expect(panels).toContain('regCapital');
  });

  it('账户级台账明确限制只读成员的修改、审批、导出和再共享权限', () => {
    expect(accountPanel).toContain('只读成员：</b>仅查看；不能修改、审批、导出或共享');
    expect(accountPanel).toContain('本机副本不会被删除');
    expect(accountPanel).toContain('导出当前筛选视图并写入操作日志');
  });

  it('直接深链保留 26 个原入口，每个入口只装配一项专属实现', () => {
    expect(terminal).not.toContain("import MortgagePreservedModule from '@/components/mortgage/MortgagePreservedModule'");
    expect(terminal).not.toContain("const retained = (id: string, original: React.ReactNode, enhancement: React.ReactNode)");
    for (const marker of ['MBSSecInfoPanel', 'MBSSECFPanel', 'MBSMTGSPanel', 'MBSMTGHPanel', 'MBSNewIssuesPanel', 'MBSMCALPanel', 'MBSIMGRPanel']) expect(terminal).toContain(`<${marker} onClose=`);
    for (const marker of ['MBSSTSHPanel', 'MBSCurrentMarketPanel', 'MBSTBPFPanel', 'MBSRatingTrendPanel', 'MBSBMMIPanel', 'MBSNewsResearchPanel', 'MBSFIRSPanel']) expect(terminal).toContain(`<${marker} onClose=`);
    for (const marker of ['MBSNIPanel', 'MBSGNAnalysisPanel', 'MBSDESPanel', 'MBSYTPanel', 'MBSFIBCPanel', 'MBSQPanel', 'MBSCMAPPanel']) expect(terminal).toContain(`<${marker} onClose=`);
    for (const marker of ['MBSIndexPanel', 'MBSTBPFMCCNPanel', 'MBSAssetClassPanel', 'MBSRMBSvsCMBSPanel', 'MBSVolumePerformancePanel']) expect(terminal).toContain(`<${marker} onClose=`);
  });

  it('动态模拟、官方 PMMS 与 FHFA 数据在原面板内分区标识，不把推演冒充真实报价', () => {
    for (const source of [firstPanels, marketPanels, mapPanels, panels]) expect(source).toContain('动态模拟推演流');
    expect(marketPanels).toContain('真实序列 + 模拟推演');
    expect(marketPanels).toContain('不等同于 MBS/TBA 可交易报价');
    expect(mapPanels).toContain('用作抵押物环境参照，不替代 CMBS 资产经营数据');
    expect(mapPanels).toContain('不是楼宇级披露或证券报价');
  });

  it('MBS-11 与 MBS-21 在协作记录前优先显示终端内公开资料参考与真实空状态边界', () => {
    expect(publicReference).toContain('MORTGAGE30US');
    expect(publicReference).toContain('FHFA-HPI');
    expect(publicReference).toContain('系统不生成城市评分、权重或损失结论');
    expect(publicReference).toContain('系统不会以历史样例或插补序列替代');
  });

  it('只解析 FHFA 官方州级与都市区级的有效季度观察，并以真实季度变化和同比变化形成终端内序列', () => {
    const state = parseFhfaRegionalCsv('CA,2025,4,700.00\nCA,2026,1,710.50\n', 'state');
    const metro = parseFhfaRegionalCsv('"Los Angeles, CA",31080,2025,4,400.00,( 5.00)\n"Los Angeles, CA",31080,2026,1,404.00,( 5.10)\n', 'metro');
    expect(state[0]).toMatchObject({ id: 'CA', latestPeriod: '2026Q1', latestIndex: 710.5, quarterChangePct: 1.5 });
    expect(metro[0]).toMatchObject({ id: '31080', name: 'Los Angeles, CA', latestPeriod: '2026Q1', latestIndex: 404, quarterChangePct: 1 });
    expect(metro[0]?.history).toHaveLength(2);
  });

  it('旧来源治理组件仍可审计，但不再作为重复业务层挂入 26 个入口', () => {
    expect(fieldSourceLabel).toContain('FHFA All-Transactions 地区级季度 HPI');
    expect(fieldSourceLabel).toContain('用户核验输入');
    expect(publicReference).toContain('getRegionalHpi');
    expect(publicReference).toContain('targetRef={exportRef}');
    expect(workspaceFieldSources).toContain("querySelectorAll('label')");
    expect(workspaceFieldSources).toContain('数据：用户核验输入');
    expect(terminal).not.toContain('MortgageWorkspaceFieldSources');
  });
});
