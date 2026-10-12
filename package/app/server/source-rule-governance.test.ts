import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(import.meta.dirname, '../client/src/components/mm/SourceRuleGovernance.tsx'), 'utf8');

describe('SOURCE 规则治理加载稳定性', () => {
  it('在规则尚未加载时使用稳定空数组，并且仅在选择发生变化时更新状态', () => {
    expect(source).toContain('const EMPTY_SOURCE_RULES: never[] = [];');
    expect(source).toContain('rulesQuery.data ?? EMPTY_SOURCE_RULES');
    expect(source).toContain('return next.length === previous.length ? previous : next;');
  });
});
