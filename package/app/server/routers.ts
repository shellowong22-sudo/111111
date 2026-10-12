import { openbbAdminRouter } from './routers/openbbAdmin';
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
import { fetchNasdaqHistorical, fetchYahooChart } from "./realDataService";
import { assessMarketFreshness } from "./marketFreshness";
import { getAllMarketData, getMarketDataBySymbol, getMarketDataByType, searchMarketData, createMarketData, updateMarketData, deleteMarketData } from "./db";
import { curvesRouter } from "./routers/curves";
import { financialRouter } from "./routers/financial";
import { fundRouter } from "./routers/fund";
import { searchRouter } from "./routers/search";
import { derivativesRouter } from "./routers/derivatives";
import { derivativesResearchRouter } from "./routers/derivativesResearch";
import { sovereignBondsRouter } from "./routers/sovereignBonds";
import { treasuryDailyYieldRouter } from "./routers/treasuryDailyYield";
import { ticPublicRouter } from "./routers/ticPublic";
import { treasuryHistoricalCurveRouter } from './routers/treasuryHistoricalCurve';
import { ecbForeignExchangeRouter } from "./routers/ecbForeignExchange";
import { blsMacroEvidenceRouter } from "./routers/blsMacroEvidence";
import { sovereignComparisonRouter } from './routers/sovereignComparison';
import { checklistCollaborationRouter } from './routers/checklistCollaboration';
import { sovmRouter } from "./routers/sovm";
import { wbmvRouter } from "./routers/wbmv";
import { fitRouter } from "./routers/fit";
import { futuresOptionsRouter } from "./routers/futuresOptions";
import { wbfAdvancedRouter } from "./routers/wbfAdvanced";
import { creditAdvancedRouter } from './routers/creditAdvanced';
import { creditResearchRouter } from './routers/creditResearch';
import { mortgageResearchRouter } from './routers/mortgageResearch';
import { mortgageCollaborationRouter } from './routers/mortgageCollaboration';
import { mortgageGovernanceAdminRouter } from './routers/mortgageGovernanceAdmin';
import { moneyMarketResearchRouter } from './routers/moneyMarketResearch';
import { moneyMarketPolicyRouter } from './routers/moneyMarketPolicy';
import { moneyMarketPolicyCollaborationRouter } from './routers/moneyMarketPolicyCollaboration';
import { municipalResearchRouter } from './routers/municipalResearch';
import { municipalIssuerEvidenceRouter } from './routers/municipalIssuerEvidence';
import { preferredStockResearchRouter } from './routers/preferredStockResearch';
import { stockMarketResearchRouter } from './routers/stockMarketResearch';
import { commodityResearchRouter } from './routers/commodityResearch';
import { indexResearchRouter } from './routers/indexResearch';
import { indexCollaborationRouter } from './routers/indexCollaboration';
import { forexResearchRouter } from './routers/forexResearch';
import { legacyMarketDataRouter } from './routers/legacyMarketData';
import { energyPublicRouter } from './routers/energyPublic';
import { creditCollaborationRouter } from './routers/creditCollaboration';
import { commsResearchRouter } from './routers/commsResearch';
import { newsResearchRouter } from './routers/newsResearch';
import { creditGovernanceAdminRouter } from './routers/creditGovernanceAdmin';
import { miprRouter } from "./routers/mipr";
import { wirRouter } from "./routers/wir";
import { gcdsRouter } from './routers/gcds';
import { gcdsRealRouter } from './routers/gcds_real';
import { ficmRouter } from './routers/ficm';
import { corrRouter } from './routers/corr';
import { desRouter } from './routers/des';
import { yasRouter } from './routers/yas';
import { topbonRouter } from './routers/topbon';
import { ct10Router } from './routers/ct10';
import { calcRouter } from './routers/calc';
import { pricingRouter } from './routers/pricing';
import { imgrRouter } from './routers/imgr';
import { runzRouter } from './routers/runz';
import { issuanceRouter } from './routers/issuance';
import { inflationRouter } from './routers/inflation';
import { secinfoRouter } from './routers/secinfo';
import { etfRouter } from './routers/etf';
import { secfRouter } from './routers/secf';
import { workbenchRouter } from './routers/workbench';
import { crvfWatchlistRouter } from './routers/crvfWatchlist';
import { newsRouter } from './routers/news';
import { resRouter } from './routers/res';
import { eqbtRouter } from './routers/eqbt';
import { llmRouter } from './routers/llm';
import { modelRouter } from './routers/model';
import { macroRouter } from './routers/macro';
import { portfolioRouter } from './routers/portfolio';
import { equityRouter } from './routers/equity';
import { cryptoRouter } from './routers/crypto';
import { tradingRouter } from './routers/trading';
import { tradebookRouter } from './routers/tradebook';
import { bquantRouter } from './routers/bquant';
import { stpRouter } from './routers/stp';
import { allqRouter } from './routers/allq';
import { orderManagementRouter } from './routers/orderManagement';
import { orderManagementResearchRouter } from './routers/orderManagementResearch';
import { electronicTradingResearchRouter } from './routers/electronicTradingResearch';
import { stpPrivateResearchRouter } from './routers/stpPrivateResearch';
import { tradeBookPrivateResearchRouter } from './routers/tradeBookPrivateResearch';
import { valuationAutomationRouter } from './routers/valuationAutomation';
import { industryGroupPrivateResearchRouter } from './routers/industryGroupPrivateResearch';
import { industryGroupReferenceRouter } from './routers/industryGroupReference';
import { industryGroupOfficialRouter } from './routers/industryGroupOfficial';
import { adminSecurityRouter } from './routers/adminSecurity';
import { adminVisualizationRouter } from './routers/adminVisualization';
import { terminalSecurityRouter } from './routers/terminalSecurity';
import { tradeBlotterRouter } from './routers/tradeBlotter';
import { fixedIncomeTradeRouter } from './routers/fixedIncomeTrade';
import { platformToolsRouter } from './routers/platformTools';
import { marketBriefRouter } from './routers/marketBrief';
import { adminRouter } from './routers/admin';
import { announcementRouter } from './routers/announcement';
import { notificationRouter } from './routers/notification';
import { alertRouter } from './routers/alert';
import { equityListingsRouter } from './routers/equityListings';
import { researchLedgerRouter } from './routers/researchLedger';
import { pmiPublicRouter } from './routers/pmiPublic';
import { econ29DataRouter } from './routers/econ29Data';
import { fedSepPublicRouter } from './routers/fedSepPublic';
import { bondPortfolioRouter } from './routers/bondPortfolio';
import { portfolioRiskRouter } from './routers/portfolioRisk';
import { nceoSimulationRouter } from './routers/nceoSimulation';
import { stockNceoWatchlistRouter } from './routers/stockNceoWatchlist';
import { adminNewsIngestionRouter } from './routers/adminNewsIngestion';
import { adminMarketIngestionRouter } from './routers/adminMarketIngestion';
import { adminDataModulesRouter } from './routers/adminDataModules';
import { adminDataModuleAutomationRouter } from './routers/adminDataModuleAutomation';
import { adminDataModuleDeliveryRouter } from './routers/adminDataModuleDelivery';
import { adminSpiderRouter } from './routers/adminSpider';
import { adminScraplingRouter } from './routers/adminScrapling';
import { freeMarketDataRouter } from './routers/freeMarketData';
import { finmindRouter } from './routers/finmind';
import { ucheerAiRouter } from './routers/ucheerAi';
import { agentReachAdminRouter } from './routers/agentReachAdmin';
import { ucAdminRouter } from './routers/ucAdmin';
import { ucModulesRouter } from './routers/ucModules';
import { ucMarketRouter } from './routers/ucMarket';
import { ucNewsRouter } from './routers/ucNews';
import { ucHubsRouter } from './routers/ucHubs';
import { ucTradeRouter } from './routers/ucTrade';
import { protectedProcedure } from './_core/trpc';
import { getUserPreference, upsertUserPreference, createExportRecord, getExportHistory, recordCurveInteraction, getCurveInteractionHistory } from './db';
import { z } from "zod";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  newsResearch: newsResearchRouter,
  electronicTradingResearch: electronicTradingResearchRouter,
  stpPrivateResearch: stpPrivateResearchRouter,
  tradeBookPrivateResearch: tradeBookPrivateResearchRouter,
  valuationAutomation: valuationAutomationRouter,
  industryGroupPrivateResearch: industryGroupPrivateResearchRouter,
  industryGroupReference: industryGroupReferenceRouter,
  industryGroupOfficial: industryGroupOfficialRouter,
  adminSecurity: adminSecurityRouter,
  adminVisualization: adminVisualizationRouter,
  terminalSecurity: terminalSecurityRouter,
  nceoSimulation: nceoSimulationRouter,
  stockNceoWatchlist: stockNceoWatchlistRouter,
  adminNewsIngestion: adminNewsIngestionRouter,
  adminMarketIngestion: adminMarketIngestionRouter,
  adminDataModules: adminDataModulesRouter,
  adminDataModuleAutomation: adminDataModuleAutomationRouter,
  adminDataModuleDelivery: adminDataModuleDeliveryRouter,
  adminSpider: adminSpiderRouter,
  adminScrapling: adminScraplingRouter,
  openbbAdmin: openbbAdminRouter,
  freeMarketData: freeMarketDataRouter,
  finmind: finmindRouter,
  ucheerAi: ucheerAiRouter,
  agentReachAdmin: agentReachAdminRouter,
  ucAdmin: ucAdminRouter,
  ucModules: ucModulesRouter,
  ucMarket: ucMarketRouter,
  ucNews: ucNewsRouter,
  ucHubs: ucHubsRouter,
  ucTrade: ucTradeRouter,
  treasuryHistoricalCurve: treasuryHistoricalCurveRouter,

  market: router({
    getAll: publicProcedure.query(async () => {
      const data = await getAllMarketData();
      return data;
    }),
    headerObservations: publicProcedure.query(async () => {
      const instruments = [
        { symbol: 'SPY', label: 'SPY' },
        { symbol: 'QQQ', label: 'QQQ' },
        { symbol: 'GLD', label: 'GLD' },
        { symbol: 'EURUSD=X', label: 'EUR/USD' },
      ];
      const queriedAt = new Date().toISOString();
      const items = await Promise.all(instruments.map(async (instrument) => {
        // The header is a current-market surface. Prefer a short intraday bar;
        // a daily observation may be returned for diagnostics, but it must not
        // become a current quote merely because the intraday route failed.
        const intraday = await fetchYahooChart(instrument.symbol, '1d', '1m');
        const daily = intraday ? null : await fetchYahooChart(instrument.symbol, '5d', '1d');
        const chart = intraday ?? daily;
        if (!chart) return {
          ...instrument,
          available: false as const,
          dailyAvailable: false as const,
          price: null,
          changePct: null,
          currency: null,
          observedAt: null,
          source: null,
          realtimeStatus: null,
          freshnessState: 'unknown' as const,
          limitation: '当前公开行情源没有返回可验证观察；终端不显示固定快照价格。',
        };
        const latest = chart.history.at(-1);
        const realtimeStatus = typeof chart.meta.realtimeStatus === 'string'
          ? chart.meta.realtimeStatus
          : chart.meta.persistentFallback === true
            ? 'archived'
            : 'end_of_day';
        const observedAt = typeof chart.meta.observedAt === 'string'
          ? chart.meta.observedAt
          : latest?.timestamp ?? latest?.date ?? null;
        const freshness = assessMarketFreshness({
          status: realtimeStatus,
          observedAt,
        });
        return {
          ...instrument,
          // `available` means current quote available, not merely that a
          // historical row exists. Daily and archived observations remain
          // visible as status metadata only.
          available: freshness.currentAvailable,
          dailyAvailable: freshness.dailyAvailable,
          price: freshness.currentAvailable ? chart.price : null,
          changePct: freshness.currentAvailable ? chart.changePct : null,
          currency: chart.currency,
          observedAt,
          source: chart.source,
          realtimeStatus,
          freshnessState: freshness.state,
          ageMs: freshness.ageMs,
          limitation: freshness.reason,
        };
      }));
      return { queriedAt, items };
    }),
    getByType: publicProcedure.input(z.object({ type: z.string() })).query(async ({ input }) => {
      const data = await getMarketDataByType(input.type);
      return data;
    }),
    getBySymbol: publicProcedure.input(z.object({ symbol: z.string() })).query(async ({ input }) => {
      const data = await getMarketDataBySymbol(input.symbol);
      return data ?? null;
    }),
    getHistory: publicProcedure.input(z.object({ symbol: z.string().trim().min(1).max(24), range: z.enum(['5d', '1mo', '3mo', '6mo', '1y', '2y', '5y']).default('1mo') })).query(async ({ input }) => {
      // Yahoo's public chart endpoint is not consistently reachable from every
      // deployment (for example, some networks return 403).  Keep the same
      // in-place history contract, but use Nasdaq's public historical endpoint
      // for US equities before returning an explicit unavailable state.  This is
      // real OHLCV data; no synthetic or cached placeholder series is created.
      const yahoo = await fetchYahooChart(input.symbol, input.range, '1d');
      const result = yahoo ?? (input.symbol.startsWith('^') ? null : await fetchNasdaqHistorical(input.symbol, input.range, 'stocks'));
      const history = result?.history.filter((point) => point.open !== null && point.high !== null && point.low !== null && point.close !== null) ?? [];
      if (!result || history.length === 0) return { available: false, source: 'Yahoo Finance', history: [], limitation: '当前品种未取得可验证的完整 OHLC 历史行情；系统不会构造 K 线替代数据。' };
      return { available: true, source: result.source, currency: result.currency, history, limitation: result.source === 'Nasdaq historical market data' ? 'Nasdaq 官方公开日频历史；非实时、非可执行报价。' : null };
    }),
    search: publicProcedure.input(z.object({ query: z.string() })).query(async ({ input }) => {
      const data = await searchMarketData(input.query);
      return data;
    }),
     create: adminProcedure.input(z.object({
      symbol: z.string().min(1),
      name: z.string().min(1),
      market: z.enum(['stock','bond','forex','commodity','index','derivative','option','fund']),
      price: z.string().default('0'),
      changeVal: z.string().default('0'),
      changePct: z.string().default('0'),
      volume: z.string().default('0'),
    })).mutation(async ({ input }) => {
      await createMarketData(input);
      return { success: true };
    }),
     update: adminProcedure.input(z.object({
      id: z.number(),
      symbol: z.string().optional(),
      name: z.string().optional(),
      market: z.enum(['stock','bond','forex','commodity','index','derivative','option','fund']).optional(),
      price: z.string().optional(),
      changeVal: z.string().optional(),
      changePct: z.string().optional(),
      volume: z.string().optional(),
    })).mutation(async ({ input }) => {
      const { id, ...rest } = input;
      await updateMarketData(id, rest);
      return { success: true };
    }),
     delete: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await deleteMarketData(input.id);
      return { success: true };
    }),
  }),
  equityListings: equityListingsRouter,

  curves: curvesRouter,
  financial: financialRouter,
  fund: fundRouter,
  search: searchRouter,
  derivatives: derivativesRouter,
  derivativesResearch: derivativesResearchRouter,
  sovereignBonds: sovereignBondsRouter,
  treasuryDailyYield: treasuryDailyYieldRouter,
  ticPublic: ticPublicRouter,
  pmiPublic: pmiPublicRouter,
  econ29Data: econ29DataRouter,
  fedSepPublic: fedSepPublicRouter,
  ecbForeignExchange: ecbForeignExchangeRouter,
  blsMacroEvidence: blsMacroEvidenceRouter,
  sovereignComparison: sovereignComparisonRouter,
  checklistCollaboration: checklistCollaborationRouter,
  sovm: sovmRouter,
  wbmv: wbmvRouter,
  fit: fitRouter,
  futuresOptions: futuresOptionsRouter,
  wbfAdvanced: wbfAdvancedRouter,
  creditAdvanced: creditAdvancedRouter,
  creditResearch: creditResearchRouter,
  mortgageResearch: mortgageResearchRouter,
  mortgageCollaboration: mortgageCollaborationRouter,
  mortgageGovernanceAdmin: mortgageGovernanceAdminRouter,
  moneyMarketResearch: moneyMarketResearchRouter,
  moneyMarketPolicy: moneyMarketPolicyRouter,
  moneyMarketPolicyCollaboration: moneyMarketPolicyCollaborationRouter,
  municipalResearch: municipalResearchRouter,
  municipalIssuerEvidence: municipalIssuerEvidenceRouter,
  preferredStockResearch: preferredStockResearchRouter,
  stockMarketResearch: stockMarketResearchRouter,
  commodityResearch: commodityResearchRouter,
  indexResearch: indexResearchRouter,
  indexCollaboration: indexCollaborationRouter,
  forexResearch: forexResearchRouter,
  legacyMarketData: legacyMarketDataRouter,
  energyPublic: energyPublicRouter,
  creditCollaboration: creditCollaborationRouter,
  commsResearch: commsResearchRouter,
  creditGovernanceAdmin: creditGovernanceAdminRouter,
  mipr: miprRouter,
  wir: wirRouter,
  gcds: gcdsRouter,
  gcdsReal: gcdsRealRouter,
  ficm: ficmRouter,
  corr: corrRouter,
  des: desRouter,
  yas: yasRouter,
  topbon: topbonRouter,
  ct10: ct10Router,
  calc: calcRouter,
  pricing: pricingRouter,
  imgr: imgrRouter,
  runz: runzRouter,
  issuance: issuanceRouter,
  inflation: inflationRouter,
  secinfo: secinfoRouter,
  secf: secfRouter,
  workbench: workbenchRouter,
  crvfWatchlist: crvfWatchlistRouter,
  news: newsRouter,
  res: resRouter,
  eqbt: eqbtRouter,
  llm: llmRouter,
  model: modelRouter,
  macro: macroRouter,
  portfolio: portfolioRouter,
  equity: equityRouter,
  crypto: cryptoRouter,
  trading: tradingRouter,
  tradebook: tradebookRouter,
  bquant: bquantRouter,
  stp: stpRouter,
  allq: allqRouter,
  orderManagement: orderManagementRouter,
  orderManagementResearch: orderManagementResearchRouter,
  tradeBlotter: tradeBlotterRouter,
  fixedIncomeTrade: fixedIncomeTradeRouter,
  platformTools: platformToolsRouter,
  marketBrief: marketBriefRouter,
  etf: etfRouter,
  admin: adminRouter,
  announcement: announcementRouter,
  notification: notificationRouter,
  alert: alertRouter,
  researchLedger: researchLedgerRouter,
  bondPortfolio: bondPortfolioRouter,
  portfolioRisk: portfolioRiskRouter,
  pricingRisk: router({
    getUserPreference: protectedProcedure.query(async ({ ctx }) => {
      return await getUserPreference(ctx.user.id);
    }),
    updateUserPreference: protectedProcedure.input(z.object({
      panelLayout: z.string().optional(),
      varConfidence: z.string().optional(),
      volatilityModel: z.string().optional(),
      valuationModel: z.string().optional(),
      stressScenario: z.string().optional(),
      exportFormat: z.string().optional(),
      lastUpdatedPanel: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      await upsertUserPreference(ctx.user.id, input);
      return { success: true };
    }),
    createExport: protectedProcedure.input(z.object({
      panelId: z.string(),
      panelName: z.string().optional(),
      exportType: z.enum(['PDF', 'Excel', 'CSV']),
      fileUrl: z.string().optional(),
      fileSize: z.number().optional(),
      dataSnapshot: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const exportId = await createExportRecord({
        userId: ctx.user.id,
        ...input,
        exportedAt: Math.floor(Date.now() / 1000),
        expiresAt: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
      });
      return { exportId, success: true };
    }),
    getExportHistory: protectedProcedure.input(z.object({
      limit: z.number().default(20),
    })).query(async ({ ctx, input }) => {
      return await getExportHistory(ctx.user.id, input.limit);
    }),
    recordInteraction: protectedProcedure.input(z.object({
      sourcePanelId: z.string(),
      targetPanelId: z.string(),
      curveId: z.number().optional(),
      period: z.string().optional(),
      value: z.string().optional(),
      parametersPassed: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const interactionId = await recordCurveInteraction({
        userId: ctx.user.id,
        ...input,
        interactedAt: Math.floor(Date.now() / 1000),
      });
      return { interactionId, success: true };
    }),
    getInteractionHistory: protectedProcedure.input(z.object({
      limit: z.number().default(50),
    })).query(async ({ ctx, input }) => {
      return await getCurveInteractionHistory(ctx.user.id, input.limit);
    }),
  }),
});

export type AppRouter = typeof appRouter;
