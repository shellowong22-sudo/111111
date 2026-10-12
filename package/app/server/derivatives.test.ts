import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("derivatives.bico", () => {
  it("getSectorOverview returns all 11 sectors", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.derivatives.bico.getSectorOverview({});
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(11);
    // 验证每个行业有必要字段
    for (const sector of result) {
      expect(sector).toHaveProperty("id");
      expect(sector).toHaveProperty("name");
      expect(sector).toHaveProperty("code");
      expect(sector).toHaveProperty("performance");
      expect(sector).toHaveProperty("signal");
      expect(sector).toHaveProperty("altDataScore");
    }
  });

  it("getSectorOverview filters by sector name", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.derivatives.bico.getSectorOverview({ sector: "金融" });
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]?.name).toBe("金融");
  });

  it("getSectorOverview signal values are valid", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.derivatives.bico.getSectorOverview({});
    const validSignals = ["超配", "标配", "低配"];
    for (const sector of result) {
      expect(validSignals).toContain(sector.signal);
    }
  });
});

describe("derivatives.ai", () => {
  it("getAltDataSignals returns signals for BICO module", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.derivatives.ai.getAltDataSignals({ module: "BICO" });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    for (const signal of result) {
      expect(signal).toHaveProperty("source");
      expect(signal).toHaveProperty("signal");
      expect(signal).toHaveProperty("impact");
      expect(signal).toHaveProperty("confidence");
    }
  });

  it("getCausalChain returns causal chain for event", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.derivatives.ai.getCausalChain({ event: "央行加息" });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    for (const node of result) {
      expect(node).toHaveProperty("node");
      expect(node).toHaveProperty("probability");
      expect(node).toHaveProperty("type");
      // trigger nodes don't have lag (they are the initiating event)
      if (node.type !== "trigger") {
        expect(node).toHaveProperty("lag");
      }
    }
  });
});

describe("derivatives.swpm", () => {
  it("getMarketSignals returns market signals with required fields", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.derivatives.swpm.getMarketSignals();
    expect(result).toHaveProperty("altDataSignals");
    expect(result).toHaveProperty("causalChain");
    expect(result).toHaveProperty("riskAlert");
    expect(result.riskAlert).toHaveProperty("level");
    expect(result.riskAlert).toHaveProperty("message");
  });
});
