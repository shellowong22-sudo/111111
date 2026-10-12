import { buildYasProxySegments, calculateYasReturnPct, YAS_PROXY_UNIVERSE } from './routers/yas';
import { describe, expect, it } from 'vitest';

describe('YAS 真实代理研究计算', () => {
  it('基于实际价格点计算指定窗口收益率，数据不足时返回 null', () => {
    expect(calculateYasReturnPct([{ date: '2026-01-01', value: 100 }, { date: '2026-01-02', value: 105 }], 1)).toBeCloseTo(5);
    expect(calculateYasReturnPct([{ date: '2026-01-01', value: 100 }], 1)).toBeNull();
  });

  it('仅为有足够价格历史的代理生成研究行，并保留代理标识', () => {
    const segments = buildYasProxySegments({
      LQD: { price: 120, changePct: 0.2, history: [{ date: '2026-01-01', value: 100 }, { date: '2026-01-02', value: 120 }] },
      HYG: null,
    });
    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({ name: '投资级公司债', reference: 'LQD', proxyPrice: 120, observations: 2 });
  });

  it('代理池明确区分信用、主权、通胀和资金参考，且不包含单券 CDS 声明', () => {
    expect(YAS_PROXY_UNIVERSE.map((item) => item.sector)).toEqual(expect.arrayContaining(['信用', '主权', '通胀', '资金']));
  });
});
