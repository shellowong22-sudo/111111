import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const menu = readFileSync(new URL('../client/src/components/EconomicsMenu.tsx', import.meta.url), 'utf8');
const handler = readFileSync(new URL('../client/src/lib/menuItemHandler.ts', import.meta.url), 'utf8');

describe('economic menu duplicate removal', () => {
  it('keeps ECST once and removes the duplicate ECST S route', () => {
    expect(menu).not.toContain("code: 'ECST S'");
    expect(menu.match(/code: 'ECST'/g)).toHaveLength(1);
    expect(menu).toContain("name: '世界经济统计数据'");
    expect(handler).not.toContain("'ECST S':");
    expect(handler.match(/'ECST':/g)).toHaveLength(1);
  });

  it('renumbers the remaining visible menu rows continuously from 1 to 28', () => {
    const numbers = [...menu.matchAll(/\{ num: (\d+),/g)].map(match => Number(match[1]));
    expect(numbers).toEqual(Array.from({ length: 28 }, (_, index) => index + 1));
  });
});
