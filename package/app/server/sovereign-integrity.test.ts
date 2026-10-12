import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const upgradedModules = [
  'client/src/components/FITPanel.tsx',
  'client/src/components/SRSKPanel.tsx',
  'client/src/components/DEBTPanel.tsx',
  'client/src/components/GMMPanel.tsx',
  'client/src/components/IMGRPanel.tsx',
  'client/src/components/RUNZPanel.tsx',
  'client/src/components/InflationPanel.tsx',
  'client/src/components/CalcPanel.tsx',
  'client/src/components/DESPanel.tsx',
];

describe('主权债工作流完整性', () => {
  it('核心升级模块不再在前端生成随机市场数据', () => {
    for (const relativePath of upgradedModules) {
      const source = readFileSync(resolve(projectRoot, relativePath), 'utf8');
      expect(source, relativePath).not.toContain('Math.random');
    }
  });

  it('运行、库存和固定收益交易模块不包含自动下单或伪智能路由界面', () => {
    const runz = readFileSync(resolve(projectRoot, 'client/src/components/RUNZPanel.tsx'), 'utf8');
    const imgr = readFileSync(resolve(projectRoot, 'client/src/components/IMGRPanel.tsx'), 'utf8');
    const fit = readFileSync(resolve(projectRoot, 'client/src/components/FITPanel.tsx'), 'utf8');
    expect(runz).not.toContain('DRL 智能路由');
    expect(runz).not.toContain('跨场所高频微观结构套利');
    expect(imgr).not.toContain('AI 价格预测模型');
    expect(fit).not.toContain('智能路由分拆方案');
  });

  it('风险、证券、计算器和通胀模块明确保留研究与核验边界', () => {
    for (const relativePath of ['client/src/components/SRSKPanel.tsx', 'client/src/components/DESPanel.tsx', 'client/src/components/CalcPanel.tsx', 'client/src/components/InflationPanel.tsx']) {
      const source = readFileSync(resolve(projectRoot, relativePath), 'utf8');
      expect(source.includes('本模块不') || source.includes('本页不包含'), relativePath).toBe(true);
    }
  });
});
