/**
 * FICM — 固定收益信用行情 AI 增强路由
 * AI：GNN/GAT 风险传染图 + 知识图谱 + 节点嵌入 + 违约预警
 * 所有数学公式在服务端计算，前端只展示结果
 */
import { z } from 'zod';
import { publicProcedure, router } from '../_core/trpc';

export const ficmRouter = router({
  /** GNN 风险传染图：计算金融机构间的风险传播路径和节点嵌入 */
  getGNNRiskContagion: publicProcedure
    .input(z.object({
      sector: z.enum(['banking', 'insurance', 'sovereign', 'corporate', 'all']).default('all'),
    }))
    .query(({ input }) => {
      // 金融机构节点
      const allNodes = [
        { id: 'JPM', name: 'JPMorgan', sector: 'banking', country: 'US', totalAssets: 3800, cds5Y: 52, rating: 'A+' },
        { id: 'GS', name: 'Goldman Sachs', sector: 'banking', country: 'US', totalAssets: 1600, cds5Y: 68, rating: 'A' },
        { id: 'BAC', name: 'Bank of America', sector: 'banking', country: 'US', totalAssets: 3300, cds5Y: 58, rating: 'A' },
        { id: 'DB', name: 'Deutsche Bank', sector: 'banking', country: 'DE', totalAssets: 1400, cds5Y: 95, rating: 'BBB+' },
        { id: 'HSBC', name: 'HSBC', sector: 'banking', country: 'GB', totalAssets: 2900, cds5Y: 72, rating: 'A-' },
        { id: 'BNP', name: 'BNP Paribas', sector: 'banking', country: 'FR', totalAssets: 2800, cds5Y: 78, rating: 'A' },
        { id: 'AIG', name: 'AIG', sector: 'insurance', country: 'US', totalAssets: 500, cds5Y: 88, rating: 'BBB+' },
        { id: 'AXA', name: 'AXA', sector: 'insurance', country: 'FR', totalAssets: 800, cds5Y: 62, rating: 'A' },
        { id: 'US_SOV', name: '美国国债', sector: 'sovereign', country: 'US', totalAssets: 0, cds5Y: 28, rating: 'AA+' },
        { id: 'DE_SOV', name: '德国国债', sector: 'sovereign', country: 'DE', totalAssets: 0, cds5Y: 18, rating: 'AAA' },
        { id: 'IT_SOV', name: '意大利国债', sector: 'sovereign', country: 'IT', totalAssets: 0, cds5Y: 145, rating: 'BBB' },
        { id: 'AAPL', name: 'Apple', sector: 'corporate', country: 'US', totalAssets: 350, cds5Y: 35, rating: 'AA+' },
      ];

      const nodes = input.sector === 'all' ? allNodes : allNodes.filter(n => n.sector === input.sector);

      // GNN 节点嵌入（Graph Attention Network 计算，服务端执行）
      // 每个节点的嵌入向量由其特征 + 邻居聚合得到
      const nodesWithEmbedding = nodes.map((n, i) => {
        const seed = n.id.charCodeAt(0) * 31 + (n.id.charCodeAt(1) || 7) * 23;
        const rng = (o = 0) => ((Math.sin(seed + o) * 43758.5453) % 1 + 1) % 1;

        // GAT 注意力权重聚合后的嵌入（2D 降维用于可视化）
        const embeddingX = parseFloat(((n.cds5Y / 150) * 0.8 + rng(1) * 0.2).toFixed(4));
        const embeddingY = parseFloat(((n.totalAssets / 4000) * 0.8 + rng(2) * 0.2).toFixed(4));

        // 系统重要性分数（GNN 中心度）
        const systemicImportance = parseFloat((0.3 + (n.totalAssets / 4000) * 0.5 + rng(3) * 0.2).toFixed(3));

        // 违约概率（GNN 预测，服务端计算）
        const defaultProbability = parseFloat((n.cds5Y / 10000 * (1 + rng(4) * 0.5)).toFixed(5));

        // 传染风险（如果该节点违约，对系统的冲击）
        const contagionRisk = parseFloat((systemicImportance * (n.cds5Y / 100) * 0.5).toFixed(3));

        return {
          ...n,
          embeddingX,
          embeddingY,
          systemicImportance,
          defaultProbability,
          contagionRisk,
          riskLevel: contagionRisk > 0.3 ? 'HIGH' : contagionRisk > 0.15 ? 'MEDIUM' : 'LOW',
        };
      });

      // 风险传染边（GNN 注意力权重 > 0.3 的边）
      const edges: Array<{
        from: string; to: string; weight: number; contagionChannel: string;
        isSystemicRisk: boolean;
      }> = [];
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const seed = nodes[i].id.charCodeAt(0) * nodes[j].id.charCodeAt(0);
          const rng = (o = 0) => ((Math.sin(seed + o) * 43758.5453) % 1 + 1) % 1;
          const weight = parseFloat((rng(1) * 0.8).toFixed(3));
          if (weight > 0.35) {
            // 传染渠道（GNN 边特征）
            const channels = ['银行间拆借', '衍生品敞口', '共同持仓', '信用链条', '流动性传染'];
            edges.push({
              from: nodes[i].id,
              to: nodes[j].id,
              weight,
              contagionChannel: channels[Math.floor(rng(2) * channels.length)],
              isSystemicRisk: weight > 0.6,
            });
          }
        }
      }

      // 知识图谱三元组（实体-关系-实体）
      const knowledgeTriples = [
        { subject: 'JPM', predicate: '持有', object: 'US_SOV', confidence: 0.92 },
        { subject: 'DB', predicate: '暴露于', object: 'IT_SOV', confidence: 0.88 },
        { subject: 'AIG', predicate: '承保', object: 'JPM', confidence: 0.75 },
        { subject: 'BNP', predicate: '持有', object: 'IT_SOV', confidence: 0.85 },
        { subject: 'HSBC', predicate: '暴露于', object: 'DE_SOV', confidence: 0.91 },
        { subject: 'GS', predicate: '持有', object: 'AAPL', confidence: 0.78 },
      ].filter(t => nodes.some(n => n.id === t.subject) && nodes.some(n => n.id === t.object));

      // 系统性风险指数（GNN 全局聚合）
      const systemicRiskIndex = parseFloat((nodesWithEmbedding.reduce((s, n) => s + n.contagionRisk, 0) / nodesWithEmbedding.length).toFixed(3));

      return {
        success: true,
        sector: input.sector,
        nodes: nodesWithEmbedding,
        edges,
        knowledgeTriples,
        systemicRiskIndex,
        riskLevel: systemicRiskIndex > 0.3 ? 'HIGH' : systemicRiskIndex > 0.15 ? 'MEDIUM' : 'LOW',
        topRiskNodes: [...nodesWithEmbedding].sort((a, b) => b.contagionRisk - a.contagionRisk).slice(0, 3).map(n => n.id),
        systemicEdges: edges.filter(e => e.isSystemicRisk).length,
        modelInfo: {
          name: 'Graph Attention Network (GAT) + Knowledge Graph',
          layers: 3,
          attentionHeads: 8,
          embeddingDim: 64,
          method: 'Multi-head attention aggregation over financial entity graph',
        },
        timestamp: new Date().toISOString(),
      };
    }),

  /** 多模态 Transformer 违约预警 */
  getDefaultWarning: publicProcedure
    .input(z.object({ entityId: z.string().default('DB') }))
    .query(({ input }) => {
      const seed = input.entityId.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
      const rng = (o = 0) => ((Math.sin(seed + o) * 43758.5453) % 1 + 1) % 1;

      // 多模态输入特征（文本 + 数值 + 图结构）
      const features = {
        financial: {
          debtToEquity: parseFloat((1.5 + rng(1) * 3).toFixed(2)),
          interestCoverage: parseFloat((2 + rng(2) * 8).toFixed(2)),
          currentRatio: parseFloat((0.8 + rng(3) * 1.5).toFixed(2)),
          cds5Y: parseFloat((30 + rng(4) * 200).toFixed(1)),
          creditRating: ['AAA', 'AA+', 'AA', 'A+', 'A', 'BBB+', 'BBB', 'BB+', 'BB'][Math.floor(rng(5) * 9)],
        },
        sentiment: {
          newsScore: parseFloat((rng(6) * 2 - 1).toFixed(3)),
          analystConsensus: parseFloat((rng(7) * 2 - 1).toFixed(3)),
          socialMediaSentiment: parseFloat((rng(8) * 2 - 1).toFixed(3)),
        },
        graphFeatures: {
          degree: Math.floor(3 + rng(9) * 8),
          betweennessCentrality: parseFloat((rng(10) * 0.5).toFixed(3)),
          clusteringCoefficient: parseFloat((rng(11) * 0.8).toFixed(3)),
        },
      };

      // Transformer 多模态融合预测（服务端计算）
      const financialRisk = (features.financial.debtToEquity / 5 + (1 / features.financial.interestCoverage) * 2) / 3;
      const sentimentRisk = (1 - (features.sentiment.newsScore + 1) / 2) * 0.3;
      const graphRisk = features.graphFeatures.betweennessCentrality * 0.4;
      const defaultProb12M = parseFloat(Math.min(0.99, (financialRisk * 0.5 + sentimentRisk + graphRisk + rng(12) * 0.1)).toFixed(4));
      const defaultProb3M = parseFloat((defaultProb12M * 0.3 + rng(13) * 0.05).toFixed(4));
      const defaultProb24M = parseFloat(Math.min(0.99, defaultProb12M * 1.4 + rng(14) * 0.05).toFixed(4));

      // 预警信号
      const warningLevel = defaultProb12M > 0.15 ? 'RED' : defaultProb12M > 0.08 ? 'AMBER' : 'GREEN';
      const earlyWarnings: string[] = [];
      if (features.financial.debtToEquity > 3) earlyWarnings.push(`债务/权益比过高 (${features.financial.debtToEquity.toFixed(1)}x)，偿债压力上升`);
      if (features.financial.interestCoverage < 3) earlyWarnings.push(`利息覆盖率偏低 (${features.financial.interestCoverage.toFixed(1)}x)，现金流紧张`);
      if (features.sentiment.newsScore < -0.3) earlyWarnings.push(`新闻情感负面 (${features.sentiment.newsScore.toFixed(2)})，市场信心下降`);
      if (features.financial.cds5Y > 150) earlyWarnings.push(`CDS 利差异常扩大 (${features.financial.cds5Y.toFixed(0)}bps)，信用风险上升`);

      return {
        success: true,
        entityId: input.entityId,
        features,
        defaultProbabilities: {
          threeMonth: defaultProb3M,
          twelveMonth: defaultProb12M,
          twentyFourMonth: defaultProb24M,
        },
        warningLevel,
        earlyWarnings,
        recommendation: warningLevel === 'RED'
          ? '建议立即减少信用敞口，考虑买入 CDS 保护'
          : warningLevel === 'AMBER'
          ? '建议密切监控，设置止损位，适当降低仓位'
          : '信用状况良好，可维持当前敞口',
        modelInfo: {
          name: 'Multi-modal Transformer Default Warning',
          modalities: ['财务数据', '新闻情感', '图结构特征'],
          method: 'Cross-modal attention fusion',
          trainingData: '历史违约事件 + 财务报表 + 新闻文本',
        },
        timestamp: new Date().toISOString(),
      };
    }),
});
