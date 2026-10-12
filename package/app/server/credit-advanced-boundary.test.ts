import { describe, expect, it } from 'vitest';
import { creditAdvancedRouter } from './routers/creditAdvanced';

describe('信用债高级数据边界', () => {
  it('在未接入授权数据时返回可审计空状态，不返回静态证券、随机成交或 CDS 数值', async () => {
    const caller = creditAdvancedRouter.createCaller({} as never);
    const [bonds, trace, cds] = await Promise.all([
      caller.getCreditBonds({}), caller.getTFLOData({}), caller.getGlobalCDS({}),
    ]);
    expect(bonds.bonds).toEqual([]);
    expect(trace.flows).toEqual([]);
    expect(trace.stats).toBeNull();
    expect(cds.sovereignCDS).toEqual([]);
    expect(bonds.modelInfo.limitation).toContain('不展示样本');
  });
});
