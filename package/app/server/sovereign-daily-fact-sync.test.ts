import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { appRouter } from './routers';
import type { TrpcContext } from './_core/context';

function createCtx(): TrpcContext {
  return { user: null, req: { protocol: 'https', headers: {} } as TrpcContext['req'], res: { clearCookie: () => {} } as unknown as TrpcContext['res'] } as TrpcContext;
}

describe('主权债每日原始事实同步', () => {
  it('公开状态接口保持可调用，并且只返回快照列表', async () => {
    const result = await appRouter.createCaller(createCtx()).sovereignBonds.getDailyFactStatus();
    expect(result.success).toBe(true);
    expect(Array.isArray(result.data)).toBe(true);
  });

  it('跨日趋势接口仅比较已保存快照，并在历史不足时保持真实等待状态', async () => {
    const result = await appRouter.createCaller(createCtx()).sovereignBonds.getDailyFactTrend({ sourceKey: 'fred-rates', days: 30 });
    expect(result.success).toBe(true);
    expect(result.definitions.map((definition) => definition.key)).toEqual(['dgs10', 'dgs2', 'spread10y2y']);
    expect(Array.isArray(result.points)).toBe(true);
    expect(result.limitation).toContain(result.available ? '连续日度原始快照' : '不会构造历史曲线');
  });

  it('同步服务覆盖 FRED、财政部、FRED/OECD 与 World Bank，且不写入研究结论', () => {
    const source = readFileSync(new URL('./sovereignDailyFactSync.ts', import.meta.url), 'utf8');
    expect(source).toContain("sourceKey: 'fred-rates'");
    expect(source).toContain("sourceKey: 'treasury-auctions'");
    expect(source).toContain("sourceKey: 'fred-oecd-10y'");
    expect(source).toContain("sourceKey: 'world-bank-macro'");
    expect(source).toContain('不计算预测、信号、评分或投资结论');
    expect(source).not.toContain('syntheticChart');
  });

  it('计划任务端点只接受平台 cron 身份，并在 Vite 回退前完成挂载', () => {
    const source = readFileSync(new URL('./_core/index.ts', import.meta.url), 'utf8');
    const handlerIndex = source.indexOf('/api/scheduled/sovereignFactSync');
    const viteIndex = source.indexOf('setupVite(app, server)');
    expect(handlerIndex).toBeGreaterThan(-1);
    expect(handlerIndex).toBeLessThan(viteIndex);
    expect(source.slice(handlerIndex, handlerIndex + 600)).toContain('user.isCron');
  });

  it('公开行情服务不再以合成历史填补缺失行情', () => {
    const source = readFileSync(new URL('./realDataService.ts', import.meta.url), 'utf8');
    expect(source).not.toContain('syntheticChart');
    expect(source).toContain('绝不生成替代行情');
  });
});
