import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('forex independent workspaces', () => {
  it('keeps frozen panels in front of seven independent extension workspaces', () => {
    const terminal = read('client/src/pages/Terminal.tsx');
    const required = [
      ['FXDSPanel', 'FXDataCatalogWorkspace'],
      ['FXTFPanel', 'FXConventionWorkspace'],
      ['XDSHPanel', 'FXWorkspaceLayoutStudio'],
      ['ECMIPanel', 'FXObservationChangeArchive'],
      ['ALLQPanel', 'FXCrossReferenceDesk'],
      ['FRDPanel', 'FXForwardInputLab'],
      ['WCRSPanel', 'FXStrengthRankingDesk'],
    ];
    for (const [preserved, extension] of required) {
      expect(terminal.indexOf(`<${preserved}`)).toBeGreaterThanOrEqual(0);
      expect(terminal.indexOf(`<${extension}`)).toBeGreaterThan(terminal.indexOf(`<${preserved}`));
    }
  });

  it('keeps the seven business paths visibly distinct and free of random/fake live data', () => {
    const source = read('client/src/components/forex/ForexIndependentWorkspaces.tsx');
    expect(source).not.toMatch(/Math\.random|实时监控中|数据延迟\s*<\s*100ms/);
    for (const marker of ['公开序列契约检索', '货币对报价约定词典', '同日交叉转换参考', '远期输入实验室', '代码观察屏布局', '相邻观察变化归档', '公开窗口货币强弱排名']) expect(source).toContain(marker);
    for (const field of ['orientation', 'settlement', 'observationDate', 'baseRate', 'tiles', 'changePct', 'windowChangePct']) expect(source).toContain(field);
  });

  it('labels preserved unverified forex fixtures as simulated before original children render', () => {
    const preserved = read('client/src/components/forex/ForexPreservedModule.tsx');
    expect(preserved).toContain('模拟数据');
    expect(preserved.indexOf('模拟数据')).toBeLessThan(preserved.indexOf('{children}'));
  });

  it('normalizes external uppercase forex codes to the existing lower-case panel map', () => {
    const terminal = read('client/src/pages/Terminal.tsx');
    expect(terminal).toContain('const normalizedItemId = itemId.toLowerCase();');
    expect(terminal).toContain('const panel = panelMap[normalizedItemId];');
    expect(terminal).toContain('const winId = `forex-${normalizedItemId}`;');
  });
});
