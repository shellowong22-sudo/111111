/**
 * 信用债高级接口的兼容层。
 *
 * 本路由以前返回固定证券、随机成交、合成 CDS 与模型预测。由于当前没有对应的
 * 获授权实时数据连接，所有端点现保留原有响应键但返回真实空状态，避免静态样本被
 * 误解为市场事实。公开指数级 OAS 与 SEC 披露请使用 creditResearch 路由。
 */
import { z } from 'zod';
import { publicProcedure, router } from '../_core/trpc';

const CREDIT_DATA_LIMITATION = '未接入获授权的单券报价、TRACE 逐笔成交、CDS 点位、评级迁移或指数成分数据；系统不展示样本、随机路径、合成价格、违约概率或交易信号。';

type UnavailableModelInfo = {
  status: 'unavailable';
  name: string;
  limitation: string;
  alternatives?: string[];
  sourceUrl?: string;
  auc?: number;
  modalities?: string[];
  attentionMechanism?: string;
  horizons?: string[];
  nodes?: number;
  edges?: number;
  dmlFormula?: string;
  scmFormula?: string;
  mlpLayers?: number[];
  lstmUnits?: number;
  predictionHorizon?: string;
  graphStructure?: string;
  convolutionLayers?: number;
  outputDim?: number;
};

type CreditBond = {
  issuer: string;
  ticker: string;
  sector: string;
  price: number;
  yieldPct: number;
  spread: number;
  zSpread: number;
  rating: string;
  pd6m: number;
  pd12m: number;
  aiRating: string;
  aiSignal: string;
  aiConfidence: number;
  riskScore: number;
};

type SovereignCds = {
  country: string;
  iso: string;
  cds1y: number;
  cds3y: number;
  cds5y: number;
  cds10y: number;
  chg5y: number;
  region: string;
  rating: string;
  pd5y: number;
  predictedSpread: number;
  spreadSignal: string;
};

type CdxIndex = {
  name: string;
  region: string;
  type: string;
  spread: number;
  chg: number;
  price: number;
  dv01: number;
  components: number;
  systemicRisk: number;
  idiosyncraticRisk: number;
  predictedSpread: number;
  spreadSignal: string;
};

type FicmSector = {
  sector: string;
  bondCount: number;
  avgSpread: number;
  avgYield: number;
  avgPD12m: number;
  gatRiskScore: number;
  contagionRisk: number;
  signal: string;
  spreadCurve: SpreadPoint[];
};

type SpreadPoint = { date: string; spread: number };
type CdsHistory = { country: string; data: SpreadPoint[] };
type CdxHistory = { id: string; name: string; data: SpreadPoint[] };
type CdxRiskDecomposition = { name: string; systemicRisk: number; idiosyncraticRisk: number };

type TfloStats = {
  totalBuyVol: number;
  totalSellVol: number;
  buyRatio: number;
  institutionalCount: number;
  icebergCount: number;
  avgPriceImpact: number;
};

type TfloPrediction = { predictedPriceImpact: number; liquidityTrend: string };
type TfloFlow = {
  time: string;
  issuer: string;
  side: string;
  price: number;
  yield: number;
  size: number;
  priceImpact: number;
  liquidityScore: number;
  institutionalFlag: boolean;
  icebergFlag: boolean;
  orderFlowSignal: string;
};

export const creditAdvancedRouter = router({
  getCreditBonds: publicProcedure
    .input(z.object({ sector: z.string().optional(), rating: z.string().optional(), signal: z.string().optional() }))
    .query(() => ({ bonds: [] as CreditBond[], modelInfo: { status: 'unavailable' as const, name: '授权单券信用数据未接入', limitation: CREDIT_DATA_LIMITATION, alternatives: ['creditResearch.getOasSnapshot', 'creditResearch.getIssuerFilings'] } as UnavailableModelInfo })),

  getFICMData: publicProcedure
    .input(z.object({ sector: z.string().optional() }))
    .query(() => ({ sectorData: [] as FicmSector[], bonds: [] as CreditBond[], modelInfo: { status: 'unavailable' as const, name: '授权行业信用数据未接入', limitation: CREDIT_DATA_LIMITATION, alternatives: ['FRED / ICE BofA 指数级 OAS'] } as UnavailableModelInfo })),

  getGlobalCDS: publicProcedure
    .input(z.object({ region: z.string().optional() }))
    .query(() => ({ sovereignCDS: [] as SovereignCds[], causalAnalysis: [] as Record<string, never>[], history: [] as CdsHistory[], modelInfo: { status: 'unavailable' as const, name: '授权 CDS 数据未接入', limitation: CREDIT_DATA_LIMITATION, alternatives: ['公开 OAS 研究基准；不作为 CDS 替代'] } as UnavailableModelInfo })),

  getTFLOData: publicProcedure
    .input(z.object({ issuer: z.string().optional(), minSize: z.number().optional() }))
    .query(() => ({ flows: [] as TfloFlow[], stats: null as TfloStats | null, lstmPrediction: null as TfloPrediction | null, modelInfo: { status: 'unavailable' as const, name: 'TRACE 逐笔数据未接入', limitation: CREDIT_DATA_LIMITATION, sourceUrl: 'https://www.finra.org/filing-reporting/trace/data' } as UnavailableModelInfo })),

  getCDXData: publicProcedure
    .input(z.object({ region: z.string().optional(), type: z.string().optional() }))
    .query(() => ({ indices: [] as CdxIndex[], riskDecomposition: [] as CdxRiskDecomposition[], history: [] as CdxHistory[], modelInfo: { status: 'unavailable' as const, name: 'CDX/iTraxx 授权指数数据未接入', limitation: CREDIT_DATA_LIMITATION, alternatives: ['公开 OAS 研究基准；不作为 CDS 指数替代'] } as UnavailableModelInfo })),
});
