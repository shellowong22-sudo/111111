import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('根终端与收益曲线动作边界', () => {
  it('官方事实刷新调用实际查询并在读取中禁用', () => {
    const source = read('client/src/components/OfficialMarketFactsBrief.tsx');
    expect(source).toContain('onClick={() => void feed.refetch()}');
    expect(source).toContain('disabled={feed.isFetching}');
    expect(source).toContain('官方来源当前不可读取；终端保持空状态');
  });

  it('曲线工具只执行恢复快照载入或当前会话内计算与保存，不提供伪导出或市场执行', () => {
    const source = read('client/src/components/CurveDistinctTools.tsx');
    expect(source).toContain('onClick={loadSnapshot}');
    expect(source).toContain('onClick={()=>setSaved(true)}');
    expect(source).toContain('本地版本已标记保存（仅当前会话状态）');
    expect(source).toContain('不保存或伪装市场曲线');
    expect(source).not.toContain('导出到交易所');
  });
});
