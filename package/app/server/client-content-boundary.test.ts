import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('业务界面信息边界', () => {
  it('信用债证券说明不向终端用户展示实现语言、代码框架、公式或技术栈', () => {
    const source = readFileSync(resolve(import.meta.dirname, '../client/src/components/SECDESCPanel.tsx'), 'utf8');
    const prohibited = [
      '代码框架', '技术栈说明', 'Python 实现框架', 'GradientBoostingClassifier',
      'decompose_spread', 'P(Default) =', 'Fama-French', 'numpy_financial', 'scikit-learn',
    ];
    prohibited.forEach((text) => expect(source).not.toContain(text));
    expect(source).toContain('研究范围与风险观察');
    expect(source).toContain('研究维度说明');
    expect(source).toContain('使用边界');
  });
});
