import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const original = readFileSync(`${root}/client/src/pages/EconomicDataHub.tsx`, 'utf8');
const wrapper = readFileSync(`${root}/client/src/components/econ/EconomicDataHubPreservedRoute.tsx`, 'utf8');
const workbench = readFileSync(`${root}/client/src/components/econ/OfficialResearchWorkbench.tsx`, 'utf8');
const ecfc = readFileSync(`${root}/client/src/components/econ/ECFCTab.tsx`, 'utf8');

describe('经济分析原内容保护与截图区域整体研究原文替换', () => {
  it('保持当前经济分析中心的全部原目录标识、文字及入口，不用整文件哈希阻止原页升级', () => {
    const expected = 'eco:经济日历,ecst:统计数据,ectr:贸易流量,wfii:外国投资,ecwb:经济工作台,rsan:地缘政治,ecob:关键指标,ecfc:经济预测,shok:预测模型,wirp:利率概率,fcon:财务状况,ecsu:经济意外,tayl:泰勒规则,ecan:经济分析,mosp:预测市场,cenb:央行查找,cbrt:央行利率,fomc:联储会议,foms:FOMC声明,fdsp:联储分析仪,be:经济新闻,beco:彭博经济,bie:国家报告,pmi:标普PMI'.split(',');
    const block = original.match(/const ALL_TABS = \[([\s\S]*?)\];/)![1];
    const actual = [...block.matchAll(/value: '([^']+)', label: '[^']+', fullLabel: '([^']+)'/g)].map(match => `${match[1]}:${match[2]}`);
    expect(actual).toEqual(expected);
    expect(new Set(actual).size).toBe(actual.length);
    expect(original).toContain('const ALL_TABS');
    expect(original).toContain("{ value: 'eco', label: 'ECO'");
    expect(original).toContain("{ value: 'pmi', label: 'PMI'");
  });

  it('ECFC 仅保留已审计的日期端点兼容差异，不放松其他原内容保护', () => {
    expect(ecfc).toContain('const end = value[1] ?? start;');
    expect(ecfc).toContain("'日期范围缺少可读端点，未应用变更。'");
    expect(ecfc).not.toContain('OfficialResearchWorkbench');
  });

  it('当前路由只保留原 29 项与真实投递回执，不再追加截图中的重复扩展区', () => {
    expect(wrapper).toContain('{children}');
    expect(wrapper).toContain('<EconomicDataHub />');
    expect(wrapper).toContain('data-preserved-economic-hub="true"');
    expect(wrapper).toContain('<ModuleLiveDeliveryTable {...openBBDelivery}');
    expect(wrapper).not.toContain('EconOneToOneExtensionBridge');
    expect(wrapper).not.toContain('data-econ-extension-layout-bridge="true"');
    expect(wrapper).not.toContain('ZIP CONTEXT EXTENSION');
    expect(wrapper).not.toMatch(/OfficialResearchWorkbench|EconomicCalendarOfficialObservations|MacroEvidenceWorkflowDesk|EconomicFieldSourceDirectory/);
  });

  it('旧统一工作台文件只保留作历史记录，不能通过当前保留路由出现', () => {
    expect(workbench).toContain('FEDS PRIMARY-TEXT READING DESK');
    expect(wrapper).not.toContain('OfficialResearchWorkbench');
  });
});
