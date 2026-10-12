import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..');
const source = fs.readFileSync(path.join(root, 'client/src/components/BTMMPanel.tsx'), 'utf8');

describe('BTMM公开利率数据边界', () => {
  it('只展示FRED查询返回值，不对历史或最新值添加模拟扰动', () => {
    expect(source).not.toContain('Math.sin');
    expect(source).not.toContain('liveTick');
    expect(source).not.toContain('SIM FLOW');
  });

  it('在界面标出实际查询时间并保留公开历史参考边界', () => {
    expect(source).toContain('query.data?.timestamp');
    expect(source).toContain('公开历史参考');
  });
});
