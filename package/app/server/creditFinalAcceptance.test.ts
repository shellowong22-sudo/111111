import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ADMIN_DATA_MODULES } from '../shared/adminDataModules';

const read = (path: string) => readFileSync(resolve(import.meta.dirname, '..', path), 'utf8');
const gcds = read('client/src/components/GCDSEnhancedPanel.tsx');
const comparison = read('server/routers/sovereignComparison.ts');
const realData = read('server/realDataService.ts');
const pricing = read('client/src/components/PRICINGEnhancedPanel.tsx');
const loans = read('client/src/components/LOANSPanel.tsx');
const issuer = read('client/src/components/credit/CreditIssuerAndAnalyticsPanels.tsx');

describe('信用债最终整改契约', () => {
  it('保留信用债 01–26 的唯一后台目标和原终端路径', () => {
    const modules = ADMIN_DATA_MODULES.filter((item) => item.path.includes('module=credit-bonds'));
    expect(modules).toHaveLength(26);
    expect(new Set(modules.map((item) => item.id)).size).toBe(26);
    expect(new Set(modules.map((item) => item.path)).size).toBe(26);
    for (let open = 1; open <= 26; open += 1) {
      expect(modules.some((item) => item.path === `/terminal?open=${open}&module=credit-bonds`)).toBe(true);
    }
  });

  it('信用债 05 的四个原页签各有不同用途且不再重复 OAS 历史', () => {
    for (const label of ['CDS 实时报价', '公开基准历史', 'CDX/iTraxx', 'CDS-债券基差']) expect(gcds).toContain(label);
    expect(gcds).toContain('至少输入两个期限点后绘制期限结构');
    expect(gcds).toContain('本会话输入快照');
    expect(gcds).toContain('CDX/iTraxx 合约口径核验');
    expect(gcds).toContain('净基差＝债券利差－CDS 保护成本－融资成本－流动性成本');
    expect(gcds).not.toContain('getOasSnapshot');
  });

  it('跨国矩阵保留月度真实历史而不把过期观察伪装成实时', () => {
    for (const id of ['IRLTLT01DEM156N', 'IRLTLT01JPM156N', 'IRLTLT01GBM156N']) expect(realData).toContain(id);
    expect(comparison).toContain('oecdReference ? {');
    expect(comparison).toContain('月度历史参考');
    expect(comparison).toContain("freshnessFromDate(oecdReference.dataDate, 62, 'FRED/OECD 月度参考')");
  });

  it('发行人、定价和贷款功能保持各自独立的数据口径', () => {
    expect(issuer).toContain('getIssuerFinancialFacts');
    expect(issuer).toContain('债务与流动性轨迹');
    expect(pricing).toContain('priceYtmCurve');
    expect(pricing).toContain('用户输入 · 即时重算');
    expect(pricing).not.toContain('无风险利率 2.35%');
    expect(loans).toContain('动态研究情景');
    expect(loans).not.toContain('流动性折价');
    expect(loans).not.toContain('税收优势');
    expect(loans).not.toContain('综合相对价值');
  });
});
