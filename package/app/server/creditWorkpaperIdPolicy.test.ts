import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('信用债追加工作台本地标识策略', () => {
  it('不为字段、授权、曲线或研究清单记录使用随机标识', () => {
    const source = readFileSync(resolve(process.cwd(), 'client/src/components/credit/CreditSpecialistPanels.tsx'), 'utf8');

    expect(source).toContain('let localWorkpaperIdSequence = 0;');
    expect(source).toContain('localWorkpaperIdSequence += 1;');
    expect(source).toContain('`${prefix}-${Date.now()}-${localWorkpaperIdSequence}`');
    expect(source).not.toContain('Math.random');
  });
});
