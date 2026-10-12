import { publicProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { unifiedSearch, getSearchSuggestions } from "../search-db";

export const searchRouter = router({
  unified: publicProcedure
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ input }) => {
      return await unifiedSearch(input.query);
    }),

  suggestions: publicProcedure
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ input }) => {
      return await getSearchSuggestions(input.query);
    }),
});
