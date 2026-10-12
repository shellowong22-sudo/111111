import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const menuSource = readFileSync(new URL('../client/src/components/ForexMenu.tsx', import.meta.url), 'utf8');
const terminalSource = readFileSync(new URL('../client/src/pages/Terminal.tsx', import.meta.url), 'utf8');

describe('forex menu routing', () => {
  it('maps every clickable forex code entry to an in-terminal panel', () => {
    const ids = [...menuSource.matchAll(/code: '[^']*', name: '[^']*', hasSubmenu: false, id: '([^']+)'/g)].map((match) => match[1]).filter((id): id is string => Boolean(id));

    expect(ids).toHaveLength(25);
    expect(new Set(ids).size).toBe(25);
    expect(ids).toContain('firs');
    expect(ids).not.toContain('gp');
    for (const id of ids) expect(terminalSource).toMatch(new RegExp(`(?:['"])?${id}(?:['"])?\\s*:\\s*\\{\\s*title:`));
  });

  it('keeps the six non-clickable directory headings as labels rather than false action links', () => {
    const headings = [...menuSource.matchAll(/code: '', name: '[^']*', hasSubmenu: false, id: ''/g)];
    expect(headings).toHaveLength(6);
  });
});
