import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ rows: [] as any[], relations: [] as any[], updates: [] as any[] }));
vi.mock('./db', () => ({
  getDb: async () => ({
    select: (columns?: unknown) => {
      const query: any = {
        from: () => query,
        where: () => query,
        orderBy: () => query,
        limit: async () => columns ? state.rows : state.relations,
        then: (resolve: (value: unknown) => void) => resolve(columns ? state.rows : state.relations),
      };
      return query;
    },
    update: () => ({
      set: (values: any) => ({
        where: async () => {
          state.updates.push(values);
          if (values.targetPayload) state.rows[0].payload = values.targetPayload;
          if (values.pushStatus) state.relations[0].pushStatus = values.pushStatus;
        },
      }),
    }),
  }),
}));

import { acknowledgePublicFeeds, distinctPublicRows, toPublicFeedItem } from './adminModulePublicFeed';

const receipt = () => ({ receiptId: 'push_test', sentAt: '2026-09-09T00:00:00.000Z', targetScope: 'muni-1', sentCount: 1, successCount: 0, pendingCount: 1, frontAckAt: null, acknowledgedClients: [], acknowledgedUserIds: [], acknowledgedTerminals: [] });
beforeEach(() => {
  state.rows = [{ id: 1, moduleId: 'muni-1', contentKey: 'test-content', title: '官方财政统计', body: '财政统计更新了地方政府债券的发行与到期数据。', sourceKind: 'real', publishedAt: null, updatedAt: new Date('2026-09-09T00:00:00Z'), payload: { pushRelationUuid: 'push_test', deliveryReceipt: receipt() } }];
  state.relations = [{ uuid: 'push_test', targetFrontModuleIds: ['muni-1'], pushStatus: 'waiting_front_ack' }];
  state.updates = [];
});

describe('authenticated rendered-content receipts', () => {
  const input = () => ({ path: '/terminal?open=1&module=local-bonds', itemKeys: [toPublicFeedItem(state.rows[0])!.itemKey], clientKey: 'test-browser-client-0001', actorUserId: 7, actorRole: 'admin' });

  it('rejects an unauthenticated receipt before touching data', async () => {
    await expect(acknowledgePublicFeeds({ ...input(), actorUserId: 0 })).rejects.toThrow('FRONT_ACK_AUTHENTICATION_REQUIRED');
    expect(state.updates).toHaveLength(0);
  });

  it('unknown content cannot turn a relation into success', async () => {
    await expect(acknowledgePublicFeeds({ ...input(), itemKeys: ['0'.repeat(24)] })).resolves.toMatchObject({ acknowledged: 0 });
    expect(state.updates).toHaveLength(0);
  });

  it('persists ACK and preserves source timestamp and public identity', async () => {
    const before = toPublicFeedItem(state.rows[0]);
    await expect(acknowledgePublicFeeds(input())).resolves.toMatchObject({ acknowledged: 1 });
    expect(state.rows[0].payload.deliveryReceipt).toMatchObject({ successCount: 1, currentStatus: 'front_acknowledged', acknowledgedClientCount: 1 });
    expect(state.relations[0].pushStatus).toBe('front_acknowledged');
    expect(state.updates[0].updatedAt.toISOString()).toBe('2026-09-09T00:00:00.000Z');
    expect(toPublicFeedItem(state.rows[0])!.itemKey).toBe(before!.itemKey);
    await acknowledgePublicFeeds(input());
    expect(state.rows[0].payload.deliveryReceipt.acknowledgedClientCount).toBe(1);
  });

  it('counts two terminals for one user without counting the user twice', async () => {
    await acknowledgePublicFeeds(input());
    await acknowledgePublicFeeds({ ...input(), clientKey: 'test-browser-client-0002' });
    expect(state.rows[0].payload.deliveryReceipt).toMatchObject({
      successCount: 1,
      pendingCount: 0,
      acknowledgedClientCount: 2,
      acknowledgedUserIds: [7],
    });
    expect(state.rows[0].payload.deliveryReceipt.acknowledgedTerminals).toHaveLength(2);
  });

  it('does not double-count duplicate, unknown, or reordered item keys', async () => {
    const itemKey = toPublicFeedItem(state.rows[0])!.itemKey;
    const first = await acknowledgePublicFeeds({ ...input(), itemKeys: [itemKey, itemKey, '0'.repeat(24)] });
    const second = await acknowledgePublicFeeds({ ...input(), itemKeys: ['0'.repeat(24), itemKey] });
    expect(first.acknowledged).toBe(1);
    expect(second.acknowledged).toBe(1);
    expect(state.rows[0].payload.deliveryReceipt).toMatchObject({
      successCount: 1,
      acknowledgedClientCount: 1,
      acknowledgedUserIds: [7],
    });
  });

  it('does not expose or acknowledge a user-targeted item for another user', async () => {
    state.rows[0].payload.targetAudience = { type: 'users', recipientCount: 1, userIds: [7] };
    const result = await acknowledgePublicFeeds({ ...input(), actorUserId: 8, clientKey: 'test-browser-client-0008' });
    expect(result.acknowledged).toBe(0);
    expect(state.updates).toHaveLength(0);
  });

  it('does not label a multi-module push successful after only one target confirms', async () => {
    state.relations[0].targetFrontModuleIds.push('muni-2');
    await acknowledgePublicFeeds(input());
    expect(state.relations[0].pushStatus).toBe('waiting_front_ack');
    expect(state.updates.at(-1).pushDetail).toContain('1/2');
  });

  it('keeps a targeted push waiting until every selected user has rendered it', async () => {
    state.rows[0].payload.targetAudience = { type: 'users', recipientCount: 2, userIds: [7, 8] };
    state.rows[0].payload.deliveryReceipt = { ...receipt(), sentCount: 2, pendingCount: 2 };
    await acknowledgePublicFeeds(input());
    expect(state.rows[0].payload.deliveryReceipt).toMatchObject({ successCount: 1, pendingCount: 1, currentStatus: 'waiting_front_ack' });
    expect(state.rows[0].payload.deliveryReceipt.acknowledgedTerminals[0]).toMatchObject({ userId: 7 });
    const second = { ...input(), actorUserId: 8, clientKey: 'test-browser-client-0002' };
    await acknowledgePublicFeeds(second);
    expect(state.rows[0].payload.deliveryReceipt).toMatchObject({ successCount: 2, pendingCount: 0, currentStatus: 'front_acknowledged' });
  });

  it('uses the same semantic dedupe rule as the rendered terminal and prefers the canonical root URL', () => {
    const common = '隔夜融资利率回落，成交量同步上升；公开市场操作与资金面变化保持一致。'.repeat(8);
    const rows = [
      { ...state.rows[0], id: 2, sourceReference: 'https://example.com/index.html', title: '站点首页', body: `${common} 页面索引。`, payload: { sourceDataUuid: 'index-copy' } },
      { ...state.rows[0], id: 1, sourceReference: 'https://example.com/', title: '站点首页', body: `${common} 官方首页。`, payload: { sourceDataUuid: 'root-copy' } },
    ];
    const items = distinctPublicRows(rows);
    expect(items).toHaveLength(1);
    expect(items[0].body).toContain('官方首页');
  });

  it('cleans historic crawler page chrome again before rendering it in the terminal', () => {
    const item = toPublicFeedItem({
      ...state.rows[0],
      moduleId: 'mm-22-news',
      sourceReference: 'https://www.financialnews.com.cn/node_3009.html',
      title: '地方 -中国金融新闻网',
      body: [
        '* 官方网站 证券市场信息披露媒体',
        '* 首页', '* 金融管理', '当前位置：首页 > 地方 > **地方**',
        '#### 银龄启新学', '金融服务正在支持地方产业升级。', '###### 2026-09-11 来源：中国金融新闻网',
        '专题', '友情链接', 'https://example.com/footer', 'Copyright © 2026',
      ].join(' '),
    });
    expect(item?.body).toContain('银龄启新学');
    expect(item?.body).toContain('金融服务正在支持地方产业升级');
    expect(item?.body).not.toMatch(/官方网站|当前位置|专题|可视化|友情链接|https?:\/\/|Copyright/);
  });

  it('blocks obsolete site-subscription notices from a financial research feed', () => {
    expect(toPublicFeedItem({
      ...state.rows[0],
      moduleId: 'mm-22-news',
      sourceReference: 'https://www.financialnews.com.cn/2024-11/21/content_412902.html',
      title: '通知 -中国金融新闻网',
      body: '新版电子报系统已经上线，订阅未到期的读者请进入小程序注册，或微信扫描二维码。如需帮助，请联系我们。',
    })).toBeNull();
  });

  it('blocks a portal homepage that only aggregates the same category content', () => {
    expect(toPublicFeedItem({
      ...state.rows[0],
      moduleId: 'mm-22-news',
      sourceReference: 'https://www.financialnews.com.cn/',
      title: '中国金融新闻网',
      body: '金融时报 APP\n\n金融时报 电子报\n\n金融时报 微信\n\n'.concat('各栏目的重复标题与摘要。'.repeat(10)),
    })).toBeNull();
  });

  it('keeps unique category facts but removes repeated article segments across rows', () => {
    const repeated = '共同事件：政策利率保持不变，公开市场操作量与到期量同步公布。'.repeat(3);
    const rows = [
      { ...state.rows[0], id: 2, contentKey: 'delivery-newer', title: '要闻', body: `${repeated}\n\n2026-09-11 来源：央行\n\n要闻独有的流动性分析与期限结构观察。利率、数量和期限信号应在同一时间轴核验。` },
      { ...state.rows[0], id: 1, contentKey: 'delivery-older', title: '金融管理', body: `${repeated}\n\n2026-09-11 来源：央行\n\n金融管理独有的监管口径与制度变化。规则状态、适用对象和生效日期需要分别核验。` },
    ];
    const items = distinctPublicRows(rows);
    expect(items).toHaveLength(2);
    expect(items[0].body).toContain('共同事件');
    expect(items[1].body).not.toContain('共同事件');
    expect(items[1].body).toContain('金融管理独有');
    expect(items[0].deliveryKey).toBe('delivery-newer');
  });
});
