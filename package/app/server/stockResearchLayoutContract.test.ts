import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const read = (relativePath: string) => readFileSync(resolve(root, relativePath), 'utf8');

describe('stock research layout and SEC summary contract', () => {
  it('keeps layout controls in one research workspace with account persistence', () => {
    const workspace = read('client/src/components/stock/StockResearchLayoutWorkspace.tsx');
    expect(workspace).toContain('股票综合研究工作台');
    expect(workspace).toContain('role="tablist"');
    expect(workspace).toContain('ResearchSplit');
    expect(workspace).toContain('saveWorkspaceLayout');
    expect(workspace).toContain('draggable');
    expect(workspace).toContain('恢复默认');
    expect(workspace).toContain('布局尚未保存');
    expect(workspace).toContain('布局保存失败');
    expect(workspace).not.toMatch(/href=|window\.open|location\.href/);
  });

  it('requires SEC summary evidence and exposes only terminal-internal summary actions', () => {
    const workspace = read('client/src/components/stock/StockResearchLayoutWorkspace.tsx');
    const router = read('server/routers/stockMarketResearch.ts');
    expect(workspace).toContain('生成摘要');
    expect(workspace).toContain('财务事实');
    expect(workspace).toContain('风险提示');
    expect(workspace).toContain('标题证据');
    expect(router).toContain('validateStockSecSummary');
    expect(router).toContain('evidencePresent');
    expect(router).toContain('headlineEvidence');
    expect(router).toContain('selectSummarySource');
    expect(router).toContain('workspaceLayoutSchema');
    expect(router).toContain("summarySchema");
  });
});
