import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import {
  getAllCurves,
  getCurvesByRegion,
  getCurvesByCountry,
  getCurvesByType,
  getCurvesByCurrency,
  getCurvesByFilters,
  searchCurves,
  getCurveDetail,
  getCurveDataPoints,
  getCurveHistoricalYields,
  getCurveLatestSnapshot,
  getCurveCategories,
  getCurveRegions,
} from "../curves-db";

export const curvesRouter = router({
  // 获取所有曲线
  getAll: publicProcedure.query(async () => {
    return getAllCurves();
  }),

  // 按地区获取曲线
  getByRegion: publicProcedure
    .input(z.object({ region: z.number() }))
    .query(async ({ input }) => {
      return getCurvesByRegion(input.region);
    }),

  // 按国家获取曲线
  getByCountry: publicProcedure
    .input(z.object({ country: z.string() }))
    .query(async ({ input }) => {
      return getCurvesByCountry(input.country);
    }),

  // 按类型获取曲线
  getByType: publicProcedure
    .input(z.object({ type: z.string() }))
    .query(async ({ input }) => {
      return getCurvesByType(input.type);
    }),

  // 按货币获取曲线
  getByCurrency: publicProcedure
    .input(z.object({ currency: z.string() }))
    .query(async ({ input }) => {
      return getCurvesByCurrency(input.currency);
    }),

  // 按多个条件筛选曲线
  getByFilters: publicProcedure
    .input(
      z.object({
        region: z.string().optional(),
        country: z.string().optional(),
        type: z.string().optional(),
        currency: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      return getCurvesByFilters(input);
    }),

  // 搜索曲线
  search: publicProcedure
    .input(z.object({ keyword: z.string() }))
    .query(async ({ input }) => {
      if (!input.keyword || input.keyword.length === 0) {
        return [];
      }
      return searchCurves(input.keyword);
    }),

  // 获取曲线详情
  getDetail: publicProcedure
    .input(z.object({ curveId: z.number() }))
    .query(async ({ input }) => {
      return getCurveDetail(input.curveId);
    }),

  // 获取曲线数据点
  getDataPoints: publicProcedure
    .input(
      z.object({
        curveId: z.number(),
      })
    )
    .query(async ({ input }) => {
      return getCurveDataPoints(input.curveId);
    }),

  // 获取曲线历史收益率走势（按期限分组的时序数据，用于折线图）
  getHistoricalYields: publicProcedure
    .input(z.object({ curveId: z.number() }))
    .query(async ({ input }) => {
      return getCurveHistoricalYields(input.curveId);
    }),

  // 获取曲线最新日期的期限结构截面（用于收益率曲线形状图）
  getLatestSnapshot: publicProcedure
    .input(z.object({ curveId: z.number() }))
    .query(async ({ input }) => {
      return getCurveLatestSnapshot(input.curveId);
    }),

  // 获取曲线分类
  getCategories: publicProcedure.query(async () => {
    return getCurveCategories();
  }),

  // 获取曲线地区
  getRegions: publicProcedure.query(async () => {
    return getCurveRegions();
  }),
});
