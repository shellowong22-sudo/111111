import { z } from 'zod';
import { publicProcedure, router } from '../_core/trpc';

// ─── Types ────────────────────────────────────────────────────────────────────

type TradeStatus = 'PENDING' | 'CONFIRMED' | 'MATCHED' | 'SETTLED' | 'FAILED' | 'CANCELLED';
type SettlementStatus = 'T0' | 'T1' | 'T2' | 'T3' | 'OVERDUE';
type AssetClass = 'EQUITY' | 'FIXED_INCOME' | 'FX' | 'COMMODITY' | 'DERIVATIVE';

interface Trade {
  id: string;
  tradeRef: string;
  counterparty: string;
  assetClass: AssetClass;
  instrument: string;
  isin?: string;
  direction: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  currency: string;
  notional: number;
  tradeDate: string;
  settlementDate: string;
  settlementStatus: SettlementStatus;
  status: TradeStatus;
  broker: string;
  custodian: string;
  account: string;
  confirmationRef?: string;
  matchRef?: string;
  ssiId?: string;
  fees: number;
  netAmount: number;
  createdAt: number;
  updatedAt: number;
}

interface SSI {
  id: string;
  counterparty: string;
  currency: string;
  assetClass: AssetClass;
  custodianBank: string;
  accountNumber: string;
  accountName: string;
  bic: string;
  iban?: string;
  correspondentBank?: string;
  correspondentBic?: string;
  isDefault: boolean;
  isActive: boolean;
  lastVerified: string;
}

interface NetPosition {
  instrument: string;
  isin: string;
  currency: string;
  grossBuy: number;
  grossSell: number;
  netQuantity: number;
  netAmount: number;
  counterparties: string[];
  tradeCount: number;
  settlementDate: string;
}

interface SettlementAlert {
  id: string;
  tradeRef: string;
  alertType: 'MISMATCH' | 'OVERDUE' | 'SSI_MISSING' | 'COUNTERPARTY_FAIL' | 'FUNDING_SHORTFALL';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  message: string;
  instrument: string;
  amount: number;
  currency: string;
  dueDate: string;
  createdAt: number;
}

const STP_DATA_LIMITATION =
  '未接入可核验的经纪商、清算机构、托管行或用户导入批次；系统不生成示例交易、SSI、结算告警或监管报告。';
type AnyRow = Record<string, any>;
const EMPTY_ROWS: AnyRow[] = [];
const EMPTY_FLOW_STEPS: Array<{
  step: number;
  name: string;
  code: string;
  completedCount: number;
  pendingCount: number;
  failedCount: number;
}> = [];

// ─── Router ───────────────────────────────────────────────────────────────────

export const stpRouter = router({
  // 获取待处理交易列表
  getTrades: publicProcedure
    .input(z.object({
      status: z.enum(['ALL', 'PENDING', 'CONFIRMED', 'MATCHED', 'SETTLED', 'FAILED']).optional().default('ALL'),
      assetClass: z.enum(['ALL', 'EQUITY', 'FIXED_INCOME', 'FX', 'COMMODITY', 'DERIVATIVE']).optional().default('ALL'),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      search: z.string().optional(),
    }))
    .query(() => ({
      trades: [] as Trade[],
      summary: { total: 0, pending: 0, confirmed: 0, matched: 0, settled: 0, failed: 0, totalNotional: null as number | null },
      available: false,
      limitation: STP_DATA_LIMITATION,
    })),

  // 确认交易
  confirmTrade: publicProcedure
    .input(z.object({
      tradeId: z.string(),
      confirmationRef: z.string().optional(),
    }))
    .mutation(() => ({
      available: false as const,
      confirmed: false as const,
      confirmationRef: null as string | null,
      message: STP_DATA_LIMITATION,
    })),

  // 批量确认
  bulkConfirm: publicProcedure
    .input(z.object({
      tradeIds: z.array(z.string()),
    }))
    .mutation(() => ({
      available: false as const,
      confirmed: 0,
      message: STP_DATA_LIMITATION,
    })),

  // 获取净额结算头寸
  getNetPositions: publicProcedure
    .input(z.object({
      settlementDate: z.string().optional(),
      currency: z.string().optional(),
    }))
    .query(() => ({
      positions: [] as NetPosition[],
      summary: { totalInstruments: 0, totalNetBuy: 0, totalNetSell: 0, totalNetAmount: null as number | null, grossBuyAmount: null as number | null, grossSellAmount: null as number | null, nettingEfficiency: null as number | null },
      available: false,
      limitation: STP_DATA_LIMITATION,
    })),

  // 获取 SSI 标准结算指令
  getSSIs: publicProcedure
    .input(z.object({
      counterparty: z.string().optional(),
      assetClass: z.string().optional(),
      currency: z.string().optional(),
    }))
    .query(() => ({
      ssis: [] as SSI[],
      total: 0,
      available: false,
      limitation: STP_DATA_LIMITATION,
    })),

  // 创建/更新 SSI
  upsertSSI: publicProcedure
    .input(z.object({
      id: z.string().optional(),
      counterparty: z.string(),
      currency: z.string(),
      assetClass: z.string(),
      custodianBank: z.string(),
      accountNumber: z.string(),
      accountName: z.string(),
      bic: z.string(),
      iban: z.string().optional(),
      isDefault: z.boolean().optional().default(false),
    }))
    .mutation(() => ({
      available: false as const,
      success: false as const,
      message: STP_DATA_LIMITATION,
    })),

  // 获取结算状态追踪
  getSettlementStatus: publicProcedure
    .input(z.object({
      tradeId: z.string().optional(),
      dateRange: z.enum(['TODAY', 'T1', 'T2', 'T3', 'WEEK']).optional().default('TODAY'),
    }))
    .query(() => ({
      flowSteps: EMPTY_FLOW_STEPS,
      alerts: [] as SettlementAlert[],
      efficiency: null as Record<string, any> | null,
      trades: [] as Trade[],
      available: false,
      limitation: STP_DATA_LIMITATION,
    })),

  // 获取结算分析统计
  getSettlementAnalytics: publicProcedure
    .input(z.object({
      period: z.enum(['1D', '1W', '1M', '3M']).optional().default('1W'),
    }))
    .query(() => ({
      dailyStats: EMPTY_ROWS,
      byAssetClass: EMPTY_ROWS,
      failureReasons: EMPTY_ROWS,
      available: false,
      limitation: STP_DATA_LIMITATION,
    })),

  // 获取监管报告（MiFID II / EMIR）
  getRegulatoryReports: publicProcedure
    .input(z.object({
      reportType: z.enum(['MIFID', 'EMIR', 'SFTR', 'DODD_FRANK']).optional().default('MIFID'),
      status: z.enum(['ALL', 'PENDING', 'SUBMITTED', 'ACCEPTED', 'REJECTED']).optional().default('ALL'),
    }))
    .query(() => ({
      reports: [],
      summary: { total: 0, pending: 0, submitted: 0, accepted: 0, rejected: 0, complianceRate: null as number | null },
      available: false,
      limitation: STP_DATA_LIMITATION,
    })),
});
