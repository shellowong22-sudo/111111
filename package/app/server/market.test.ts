import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const createTestContext = (): TrpcContext => ({
  user: null,
  req: {
    protocol: "https",
    headers: {},
  } as TrpcContext["req"],
  res: {
    clearCookie: () => {},
  } as TrpcContext["res"],
});

describe("market routes", () => {
  it("rejects anonymous market mutations before touching storage", async () => {
    const caller = appRouter.createCaller(createTestContext());
    await expect(caller.market.create({ symbol: "UNAUTH", name: "Unauth", market: "stock" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.market.update({ id: 1, name: "Unauth" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.market.delete({ id: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("should fetch all market data", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.market.getAll();
    expect(Array.isArray(result)).toBe(true);
  });

  it("should search market data by query", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.market.search({ query: "AAPL" });
    expect(Array.isArray(result)).toBe(true);
  });

  it("should get market data by type", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.market.getByType({ type: "stock" });
    expect(Array.isArray(result)).toBe(true);
  });

  it("should get market data by symbol", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.market.getBySymbol({ symbol: "AAPL" });
    expect(result === null || typeof result === "object").toBe(true);
  });
});
