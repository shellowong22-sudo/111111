import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const terminalPath = resolve(process.cwd(), 'client/src/pages/Terminal.tsx');
const source = readFileSync(terminalPath, 'utf8');

describe('信用债冻结面板映射顺序', () => {
  it('在专项工作区之前保留原信用面板，并不保留数字入口的隐藏分支', () => {
    const mappingStart = source.indexOf('if (creditPanel) {');
    const mappingEnd = source.indexOf('// ===== 优先股专用子菜单路由 =====', mappingStart);
    const mapping = source.slice(mappingStart, mappingEnd);
    expect(mapping).toContain('{creditPanel.component}<div className="mt-2">');
    expect(mapping.indexOf('{creditPanel.component}')).toBeLessThan(mapping.indexOf('<CreditSpecialistPanels moduleId={itemId} />'));
    expect(mapping.indexOf('{creditPanel.component}')).toBeLessThan(mapping.indexOf('<CreditResearchWorkbench moduleId={itemId} />'));
    expect(mapping).not.toContain('independentlyVerifiedPanelIds');
    expect(mapping).not.toContain('showLegacyPanel');
  });

  it('将 21 号授权边界工作台作为冻结信用衍生品与专项层后的追加内容保留', () => {
    const mappingStart = source.indexOf('if (creditPanel) {');
    const mappingEnd = source.indexOf('// ===== 优先股专用子菜单路由 =====', mappingStart);
    const mapping = source.slice(mappingStart, mappingEnd);
    expect(mapping).toContain("const needsCreditBoundaryWorkbench = itemId === '21';");
    expect(mapping).toContain('{needsCreditBoundaryWorkbench && <div className="mt-2"><CreditResearchWorkbench moduleId={itemId} /></div>}');
    expect(mapping.indexOf('{creditPanel.component}')).toBeLessThan(mapping.indexOf('{needsCreditBoundaryWorkbench &&'));
  });
});
