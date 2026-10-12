import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MENU_ITEM_CONFIG } from '../client/src/lib/menuItemHandler';

describe('derivatives preserved routing', () => {
  const terminal = readFileSync(resolve(process.cwd(), 'client/src/pages/Terminal.tsx'), 'utf8');
  const menu = readFileSync(resolve(process.cwd(), 'client/src/components/DerivativesMenu.tsx'), 'utf8');
  const menuHandler = readFileSync(resolve(process.cwd(), 'client/src/lib/menuItemHandler.ts'), 'utf8');

  it('allows the existing terminal deep-link path to target the derivatives module', () => {
    expect(terminal).toMatch(/requestedModule\s*===\s*["']derivatives["']/);
  });

  it('wraps each protected derivatives window only after creating its original child', () => {
    for (const moduleId of ['ov', 'oils', 'fom', 'wbf-ai', 'credit-monitor', 'cdsw', 'vca', 'mars', 'ovcv', 'dlib', 'moso', 'ovml']) {
      expect(terminal).toMatch(new RegExp(`preserveDerivatives\\(\\s*["']${moduleId}["']`));
    }
  });

  it('keeps the preserved derivatives menu while exposing NCEO through its in-terminal route', () => {
    // NCEO remains an existing derivatives function and is also available
    // through the explicit command route.
    expect(menu).toMatch(/code:\s*["']NCEO["']/);
    expect(menu).toContain('佑诚期权');
    expect(menuHandler).toContain("path: '/terminal?module=derivatives&open=nceo'");
    expect(terminal).toMatch(/nceo:\s*\{[\s\S]*?title:\s*["']佑诚期权 · NCEO 诺诚增强期权["']/);
    expect(terminal).toContain('<NCEOPanel');
    expect(terminal).not.toContain("preserveDerivatives('nceo'");
  });

  it('opens the existing commodity data panel from item 15 instead of a duplicate card page', () => {
    expect(menu).toContain("{ num: 15, code: '', name: '商品衍生品', hasSubmenu: true }");
    expect(MENU_ITEM_CONFIG['商品衍生品'].path).toBe('/commodity-derivatives');
    const category = readFileSync(resolve(process.cwd(), 'client/src/pages/CommodityDerivatives.tsx'), 'utf8');
    expect(category).toContain("import CommodityFutures from './CommodityFutures';");
    expect(category).toContain('return <CommodityFutures />;');
    expect(category).not.toContain('GLCO - 全球商品价格');
  });
});
