import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CROSS_MODULE_RESEARCH_PATHS, resolveTerminalResearchPathHref } from '../client/src/lib/terminalResearchPaths';

const terminal = readFileSync(resolve(import.meta.dirname, '../client/src/pages/Terminal.tsx'), 'utf8');
const routerSource = readFileSync(resolve(import.meta.dirname, './routers/legacyMarketData.ts'), 'utf8');
const pathUiSource = readFileSync(resolve(import.meta.dirname, '../client/src/components/CrossModuleResearchPaths.tsx'), 'utf8');
const notesUiSource = readFileSync(resolve(import.meta.dirname, '../client/src/components/CrossModuleResearchPathNotes.tsx'), 'utf8');
const schemaSource = readFileSync(resolve(import.meta.dirname, '../drizzle/schema.ts'), 'utf8');

describe('跨模块研究路径端到端契约', () => {
  it('每一条路径均由大宗商品、外汇、指数和经济分析的可解析终端深链组成', () => {
    expect(CROSS_MODULE_RESEARCH_PATHS).toHaveLength(3);
    CROSS_MODULE_RESEARCH_PATHS.forEach((path) => path.steps.forEach((step) => {
      expect(resolveTerminalResearchPathHref(step)).toBe(`/?open=${step.itemId}&module=${step.module}`);
      expect(terminal).toContain(`requestedModule === '${step.module}'`);
      expect(terminal).toContain(`if (moduleId === '${step.module}')`);
    }));
  });

  it('覆盖能源—外汇—政策、外汇—指数—宏观与商品季节性研究路径', () => {
    expect(CROSS_MODULE_RESEARCH_PATHS.map((path) => path.id)).toEqual(['energy-fx-policy', 'fx-index-macro', 'commodity-seasonality-index']);
    expect(CROSS_MODULE_RESEARCH_PATHS[0]?.steps.map((step) => step.itemId)).toEqual(['oils', 'fxip', 'fomc']);
    expect(CROSS_MODULE_RESEARCH_PATHS[1]?.steps.map((step) => step.itemId)).toEqual(['fxip', 'wbix', 'taylr']);
    expect(CROSS_MODULE_RESEARCH_PATHS[2]?.steps.map((step) => step.itemId)).toEqual(['seag', 'cix', 'cbrt']);
  });

  it('路径收藏和成员共享只保存账户偏好与成员授权，并维持受保护路由契约', () => {
    expect(schemaSource).toContain('crossModuleResearchPathFavorites');
    expect(schemaSource).toContain('crossModuleResearchPathShares');
    expect(routerSource).toContain('getResearchPathAccess: protectedProcedure');
    expect(routerSource).toContain('toggleResearchPathFavorite: protectedProcedure');
    expect(routerSource).toContain('shareResearchPath: protectedProcedure');
    expect(routerSource).toContain('revokeResearchPathShare: protectedProcedure');
    expect(pathUiSource).toContain('收藏路径');
    expect(pathUiSource).toContain('授予只读共享');
    expect(pathUiSource).toContain('撤销共享');
    expect(routerSource).toContain('listResearchPathNotes: protectedProcedure');
    expect(routerSource).toContain('createResearchPathNote: protectedProcedure');
    expect(routerSource).toContain('reviewResearchPathNote: protectedProcedure');
    expect(schemaSource).toContain('crossModuleResearchPathNotes');
    expect(notesUiSource).toContain('提交备注');
    expect(notesUiSource).toContain('退回调整');
  });
});
