import { describe, expect, it } from 'vitest';
import { cleanPublicFeedText, distinctPublicItems, distinctPublicRows, toPublicFeedItem } from './adminModulePublicFeed';

describe('terminal public module content feed', () => {
  it('does not project a crypto-themed generic market event containing an unrelated index', () => {
    expect(toPublicFeedItem({
      moduleId: 'crypto-market', title: '加密资产市场·情绪拐点',
      body: '中证500指数 000905.SS，价格 7435.16。已按关键词分类。',
      sourceKind: 'real', payload: {},
    })).toBeNull();
  });
  it('只保留终端可读内容并生成不可回溯的公开键', () => {
    const item = toPublicFeedItem({
      contentKey: 'spider:push_secret:sov-18-topbon',
      moduleId: 'sov-18-topbon',
      title: '全球债券供给变化',
      body: '主要发行期限的供给节奏出现变化。后台人工定向推送。crawler-v2.0.130。',
      topic: '主权债发行',
      category: '债券资讯',
      sourceKind: 'real',
      publishedAt: new Date('2026-09-04T08:00:00.000Z'),
    });
    expect(item).toMatchObject({ title: '全球债券供给变化', sourceKind: 'public' });
    expect(item?.body.length).toBeLessThan(3000);
    expect(item?.body).toContain('主要发行期限的供给节奏出现变化');
    expect(item?.itemKey).toMatch(/^[a-f0-9]{24}$/);
    expect(JSON.stringify(item)).not.toMatch(/spider|crawler|moduleId|contentKey|后台|推送/i);
  });

  it('内部描述被完全清除时不向终端发送空壳记录', () => {
    expect(cleanPublicFeedText('指定模块；来源链接；后台推送描述')).toBe('');
    expect(toPublicFeedItem({ title: '后台推送', body: 'crawler-v2.0.130', sourceKind: 'simulated' })).toBeNull();
  });

  it('前端分类不暴露站点采集管道名称', () => {
    const item = toPublicFeedItem({
      moduleId: 'mm-22-news',
      title: '短端融资条件更新',
      body: '公开市场操作与短端资金利率出现新的同步变化。',
      category: '站点Spider',
      sourceKind: 'real',
    });
    expect(item?.category).toBe('市场资讯');
    expect(JSON.stringify(item)).not.toMatch(/spider|crawler|爬虫/i);
  });

  it('将旧记录的重复分类标题还原为正文中的实际事件标题', () => {
    const item = toPublicFeedItem({
      moduleId: 'news-top',
      title: '央行与宏观 · 央行与宏观',
      body: '简单说：Federal Reserve Board issues enforcement action against a former employee。后续内容继续说明事件。',
      topic: '央行与宏观',
      category: '央行与宏观',
      sourceKind: 'real',
    });
    expect(item?.title).toBe('美联储对一名前员工采取执法措施');
  });

  it('长英文政策标题也会替换重复分类名，不生成空主体文章', () => {
    const item = toPublicFeedItem({
      moduleId: 'news-top',
      title: '央行与宏观 · 央行与宏观',
      body: 'Federal Reserve Board requests comment on a proposal to modernize its rule governing the extension of credit to bank "insiders"—bank executives, board members and major shareholders who could potentially influence a bank\'s lending decisions。',
      sourceKind: 'real',
    });
    expect(item?.title).toBe('美联储就银行内部人授信规则现代化提案公开征求意见');
    expect(item?.body).not.toContain('主要对象是，');
    expect(item?.body).not.toContain('把放回');
  });

  it('TOP 的既有短记录在读取时保留事实正文且不暴露采集表述', () => {
    const item = toPublicFeedItem({
      moduleId: 'news-top',
      title: 'Federal Reserve Board announces approval of application',
      body: '简单说：Federal Reserve Board announces approval of an application by a banking institution。公开来源。',
      topic: '央行与宏观',
      category: '央行与宏观',
      sourceKind: 'real',
    });
    expect(item?.body.length).toBeLessThan(3000);
    expect(item?.body).not.toMatch(/简单说|公开来源|后台|爬虫|crawler|spider_/i);
    expect(item?.body).toContain('Federal Reserve Board announces approval');
  });

  it('货币市场 NEWS 的既有短记录保留为独立短端事实正文', () => {
    const item = toPublicFeedItem({
      moduleId: 'mm-22-news',
      title: 'Minutes of the Federal Open Market Committee, July 28–29, 2026',
      body: '议息会议纪要补充政策路径线索。纪要提供决策分歧、风险权衡和政策条件的更多背景。',
      sourceKind: 'real',
    });
    expect(item?.body.length).toBeLessThan(3000);
    expect(item?.body).toContain('议息会议纪要补充政策路径线索');
    expect(item?.body).not.toContain('操作利率与资金走廊');
    expect(item?.body).not.toMatch(/股价反应怎么验证|权益估值核对|偿付与融资检验/);
  });

  it('TOP 不再把证券清单或旧风险传导占位记录伪装成新闻', () => {
    expect(toPublicFeedItem({ moduleId: 'news-top', title: 'SJS.HM · 全球股票清单', body: '从证券清单归一化导入。' })).toBeNull();
    expect(toPublicFeedItem({ moduleId: 'news-top', title: 'TOP · 要闻精选 · 风险传导', body: '事件驱动摘要；模块专属评分 60/98。' })).toBeNull();
  });

  it('同一来源实体即使改写版本不同也只在前端保留最新一条', () => {
    const rows = [
      { moduleId: 'sov-18-topbon', title: '央行政策事件', body: '第一版正文已经形成完整事件脉络与关键条款。', publishedAt: new Date('2026-09-06T09:00:00Z'), payload: { sourceDataUuid: 'feed_same' } },
      { moduleId: 'sov-18-topbon', title: '央行政策事件', body: '第二版正文使用了不同措辞和分析结构。', publishedAt: new Date('2026-09-06T08:00:00Z'), payload: { sourceDataUuid: 'feed_same' } },
    ];
    const items = distinctPublicRows(rows);
    expect(items).toHaveLength(1);
    expect(items[0]?.title).toBe('央行政策事件');
  });

  it('同一正文即使更换模块标题也只保留唯一展示', () => {
    const items = distinctPublicItems([
      { title: '宏观与研究', body: '多家监管机构举行桌面演练，讨论跨境金融稳定与处置协作安排。' },
      { title: '衍生品与量化信号', body: '多家监管机构举行桌面演练，讨论跨境金融稳定与处置协作安排。' },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0]?.title).toBe('宏观与研究');
  });

  it('回执更新时间变化不会制造新的公开消息身份', () => {
    const row = {
      moduleId: 'muni-1', title: '财政公开统计更新', body: '本次公开统计更新了地方债发行规模和期限分布。',
      sourceKind: 'real', publishedAt: null,
    };
    const before = toPublicFeedItem({ ...row, updatedAt: new Date('2026-09-09T08:00:00Z') });
    const afterAck = toPublicFeedItem({ ...row, updatedAt: new Date('2026-09-09T09:00:00Z') });
    expect(before?.itemKey).toBe(afterAck?.itemKey);
  });

  it('以白名单标量数据集向既有前端功能交付 OpenBB 数据层', () => {
    const item = toPublicFeedItem({
      contentKey: 'openbb_internal_key',
      moduleId: 'yield-curve',
      title: '美国国债收益率 · federal_reserve',
      body: '美国国债收益率返回 249 条观测，以下为前 12 条。',
      sourceKind: 'real',
      payload: {
        contentLabel: '美国国债收益率 · federal_reserve',
        rewrittenSummary: '美国国债收益率返回 249 条观测，以下为前 12 条。',
        targetAudience: { type: 'users', userIds: [7] },
        deliveryReceipt: { receiptId: 'private' },
        dataset: {
          label: '美国国债收益率',
          columns: ['date', 'year_2', 'year_10'],
          rows: [
            { date: '2026-09-16', year_2: 0.0352, year_10: 0.0406, nested: { mustNotLeak: true } },
            { date: '2026-09-17', year_2: 0.0354, year_10: 0.0408 },
          ],
          metadata: {
            provider: 'federal_reserve', queriedAt: '2026-09-17T10:38:43.255Z', observedAt: '2026-09-16',
            timezone: 'provider-defined', rowCount: 249, quality: 'provider_response', realtimeStatus: 'provider_defined',
            schemaVersion: 'openbb-query-v1', checksum: 'a'.repeat(64),
          },
        },
      },
    });
    expect(item?.dataset).toMatchObject({
      label: '美国国债收益率',
      columns: ['date', 'year_2', 'year_10'],
      metadata: { provider: '', queriedAt: null, rowCount: 249, displayedRowCount: 2, truncated: true },
    });
    expect(item?.dataset?.rows[0]).toEqual({ date: '2026-09-16', year_2: 0.0352, year_10: 0.0406 });
    expect(JSON.stringify(item?.dataset)).not.toMatch(/targetAudience|deliveryReceipt|userIds|mustNotLeak|openbb_internal_key/);
    expect(item?.title).toBe('美国国债收益率');
  });

  it('清理数据集提供商标注时保留标的、国家、段落及原始审计数据', () => {
    const row = {
      title: '库存研究 · 美国 · FRED',
      body: '工商库存发布值及同月变化。\n\nvalue: 125 · note: 收入来源：主营业务\n\n数据提供商：FRED；查询时间：2026-09-19T10:00:00Z；时效：月度发布。',
      payload: { dataset: {
        label: '工商库存', columns: ['date', 'value'], rows: [{ date: '2026-07-01', value: 125 }],
        metadata: { provider: 'FRED', checksum: 'b'.repeat(64), rowCount: 1 },
      } },
    };
    const original = JSON.stringify(row);
    const item = toPublicFeedItem(row);
    expect(item?.title).toBe('库存研究 · 美国');
    expect(item?.body).not.toContain('FRED');
    expect(item?.body).toContain('收入来源：主营业务');
    expect(item?.body).toContain('\n\n');
    expect(item?.body).toContain('查询时间：2026-09-19T10:00:00Z');
    expect(item?.dataset?.metadata.provider).toBe('');
    expect(JSON.stringify(row)).toBe(original);
    expect(toPublicFeedItem({ ...row, updatedAt: new Date() })?.itemKey).toBe(item?.itemKey);
  });

  it('按字面清理提供商后缀且不误删相似标的', () => {
    const payload = { dataset: { label: '股票报价', columns: ['symbol', 'price'], rows: [{ symbol: 'ABC', price: 10 }], metadata: { provider: 'Vendor (US)+', rowCount: 1 } } };
    expect(toPublicFeedItem({ title: '股票报价 · ABC · Vendor (US)+', body: '股票最新报价包含标的和价格字段。', payload })?.title).toBe('股票报价 · ABC');
    expect(toPublicFeedItem({ title: '股票报价 · ABC', body: '股票最新报价包含标的和价格字段。', payload })?.title).toBe('股票报价 · ABC');
  });

  it('keeps runtime diagnostics in administration and redacts provenance columns', () => {
    expect(toPublicFeedItem({ title: 'OpenBB 运行验证', body: 'Archive SHA-256 verified', sourceKind: 'real' })).toBeNull();
    const item = toPublicFeedItem({ title: '利率历史', body: '利率历史包含逐日真实观察与有效期限。', sourceKind: 'real', payload: { dataset: {
      columns: ['date', 'value', 'source_url', 'api_key', 'note'],
      rows: [{ date: '2026-09-18', value: 2.7, source_url: 'http://127.0.0.1:6900', api_key: 'secret', note: 'https://example.com/private' }],
      metadata: { provider: 'private', queriedAt: 'private' },
    } } });
    expect(item?.dataset?.rows).toEqual([{ date: '2026-09-18', value: 2.7, note: null }]);
    expect(JSON.stringify(item)).not.toMatch(/127\.0\.0\.1|secret|https:|private/);
  });
});
