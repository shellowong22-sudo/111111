/** 新发行、事项与评级研究路由：仅返回可追溯原始事实；不生成预测、概率、估值或替代数据。 */
import { publicProcedure, router } from '../_core/trpc';
import { fetchTreasuryAuctions } from '../realDataService';

export const issuanceRouter = router({
  /** 美国财政部官方一级市场拍卖记录；不是二级市场报价或新券投资结论。 */
  getNewIssuances: publicProcedure.query(async () => {
    const auctions = await fetchTreasuryAuctions(50);
    return {
      success: true,
      available: auctions.length > 0,
      source: 'U.S. Treasury Fiscal Data',
      sourceUrl: 'https://fiscaldata.treasury.gov/datasets/treasury-securities-auctions-data/',
      classification: 'official_primary_market_auction_reference',
      items: auctions.map((auction) => ({
        id: `${auction.cusip}-${auction.auctionDate}`,
        issuer: 'U.S. Treasury',
        cusip: auction.cusip,
        securityType: auction.securityType,
        securityTerm: auction.securityTerm,
        auctionDate: auction.auctionDate,
        issueDate: auction.issueDate,
        maturityDate: auction.maturityDate,
        offeringAmount: auction.offeringAmount,
        bidToCoverRatio: auction.bidToCoverRatio,
        resultMetricLabel: auction.resultMetricLabel,
        resultMetricValue: auction.resultMetricValue,
        couponRate: auction.couponRate,
      })),
      limitation: auctions.length ? '仅展示美国财政部官方一级市场拍卖字段；未包含经授权的二级报价、认购预测、估值偏差或首日表现。' : '本次未取得官方拍卖记录；系统未使用静态或模拟发行信息替代。',
      timestamp: new Date().toISOString(),
    };
  }),

  /** 未配置可验证的事件原始来源时保持空，供界面显示来源登记入口。 */
  getCorporateEvents: publicProcedure.query(() => ({
    success: true,
    available: false,
    events: [],
    source: null,
    limitation: '当前未接入可追溯的公司或主权事项原始来源。请在 NIM 事项核验日志中登记可访问的官方公告或可信来源；系统不会生成情绪、因果链或价格影响。',
    timestamp: new Date().toISOString(),
  })),

  /** 未配置评级机构原始公告连接时保持空，避免伪造评级或展望。 */
  getRatingsWatch: publicProcedure.query(() => ({
    success: true,
    available: false,
    issuers: [],
    source: null,
    limitation: '当前未接入可追溯的评级机构公告原始来源。请在 NIM 评级来源记录中登记原始公告 URL；系统不会生成隐含评分、上调/下调概率或替代数据预警。',
    timestamp: new Date().toISOString(),
  })),
});
