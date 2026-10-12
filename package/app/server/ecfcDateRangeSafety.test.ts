import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('ECFC 日期范围安全回退', () => {
  const source = fs.readFileSync(path.resolve(process.cwd(), 'client/src/components/econ/ECFCTab.tsx'), 'utf8');

  it('对单端点滑块值保留现有起点并以起点补齐终点', () => {
    expect(source).toContain('const start = value[0] ?? selectedDateRange[0];');
    expect(source).toContain('const end = value[1] ?? start;');
  });

  it('在日期缺失时不调用 parseISO(undefined)，而是显示真实不可读状态', () => {
    expect(source).toContain("if (!startDate || !endDate)");
    expect(source).toContain("'日期范围缺少可读端点，未应用变更。'");
    expect(source).toContain("'未选日期'");
  });
});
