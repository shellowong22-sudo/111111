import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const terminal = readFileSync(resolve(root, 'client/src/pages/Terminal.tsx'), 'utf8');
const first = readFileSync(resolve(root, 'client/src/components/MBSPanels1to7.tsx'), 'utf8');
const second = readFileSync(resolve(root, 'client/src/components/MBSPanels8to14.tsx'), 'utf8');
const third = readFileSync(resolve(root, 'client/src/components/MBSPanels15to21.tsx'), 'utf8');
const fourth = readFileSync(resolve(root, 'client/src/components/MBSPanels22to26.tsx'), 'utf8');
const liveDelivery = readFileSync(resolve(root, 'client/src/components/mortgage/MortgageModuleLiveDelivery.tsx'), 'utf8');
const liveFeedHook = readFileSync(resolve(root, 'client/src/hooks/useModuleLiveFeed.ts'), 'utf8');
const panelKit = readFileSync(resolve(root, 'client/src/components/sovereign/PanelKit.tsx'), 'utf8');
const router = readFileSync(resolve(root, 'server/routers/mortgageResearch.ts'), 'utf8');
const spider = readFileSync(resolve(root, 'server/spiderPlatform.ts'), 'utf8');

describe('抵押债 1–26 项最终工作台契约', () => {
  it('保留 26 个原入口并各自映射到一套原面板实现', () => {
    const mappings = [
      'MBSSecInfoPanel', 'MBSSECFPanel', 'MBSMTGSPanel', 'MBSMTGHPanel', 'MBSNewIssuesPanel', 'MBSMCALPanel', 'MBSIMGRPanel',
      'MBSSTSHPanel', 'MBSCurrentMarketPanel', 'MBSTBPFPanel', 'MBSRatingTrendPanel', 'MBSBMMIPanel', 'MBSNewsResearchPanel', 'MBSFIRSPanel',
      'MBSNIPanel', 'MBSGNAnalysisPanel', 'MBSDESPanel', 'MBSYTPanel', 'MBSFIBCPanel', 'MBSQPanel', 'MBSCMAPPanel',
      'MBSIndexPanel', 'MBSTBPFMCCNPanel', 'MBSAssetClassPanel', 'MBSRMBSvsCMBSPanel', 'MBSVolumePerformancePanel',
    ];
    for (const mapping of mappings) expect(terminal).toContain(`<${mapping} onClose=`);
    expect(terminal).toContain('setWindows([{ id: winId, title: mbsPanel.title');
    expect(terminal).not.toContain("import MortgagePreservedModule from '@/components/mortgage/MortgagePreservedModule'");
  });

  it('四组工作台具备 26 个差异化可视化实现并明确标注模拟边界', () => {
    for (const marker of ['MBSSecInfoPanel', 'MBSSECFPanel', 'MBSMTGSPanel', 'MBSMTGHPanel', 'MBSNewIssuesPanel', 'MBSMCALPanel', 'MBSIMGRPanel']) expect(first).toContain(marker);
    for (const marker of ['MBSSTSHPanel', 'MBSCurrentMarketPanel', 'MBSTBPFPanel', 'MBSRatingTrendPanel', 'MBSBMMIPanel', 'MBSNewsResearchPanel', 'MBSFIRSPanel']) expect(second).toContain(marker);
    for (const marker of ['MBSNIPanel', 'MBSGNAnalysisPanel', 'MBSDESPanel', 'MBSYTPanel', 'MBSFIBCPanel', 'MBSQPanel', 'MBSCMAPPanel']) expect(third).toContain(marker);
    for (const marker of ['MBSIndexPanel', 'MBSTBPFMCCNPanel', 'MBSAssetClassPanel', 'MBSRMBSvsCMBSPanel', 'MBSVolumePerformancePanel']) expect(fourth).toContain(marker);
    for (const source of [first, second, third, fourth]) {
      expect(source).toContain('动态模拟推演流');
      expect(source).toContain('<ResponsiveContainer');
    }
  });

  it('第 6 项日期随当前日期滚动，不再写死旧结算日', () => {
    expect(first).toContain('date.setDate(date.getDate() + item.days)');
    expect(first).toContain('Remittance Date 动态推演日历');
    expect(first).not.toContain("{ date: '2026-07-25'");
  });

  it('第 9 项在原当前市场内部接入 PMMS 真实周度历史并保留独立情景区', () => {
    expect(second).toContain('getRateSnapshot.useQuery');
    expect(second).toContain('Freddie Mac PMMS 周度抵押利率实测序列');
    expect(second).toContain('SCENARIO STREAM');
    expect(router).toContain('MORTGAGE30US');
    expect(router).toContain('FRED / Freddie Mac PMMS');
  });

  it('第 21 项在原 CMBS 地图内部接入 FHFA 州级 HPI 与 24 季度下钻', () => {
    expect(third).toContain("getRegionalHpi.useQuery({ geography: 'state' }");
    expect(third).toContain('FHFA 州级房价季度脉冲');
    expect(third).toContain('24 季度历史');
    expect(third).toContain('UNDERWRITING SCENARIO');
    expect(router).toContain('hpi_at_state.csv');
  });

  it('26 个入口共享同一推送协议但路径唯一，页面渲染后发送确认回执', () => {
    expect(liveDelivery).toContain('useModuleLiveFeed');
    expect(liveDelivery).toContain('uniqueVisibleItems');
    expect(liveFeedHook).toContain('React 已经把本批数据提交到可见 DOM 之后');
    expect(liveFeedHook).toContain('acknowledgeFeeds.useMutation');
    for (let id = 1; id <= 26; id += 1) expect(panelKit).toContain(`/terminal?open=${id}&module=mortgage-bonds`);
  });

  it('管理后台种子覆盖主要抵押住房官方机构', () => {
    for (const marker of ['FHFA 房价指数数据集', 'Fannie Mae 抵押支持证券', 'Freddie Mac 单户贷款级数据', 'Ginnie Mae 披露与报告', 'HMDA 抵押贷款数据浏览器']) expect(spider).toContain(marker);
    for (const marker of ['FHFA-HPI', 'FANNIE-MBS', 'GINNIE-DISC', 'HMDA-BROWSER']) expect(router).toContain(marker);
  });
});
