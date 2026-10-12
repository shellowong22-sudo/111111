import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('client/src/components/SovereignBondMenu.tsx', 'utf8');

describe('主权债菜单窗口可见性', () => {
  it('主菜单第 4–12 项派发窗口后关闭覆盖层', () => {
    const start = source.indexOf('const handleMainItemClick');
    const end = source.indexOf('const handleCurrentMarketItemClick');
    const handler = source.slice(start, end);
    expect(handler).toContain('onSelectItem(item.id, item.name);');
    expect(handler).toContain('onClose();');
  });

  it('当前市场子菜单派发映射窗口后同样关闭覆盖层', () => {
    const start = source.indexOf('const handleCurrentMarketItemClick');
    const end = source.indexOf('const leftItems');
    const handler = source.slice(start, end);
    expect(handler).toContain('onSelectItem(mappedId, item.name);');
    expect(handler).toContain('onClose();');
  });

  it('第 4–12 项均保留对应的终端窗口分支', () => {
    const terminal = readFileSync('client/src/pages/Terminal.tsx', 'utf8');
    for (const id of ['4', '5', '6', '7', '8', '9', '10', '11', '12']) {
      expect(terminal).toContain(`moduleId === 'sovereign-bonds' && itemId === '${id}'`);
    }
  });
});
