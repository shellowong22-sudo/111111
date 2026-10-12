import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('主权债目录路由完整性', () => {
  const terminal = readFileSync(resolve(import.meta.dirname, '../client/src/pages/Terminal.tsx'), 'utf8');

  it('为目录中的全部 24 个编号提供主权债窗口处理分支', () => {
    for (let id = 1; id <= 24; id += 1) {
      expect(terminal, `缺少主权债入口 ${id}`).toContain(`itemId === '${id}'`);
    }
  });

  it('使用查询参数状态监听，以支持同一路由下的深链接切换', () => {
    expect(terminal).toContain("useSearch");
    expect(terminal).toContain("new URLSearchParams(search)");
  });
});
