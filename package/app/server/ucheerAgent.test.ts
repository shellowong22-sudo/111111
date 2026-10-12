import { describe, expect, it } from "vitest";
import { createUcheerAgentPlan, finishUcheerAgentPlan } from "./ucheerAgent";

describe("Ucheer bounded agent planner", () => {
  const input = {
    messages: [{ role: "user" as const, content: "比较今天全球股票指数的变化并查找最新资料" }],
    context: { module: "股市", symbol: "", market: "全球股票", page: "/terminal" },
    thinkingDepth: "deep" as const,
  };

  it("routes research/comparison requests to bounded financial steps", () => {
    const plan = createUcheerAgentPlan(input, {
      shouldSearch: true,
      query: "全球股票指数 最新资料",
      evaluatedBy: "deterministic",
    }, []);
    expect(plan.role).toBe("comparison");
    expect(plan.requiresFreshEvidence).toBe(true);
    expect(plan.steps.map((item) => item.id)).toEqual(["context", "memory", "research", "synthesis", "verification"]);
    expect(plan.steps.find((item) => item.id === "research")?.status).toBe("pending");
  });

  it("marks missing evidence as blocked instead of presenting a false result", () => {
    const plan = createUcheerAgentPlan(input, {
      shouldSearch: true,
      query: "全球股票指数 最新资料",
      evaluatedBy: "deterministic",
    }, []);
    const finished = finishUcheerAgentPlan(plan, "unavailable", false);
    expect(finished.steps.find((item) => item.id === "research")).toMatchObject({ status: "blocked" });
    expect(finished.steps.find((item) => item.id === "synthesis")).toMatchObject({ status: "blocked" });
  });
});
