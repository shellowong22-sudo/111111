import { beforeEach, describe, expect, it, vi } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";

const { getDbMock, observed } = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  observed: [] as Array<{ sql: string; params: unknown[] }>,
}));
vi.mock("./db", () => ({ getDb: getDbMock }));
import { searchAgentReachKnowledge } from "./agentReachKnowledge";

beforeEach(() => {
  observed.length = 0;
  const query = {
    from: () => query,
    where: (where: any) => {
      observed.push(new MySqlDialect().sqlToQuery(where));
      return query;
    },
    orderBy: () => query,
    limit: async () => [],
  };
  getDbMock.mockResolvedValue({ select: () => query });
});

describe("公司知识批准边界", () => {
  it("only retrieves approved rows for Ucheer and searches natural-language terms", async () => {
    await searchAgentReachKnowledge("请根据公司资料分析全球市场风险", 8);
    expect(observed).toHaveLength(1);
    expect(observed[0].sql).toContain("is_push");
    expect(observed[0].params).toContain(true);
    expect(observed[0].params.some((param) => typeof param === "string" && param.includes("市场"))).toBe(true);
  });

  it("lets only the admin path inspect unapproved rows", async () => {
    await searchAgentReachKnowledge("市场风险", 8, true);
    expect(observed).toHaveLength(1);
    expect(observed[0].sql).not.toContain("is_push");
  });

  it("does not describe a disconnected database as an empty admin collection", async () => {
    getDbMock.mockResolvedValueOnce(null);
    await expect(searchAgentReachKnowledge("市场风险", 8, true)).rejects.toThrow("DATABASE_UNAVAILABLE");
  });
});
