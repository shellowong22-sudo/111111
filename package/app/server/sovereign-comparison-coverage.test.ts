import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { OECD_TEN_YEAR_GOVERNMENT_YIELD_SERIES } from './realDataService';

const routerSource = readFileSync(resolve(import.meta.dirname, './routers/sovereignComparison.ts'), 'utf8');
const componentSource = readFileSync(resolve(import.meta.dirname, '../client/src/components/sovereign/CrossCountrySovereignComparison.tsx'), 'utf8');

describe('跨国主权真实数据覆盖边界', () => {
  it('为补充覆盖国家固定使用可追溯的 FRED/OECD 十年期政府债收益率系列', () => {
    expect(OECD_TEN_YEAR_GOVERNMENT_YIELD_SERIES).toMatchObject({
      AU: { seriesId: 'IRLTLT01AUM156N' }, CA: { seriesId: 'IRLTLT01CAM156N' }, KR: { seriesId: 'IRLTLT01KRM156N' },
      FR: { seriesId: 'IRLTLT01FRM156N' }, IT: { seriesId: 'IRLTLT01ITM156N' }, ES: { seriesId: 'IRLTLT01ESM156N' },
    });
  });

  it('将法国、意大利和西班牙纳入比较范围，并对本地曲线缺失时标注月度原始参考', () => {
    expect(routerSource).toContain("'FR', 'IT', 'ES'");
    expect(routerSource).toContain('fetchOecdTenYearGovernmentYields');
    expect(routerSource).toContain("frequency: '月度'");
    expect(routerSource).toContain("source: oecdReference.source");
  });

  it('不将未配置免费原始来源的主权 CDS 伪装为报价，并透明展示跳过范围与限制', () => {
    expect(routerSource).toContain("status: 'not_available'");
    expect(routerSource).toContain('本次未配置免费原始报价源');
    expect(routerSource).toContain('permissionLabel');
    expect(routerSource).toContain('latencyLabel');
    expect(componentSource).toContain('信用数据范围');
    expect(componentSource).toContain('范围：');
    expect(componentSource).toContain('延迟：');
    expect(componentSource).toContain('FRED/OECD 的');
    expect(componentSource).toContain('建议复核');
    expect(componentSource).toContain('快速预设');
    expect(componentSource).toContain('免费月度参考');
    expect(componentSource).toContain('本地曲线快照');
  });
});
