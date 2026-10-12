import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('股票驾驶舱和股票屏风的 NCEO 联动', () => {
  const source = readFileSync(resolve(process.cwd(), 'client/src/pages/EquityMarket.tsx'), 'utf8');

  it('keeps the NCEO contract card within the selected-stock chart area', () => {
    expect(source).toContain('NCEO · {selectedSymbol} 模拟期权联动');
    expect(source).toContain("navigate('/terminal?module=derivatives&open=nceo')");
    expect(source).toContain('NCEO 模型 IV 轨迹');
    expect(source).toContain('不是交易所行情、真实可开仓权限或投资建议');
  });

  it('keeps model coverage filtering and CSV export inside the existing stock list', () => {
    expect(source).toContain('const NCEO_MODEL_SYMBOLS');
    expect(source).toContain('onlyNceoCoverage');
    expect(source).toContain('仅 NCEO 模型覆盖：开');
    expect(source).toContain('导出 NCEO 覆盖清单');
    expect(source).toContain('simulation_model_only_not_executable');
  });
});
