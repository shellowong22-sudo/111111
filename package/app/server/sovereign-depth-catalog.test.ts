import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { sovereignDepthCatalog } from '../client/src/lib/sovereignDepthCatalog';

const menuSource = readFileSync(resolve(import.meta.dirname, '../client/src/components/SovereignBondMenu.tsx'), 'utf8');
const layoutSource = readFileSync(resolve(import.meta.dirname, '../client/src/components/TerminalLayout.tsx'), 'utf8');
const checklistSource = readFileSync(resolve(import.meta.dirname, '../client/src/components/sovereign/SovereignResearchChecklist.tsx'), 'utf8');

const expectedMenuBaseline = [
  ['1', '证券、设定与功能说明'], ['2', '证券查找'], ['3', '当前市场'], ['4', '全球债券市场'],
  ['5', '固定收益交易'], ['6', '国债与货币市场'], ['7', '全球CDS图表'], ['8', '国家指南'],
  ['9', '市场隐含政策利率'], ['10', '主权债所有权'], ['11', '主权债信用风险'], ['12', '全球宏观市场驱动者'],
  ['13', '收益曲线'], ['14', '绘制曲线图'], ['15', '分析 CT10 Govt'], ['16', '证券简介'],
  ['17', '收益率与利差分析'], ['18', '债券新闻'], ['19', '计算器与分析'], ['20', '定价'],
  ['21', '库存与价格'], ['22', 'Runs管理'], ['23', '新发行、公司大事、评级'], ['24', 'IR与通胀衍生产品及SN'],
] as const;

describe('主权债24项目录深度扩展边界', () => {
  it('保留既有编号、名称和递增顺序', () => {
    let previousIndex = -1;
    expectedMenuBaseline.forEach(([id, name]) => {
      const exact = `{ id: '${id}', code: '${id}'`;
      const index = menuSource.indexOf(exact);
      expect(index, `${id} 应保留原有入口`).toBeGreaterThan(previousIndex);
      expect(menuSource.slice(index, index + 180)).toContain(name);
      previousIndex = index;
    });
  });

  it('为24个既有入口全部提供新增字段、核验、情景、关联与数据质量信息', () => {
    const ids = expectedMenuBaseline.map(([id]) => id);
    expect(Object.keys(sovereignDepthCatalog)).toEqual(ids);
    ids.forEach((id) => {
      const profile = sovereignDepthCatalog[id];
      expect(profile.fieldBook.length).toBeGreaterThanOrEqual(5);
      expect(profile.verification.length).toBeGreaterThanOrEqual(5);
      expect(profile.scenarioLens.length).toBeGreaterThan(20);
      expect(profile.links.length).toBeGreaterThanOrEqual(3);
      expect(profile.dataQuality.length).toBeGreaterThan(20);
    });
  });

  it('仅在现有窗口上追加深度研究工作台和数据质量说明', () => {
    expect(layoutSource).toContain("['当前市场', '3']");
    expect(layoutSource).toContain('sovereignDepthCatalog');
    expect(layoutSource).toContain('深度研究字段、核验与情景（仅新增）');
    expect(layoutSource).toContain('官方拍卖参考');
    expect(layoutSource).toContain('ResearchLedgerWorkspace');
    expect(layoutSource).toContain('moduleCode={`SOV-${sovereignId}`}');
    expect(layoutSource).toContain('账户研究送审与审计（仅新增）');
  });

  it('研究执行清单提供真实的本地进度、备注和导出动作', () => {
    expect(checklistSource).toContain('localStorage.setItem');
    expect(checklistSource).toContain('downloadMarkdown');
    expect(checklistSource).toContain('导出记录');
    expect(checklistSource).toContain('checkbox');
    expect(checklistSource).toContain('仅保存在当前浏览器');
  });
});
