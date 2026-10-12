import { z } from 'zod';
import { publicProcedure, router } from '../_core/trpc';

/**
 * WBMV - 全球债券驱动者 (World Bond Market Movers)
 * 显示内容：导致债券价格大幅波动的驱动因素
 * 核心指标：Volume Spikes (成交量激增), News Sentiment (新闻情绪), Macro Surprises (宏观惊喜度)
 * 计算逻辑：结合成交量异常检测算法和NLP技术，分析新闻关键词与价格波动的相关性
 */

interface MarketMover {
  id: string;
  rank: number;
  country: string;
  bondName: string;
  tenor: string;
  priceChange: number;
  volumeSpike: number;
  newsSentiment: number;
  macroSurprise: number;
  drivingFactors: string[];
  timestamp: string;
}

interface NewsEvent {
  id: string;
  title: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  score: number;
  keywords: string[];
  impact: 'high' | 'medium' | 'low';
  relatedBonds: string[];
  publishedAt: string;
}

interface MacroSurprise {
  id: string;
  indicator: string;
  country: string;
  expected: number;
  actual: number;
  surprise: number;
  surprisePercent: number;
  releaseDate: string;
}

export const wbmvRouter = router({
  // 获取全球债券市场驱动者排行
  getMarketMovers: publicProcedure
    .input(
      z.object({
        limit: z.number().optional(),
        country: z.string().optional(),
        minVolumeSpikePercent: z.number().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      const limit = input?.limit || 20;
      const minVolumeSpike = input?.minVolumeSpikePercent || 0;

      // 模拟数据：全球债券市场驱动者
      const movers: MarketMover[] = [
        {
          id: 'MOVER_US10Y_1',
          rank: 1,
          country: '美国',
          bondName: 'US 10Y Treasury',
          tenor: '10Y',
          priceChange: -1.24,
          volumeSpike: 245, // 成交量激增 245%
          newsSentiment: -0.78, // 新闻情绪 -0.78（负面）
          macroSurprise: 2.15, // 宏观惊喜度 +2.15（高于预期）
          drivingFactors: ['CPI 数据超预期', '美联储鹰派讲话', '实际收益率上升'],
          timestamp: new Date().toISOString(),
        },
        {
          id: 'MOVER_EUR10Y_2',
          rank: 2,
          country: '欧元区',
          bondName: 'EUR 10Y Bund',
          tenor: '10Y',
          priceChange: -0.87,
          volumeSpike: 189,
          newsSentiment: -0.65,
          macroSurprise: 1.82,
          drivingFactors: ['欧央行政策预期调整', '德国 PMI 数据强劲', '风险情绪恶化'],
          timestamp: new Date().toISOString(),
        },
        {
          id: 'MOVER_JP10Y_3',
          rank: 3,
          country: '日本',
          bondName: 'JGB 10Y',
          tenor: '10Y',
          priceChange: 0.45,
          volumeSpike: 156,
          newsSentiment: 0.42,
          macroSurprise: -1.25,
          drivingFactors: ['日本央行 YCC 政策调整', '日元贬值压力', '全球风险资产反弹'],
          timestamp: new Date().toISOString(),
        },
        {
          id: 'MOVER_CN10Y_4',
          rank: 4,
          country: '中国',
          bondName: 'CGB 10Y',
          tenor: '10Y',
          priceChange: 0.62,
          volumeSpike: 134,
          newsSentiment: 0.58,
          macroSurprise: -0.95,
          drivingFactors: ['PBOC 流动性投放', '房地产政策支持', '经济增速预期上升'],
          timestamp: new Date().toISOString(),
        },
        {
          id: 'MOVER_GB10Y_5',
          rank: 5,
          country: '英国',
          bondName: 'Gilt 10Y',
          tenor: '10Y',
          priceChange: -0.56,
          volumeSpike: 112,
          newsSentiment: -0.38,
          macroSurprise: 0.78,
          drivingFactors: ['英国通胀数据公布', 'BoE 加息预期', '英镑贬值'],
          timestamp: new Date().toISOString(),
        },
      ];

      // 应用过滤
      let filtered = movers;
      if (input?.country) {
        filtered = filtered.filter(m => m.country === input.country);
      }
      if (minVolumeSpike > 0) {
        filtered = filtered.filter(m => m.volumeSpike >= minVolumeSpike);
      }

      return {
        success: true,
        data: filtered.slice(0, limit),
        timestamp: new Date().toISOString(),
        total: filtered.length,
      };
    }),

  // 获取新闻情绪分析
  getNewsSentiment: publicProcedure
    .input(
      z.object({
        country: z.string().optional(),
        limit: z.number().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      const limit = input?.limit || 10;

      // 模拟数据：新闻事件及 NLP 情绪分析
      const newsEvents: NewsEvent[] = [
        {
          id: 'NEWS_1',
          title: '美联储主席暗示可能在下次会议上维持利率不变',
          sentiment: 'positive',
          score: 0.72,
          keywords: ['美联储', '利率', '政策', '鹰派'],
          impact: 'high',
          relatedBonds: ['US2Y', 'US5Y', 'US10Y'],
          publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: 'NEWS_2',
          title: '欧元区 5 月 CPI 环比上升，超出市场预期',
          sentiment: 'negative',
          score: -0.65,
          keywords: ['欧元区', 'CPI', '通胀', '经济数据'],
          impact: 'high',
          relatedBonds: ['EUR2Y', 'EUR5Y', 'EUR10Y'],
          publishedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: 'NEWS_3',
          title: '日本央行维持政策利率不变，植田和男重申 YCC 灵活性',
          sentiment: 'neutral',
          score: 0.15,
          keywords: ['日本央行', 'YCC', '政策', '利率'],
          impact: 'medium',
          relatedBonds: ['JP5Y', 'JP10Y'],
          publishedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: 'NEWS_4',
          title: '中国 PBOC 投放 500 亿元 7 天逆回购，释放流动性信号',
          sentiment: 'positive',
          score: 0.58,
          keywords: ['PBOC', '流动性', '逆回购', '货币政策'],
          impact: 'medium',
          relatedBonds: ['CN5Y', 'CN10Y'],
          publishedAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
        },
      ];

      let filtered = newsEvents;
      if (input?.country) {
        filtered = filtered.filter(n => 
          n.relatedBonds.some(b => b.startsWith(input.country!.substring(0, 2)))
        );
      }

      return {
        success: true,
        data: filtered.slice(0, limit),
        timestamp: new Date().toISOString(),
        total: filtered.length,
      };
    }),

  // 获取宏观惊喜指数
  getMacroSurprises: publicProcedure
    .input(
      z.object({
        country: z.string().optional(),
        limit: z.number().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      const limit = input?.limit || 15;

      // 模拟数据：宏观经济数据及惊喜度
      const surprises: MacroSurprise[] = [
        {
          id: 'MACRO_US_CPI',
          indicator: 'CPI 同比',
          country: 'US',
          expected: 3.4,
          actual: 3.68,
          surprise: 0.28,
          surprisePercent: 8.2,
          releaseDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: 'MACRO_EUR_PMI',
          indicator: '制造业 PMI',
          country: 'EUR',
          expected: 46.5,
          actual: 48.2,
          surprise: 1.7,
          surprisePercent: 3.7,
          releaseDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: 'MACRO_JP_GDP',
          indicator: 'GDP 环比',
          country: 'JP',
          expected: 0.2,
          actual: -0.1,
          surprise: -0.3,
          surprisePercent: -150,
          releaseDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: 'MACRO_CN_INDUSTRIAL',
          indicator: '规模以上工业增加值',
          country: 'CN',
          expected: 5.5,
          actual: 6.1,
          surprise: 0.6,
          surprisePercent: 10.9,
          releaseDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ];

      let filtered = surprises;
      if (input?.country) {
        filtered = filtered.filter(s => s.country === input.country);
      }

      return {
        success: true,
        data: filtered.slice(0, limit),
        timestamp: new Date().toISOString(),
        total: filtered.length,
      };
    }),

  // 获取成交量异常检测结果
  getVolumeAnomalies: publicProcedure
    .input(
      z.object({
        tenor: z.string().optional(),
        minAnomalyScore: z.number().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      return {
        success: true,
        data: [
          {
            bondId: 'US10Y',
            tenor: '10Y',
            normalVolume: 45000,
            actualVolume: 110000,
            anomalyScore: 0.89,
            anomalyType: 'spike',
            reason: 'FOMC 会议前买盘积累',
            timestamp: new Date().toISOString(),
          },
          {
            bondId: 'EUR5Y',
            tenor: '5Y',
            normalVolume: 28000,
            actualVolume: 8000,
            anomalyScore: 0.76,
            anomalyType: 'drop',
            reason: '流动性枯竭，市场观望',
            timestamp: new Date().toISOString(),
          },
        ],
        timestamp: new Date().toISOString(),
      };
    }),

  // 获取债券驱动因素热力图
  getDriverHeatmap: publicProcedure
    .input(
      z.object({
        country: z.string().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      // 返回因素与债券价格变化的相关性矩阵
      return {
        success: true,
        factors: [
          'CPI 数据',
          '央行讲话',
          '利率期货',
          '风险情绪',
          '美元指数',
          '成交量异常',
          '新闻情绪',
          '宏观惊喜',
        ],
        bonds: ['2Y', '5Y', '10Y', '30Y'],
        correlations: [
          [0.78, 0.72, 0.65, 0.52],
          [0.82, 0.75, 0.68, 0.55],
          [0.71, 0.68, 0.62, 0.48],
          [0.65, 0.58, 0.52, 0.42],
          [0.58, 0.52, 0.48, 0.35],
          [0.72, 0.65, 0.58, 0.45],
          [0.68, 0.62, 0.55, 0.42],
          [0.75, 0.68, 0.62, 0.48],
        ],
        timestamp: new Date().toISOString(),
      };
    }),
});
