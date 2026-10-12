import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(import.meta.dirname, '../client/src/components/mortgage/MortgageWorkspaceFieldSources.tsx'), 'utf8');

describe('抵押债原字段可追溯来源', () => {
  it('按模块和字段类别生成可追溯的历史来源边界', () => {
    expect(source).toContain('function provenanceFor(moduleId: string, fieldName: string)');
    expect(source).toContain('历史市场字段');
    expect(source).toContain('历史信用字段');
    expect(source).toContain('历史地域字段');
    expect(source).toContain('MBS-${moduleId} · 原工作区');
  });

  it('保留用户输入溯源与字段级悬停可访问说明', () => {
    expect(source).toContain('数据：用户核验输入');
    expect(source).toContain('badge.dataset.sourceId = sourceId');
    expect(source).toContain('aria-label');
  });
});
