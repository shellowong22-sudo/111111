import { publicProcedure, router } from "../_core/trpc";
import { z } from "zod";
import {
  getAllFunds,
  getFundById,
  getFundByCode,
  getFundsByType,
  getFundsByCategory,
  searchFunds,
  getFundDistributions,
  getFundDistributionsByType,
} from "../fund-db";

export const fundRouter = router({
  getAll: publicProcedure.query(async () => {
    return await getAllFunds();
  }),

  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return await getFundById(input.id);
    }),

  getByCode: publicProcedure
    .input(z.object({ code: z.string() }))
    .query(async ({ input }) => {
      return await getFundByCode(input.code);
    }),

  getByType: publicProcedure
    .input(z.object({ type: z.string() }))
    .query(async ({ input }) => {
      return await getFundsByType(input.type);
    }),

  getByCategory: publicProcedure
    .input(z.object({ category: z.string() }))
    .query(async ({ input }) => {
      return await getFundsByCategory(input.category);
    }),

  search: publicProcedure
    .input(z.object({ query: z.string() }))
    .query(async ({ input }) => {
      return await searchFunds(input.query);
    }),

  getDistributions: publicProcedure
    .input(z.object({ fundId: z.number() }))
    .query(async ({ input }) => {
      return await getFundDistributions(input.fundId);
    }),

  getDistributionsByType: publicProcedure
    .input(z.object({ fundId: z.number(), type: z.string() }))
    .query(async ({ input }) => {
      return await getFundDistributionsByType(input.fundId, input.type);
    }),
});
