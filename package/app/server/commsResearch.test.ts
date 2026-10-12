import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { commsResearchRouter } from './routers/commsResearch';
import { isCommsDueReminderEligible } from './commsResearchDb';

const root = resolve(import.meta.dirname, '..');
const source = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('通讯研究协作终端层', () => {
  it('公开的受保护路由覆盖成员目录、分派、授权、消息与状态流转', () => {
    expect(Object.keys((commsResearchRouter as any)._def.procedures)).toEqual(expect.arrayContaining(['memberDirectory', 'listThreads', 'getThread', 'createThread', 'addMember', 'postMessage', 'updateStatus', 'updateDue', 'saveReminderRule', 'listReminderEvents', 'listReminderRules', 'batchSetReminderRules', 'listReminderHistory', 'createVersion', 'listVersions', 'reviewVersion', 'getWorkload', 'getWorkloadTrend']));
  });

  it('匿名账户不能读取成员目录、协作线程或写入终端内分派', async () => {
    const caller = commsResearchRouter.createCaller({ user: null, req: {} as any, res: {} as any });
    await expect(caller.memberDirectory({ query: '', limit: 12 })).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    await expect(caller.listThreads({ status: 'all', purpose: 'all', query: '' })).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    await expect(caller.createThread({ title: '不应写入', purpose: 'brief', moduleCode: 'COMMS', classification: 'internal', dueAt: null, initialBody: '匿名账户必须被拒绝。', memberIds: [] })).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    await expect(caller.getWorkload()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    await expect(caller.listReminderEvents({ limit: 12 })).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    await expect(caller.listReminderRules({ state: 'all', query: '' })).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    await expect(caller.batchSetReminderRules({ ruleIds: [1], isActive: false })).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    await expect(caller.listReminderHistory({ limit: 12, threadId: null, status: 'all', from: null, to: null })).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    await expect(caller.getWorkloadTrend({ from: new Date('2026-08-01T00:00:00.000Z'), to: new Date('2026-08-22T00:00:00.000Z') })).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    await expect(caller.createVersion({ threadId: 1, summary: '匿名账户不得创建审阅版本。' })).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('仅在实际到期日进入提前窗口且分派未解决时才符合提醒条件', () => {
    const now = new Date('2026-08-22T00:00:00.000Z');
    expect(isCommsDueReminderEligible({ dueAt: new Date('2026-08-23T01:00:00.000Z'), status: 'open', leadHours: 24 }, now)).toBe(false);
    expect(isCommsDueReminderEligible({ dueAt: new Date('2026-08-22T23:00:00.000Z'), status: 'acknowledged', leadHours: 24 }, now)).toBe(true);
    expect(isCommsDueReminderEligible({ dueAt: new Date('2026-08-22T23:00:00.000Z'), status: 'resolved', leadHours: 24 }, now)).toBe(false);
    expect(isCommsDueReminderEligible({ dueAt: null, status: 'open', leadHours: 24 }, now)).toBe(false);
  });

  it('原面板完整保留后才追加真实账户协作层，且新增层不使用离站链接或演示内容填充', () => {
    const terminal = source('client/src/pages/Terminal.tsx'); const detail = source('client/src/pages/MenuItemDetail.tsx'); const route = source('client/src/components/comms/CommunicationsHubPreservedRoute.tsx'); const layer = source('client/src/components/comms/CommsResearchLayer.tsx');
    expect(terminal).toContain('<CommsPreservedModule moduleId="COMMS-TERMINAL"><MessagingPanel title="通讯与社区" channel="general" /></CommsPreservedModule>');
    expect(detail).toContain("const preserveComms"); expect(detail).toContain("preserveComms('MSG'"); expect(route).toContain('<CommunicationsHub />');
    expect(layer).toContain('当前账户实际创建或获授权访问的研究分派、成员、讨论和状态'); expect(layer).toContain('系统不会以演示社区帖子或伪造团队消息填充。'); expect(layer).toContain('分派到期提醒与账户通知'); expect(layer).toContain('协作负载统计'); expect(layer).toContain('协作负载日期趋势'); expect(layer).toContain('分派完结版本摘要与审阅确认'); expect(layer).toContain('提醒规则批量管理与历史筛选'); expect(layer).toContain('无事件日期不插值'); expect(layer).toContain('trendFrom'); expect(layer).toContain('trendTo'); expect(layer).toContain('请选择不超过 366 天'); expect(layer).not.toMatch(/href=|window\.open|location\.href/);
  });
});
