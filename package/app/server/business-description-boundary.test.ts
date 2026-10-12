import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const componentSource = (name: string) => readFileSync(resolve(import.meta.dirname, `../client/src/components/${name}`), 'utf8');

describe('业务说明窗口内容边界', () => {
  it('已审计的业务说明窗口不再展示代码框架、公式或技术模型文案', () => {
    const screens = [
      'SECDESCPanel.tsx', 'BCMPPanel.tsx', 'CDERIVPanel.tsx', 'CDSWPanel.tsx',
      'CRMXPanel.tsx', 'GCDSEnhancedPanel.tsx', 'IRSMonitorPanel.tsx', 'MKTOVPanel.tsx',
      'SOVMPanel.tsx', 'USSWPanel.tsx', 'YCURVEEnhancedPanel.tsx',
    ];
    const prohibited = [
      '代码框架', '技术栈说明', 'Python 实现框架', '定价公式', '计算公式',
      'XGBoost定价', 'GNN二级市场', 'LSTM微观结构', 'GPR+Transformer',
      '深度学习公允价值估计', 'Fama-French 信用利差因子模型',
    ];
    const text = screens.map(componentSource).join('\n');
    prohibited.forEach((phrase) => expect(text).not.toContain(phrase));
  });

  it('统一术语释义提供业务解释且不暴露实现技术', () => {
    const source = componentSource('BusinessTerm.tsx');
    ['信用利差', '流动性', '数据时点', '可执行报价', '研究参考'].forEach((term) => expect(source).toContain(term));
    ['numpy', 'pandas', 'sklearn', '代码框架', '技术栈'].forEach((phrase) => expect(source).not.toContain(phrase));
  });
});
