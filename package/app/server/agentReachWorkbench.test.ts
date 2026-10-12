import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./agentReachKnowledge", () => ({
  getAgentReachKnowledgeOverview: vi.fn(),
  ingestAgentReachRead: vi.fn(async () => ({
    status: "unavailable", attempted: 1, stored: 0, deduplicated: 0,
    rejected: 0, qualityAverage: null, dataBloodIds: [], error: "DATABASE_UNAVAILABLE",
  })),
  ingestCompanyKnowledge: vi.fn(),
  listRecentAgentReachKnowledge: vi.fn(),
  searchAgentReachKnowledge: vi.fn(),
  setAgentReachKnowledgeApproval: vi.fn(),
}));

import { readAgentReachPublic, runAgentReachSkill, AGENT_REACH_CHANNELS } from "./agentReachService";
import { connectAgentReachPublicNewsSource } from "./agentReachDelivery";
import { agentReachAdminRouter } from "./routers/agentReachAdmin";
import { ingestAgentReachRead } from "./agentReachKnowledge";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(ingestAgentReachRead).mockClear();
});

describe("Agent Reach 后台技能工作台", () => {
  it("does not turn a web link into a republication feed without rights or licensed FT access", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(connectAgentReachPublicNewsSource("https://example.com/news", 1, false))
      .rejects.toThrow("PUBLIC_NEWS_REDISTRIBUTION_RIGHTS_NOT_CONFIRMED");
    await expect(connectAgentReachPublicNewsSource("https://www.ft.com/", 1, true))
      .rejects.toThrow("FT_NEEDS_LICENSED_REPUBLISHING_FEED");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("keeps every ZIP channel mapped and requires admin for all new actions", async () => {
    expect(AGENT_REACH_CHANNELS).toHaveLength(16);
    const schema = agentReachAdminRouter._def.procedures.runSkill._def.inputs[0]!;
    expect(schema.safeParse({ channelId: "youtube", input: "financial markets" }).success).toBe(true);
    expect(schema.safeParse({ channelId: "xueqiu", action: "quote", input: "SH600519" }).success).toBe(true);
    expect(schema.safeParse({ channelId: "xiaohongshu", input: "市场" }).success).toBe(true);
    expect(schema.safeParse({ channelId: "twitter", input: "private timeline" }).success).toBe(false);
    const caller = agentReachAdminRouter.createCaller({ user: { id: 7, role: "user" } } as any);
    await expect(caller.recentKnowledge()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.deliveryGrants()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.deliveredTopNewsArchive()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.capturePublicWebSource({ websiteUrl: "https://example.com/" }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.storageInventory()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.browseKnowledge({ page: 1, pageSize: 20, query: "", source: "all", approval: "all" }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.knowledgeDetail({ id: `ard_${"a".repeat(32)}` })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.connectPublicNewsSource({ websiteUrl: "https://example.com/feed.xml", rightsConfirmed: true }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.setDeliveryGrant({
      recordUuid: `ard_${"a".repeat(32)}`, moduleId: "macro-dashboard", enabled: true, followRss: false,
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.runDailyDelivery()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.runSkill({ channelId: "v2ex", input: "" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.approveKnowledge({ id: `ard_${"a".repeat(32)}`, approved: true })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects loopback, private and encoded address before making an outgoing request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    for (const url of [
      "http://127.0.0.1/feed",
      "http://10.0.0.4/feed",
      "http://[::1]/feed",
      "http://[::ffff:7f00:1]/feed",
      "http://localhost.local/feed",
      "http://2130706433/feed",
      "http://user:password@example.com/feed",
    ]) {
      await expect(readAgentReachPublic({ mode: "rss", url })).rejects.toThrow();
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns only real upstream records and never invents an empty success", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ items: [{ full_name: "example/project", html_url: "https://github.com/example/project", description: "公开仓库", updated_at: "2026-10-01T00:00:00Z" }] }),
      })
      .mockResolvedValueOnce({ ok: true, text: async () => JSON.stringify({ items: [] }) });
    vi.stubGlobal("fetch", fetchMock);
    const result = await runAgentReachSkill({ channelId: "github", input: "example" });
    expect(result.items[0].url).toBe("https://github.com/example/project");
    expect(result.storage.status).toBe("unavailable");
    await expect(runAgentReachSkill({ channelId: "github", input: "missing" })).rejects.toThrow("GITHUB_EMPTY_RESULT");
  });

  it("requires a real XHS session and never persists xsec_token in the company dataset", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: { is_logged_in: true } }) })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ success: true, data: { items: [{
          id: "64c123ab45d67ef890ab1234", xsec_token: "verifiable-note-token",
          note_card: { display_title: "研究笔记", desc: "真实内容来自上游笔记，保留提取正文并做质量清洗。".repeat(5) },
        }] } }),
      });
    vi.stubGlobal("fetch", fetchMock);
    const result = await runAgentReachSkill({ channelId: "xiaohongshu", input: "市场" });
    expect(result.items[0].url).toContain("xsec_token=verifiable-note-token");
    expect(vi.mocked(ingestAgentReachRead).mock.calls[0][0].items?.[0].url).toBe(
      "https://www.xiaohongshu.com/explore/64c123ab45d67ef890ab1234",
    );
    expect(result.storage.status).toBe("unavailable");
  });

  it("refuses XHS search when its installed service has no authenticated session", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: { is_logged_in: false } }) });
    vi.stubGlobal("fetch", fetchMock);
    await expect(runAgentReachSkill({ channelId: "xiaohongshu", input: "市场" })).rejects.toThrow("XHS_LOGIN_REQUIRED");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
