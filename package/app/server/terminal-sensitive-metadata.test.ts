import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ecst = readFileSync(new URL('../client/src/pages/EconomicDataHub.tsx', import.meta.url), 'utf8');
const delivery = readFileSync(new URL('../client/src/components/ModuleLiveDeliveryTable.tsx', import.meta.url), 'utf8');

describe('terminal sensitive operational metadata boundary', () => {
  it('does not render archive timestamps or collection states in the ECST terminal dialog', () => {
    expect(ecst).not.toContain('最新记录保存');
    expect(ecst).not.toContain('最近采集成功');
    expect(ecst).not.toContain('collection?.lastStatus');
    expect(ecst).not.toContain('savedAt ??');
    expect(ecst).toContain('时效以观察期为准');
  });

  it('keeps provider, query, checksum and raw delivery metadata out of the terminal feed', () => {
    for (const forbidden of [
      'DELIVERY / ACK', '来源状态', '公开来源',
      'dataset.metadata.queriedAt', 'dataset.metadata.checksum.slice',
      '查看原始投递说明', '{body}</p>',
    ]) expect(delivery).not.toContain(forbidden);
    expect(delivery).toContain('仅显示清洗后的业务字段');
    expect(delivery).toContain('数据状态');
  });
});
