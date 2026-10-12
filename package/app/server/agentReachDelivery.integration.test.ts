import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  adminDataModuleContentItems, agentReachModuleGrants, financeWorldDataset,
  spiderAiProcessed, spiderDataBlood, spiderRawData,
} from "../drizzle/schema";
import { getDb } from "./db";
import { ingestAgentReachRead, ingestCompanyKnowledge } from "./agentReachKnowledge";
import { agentReachDeliveryModules, deliverAgentReachRecord, setAgentReachModuleGrant } from "./agentReachDelivery";
import { getPublicModuleFeed } from "./adminModulePublicFeed";

describe.skipIf(process.env.RUN_AGENT_REACH_DB_INTEGRATION !== "1")("Agent Reach DB → human grant → existing frontend feed", () => {
  it("keeps a web homepage archived but refuses to authorize it as news", async () => {
    const db = await getDb();
    expect(db).toBeTruthy();
    const marker = randomUUID();
    const body = `Title: 门户首页 ${marker}\nURL Source: https://example.org/\nMarkdown Content:\n登录注册 Menu 1. 首页首页 ${"市场导航与多篇不同新闻链接。".repeat(25)}`;
    const receipt = await ingestAgentReachRead({
      mode: "web", source: "Jina Reader", url: "https://example.org/",
      observedAt: new Date().toISOString(), title: `Title: 门户首页 ${marker}`, content: body,
    });
    expect(receipt.stored).toBe(1);
    const bloodId = receipt.dataBloodIds[0];
    const [lineage] = await db!.select().from(spiderDataBlood).where(eq(spiderDataBlood.dataBloodId, bloodId)).limit(1);
    const recordUuid = lineage.structuredDataUuid;
    const rawUuid = lineage.rawUuids[0];
    try {
      await expect(setAgentReachModuleGrant({
        recordUuid, moduleId: "news-top", enabled: true, followRss: false, actorUserId: 1,
      })).rejects.toThrow("NEWS_REQUIRES_SINGLE_ARTICLE_TITLE");
      expect(await deliverAgentReachRecord(recordUuid, "news-top")).toBe("not_authorized");
      expect((await getPublicModuleFeed("news-top")).items.some(item => item.title.includes(marker))).toBe(false);
    } finally {
      await db!.delete(adminDataModuleContentItems).where(eq(adminDataModuleContentItems.contentKey, `ar:${recordUuid}:news-top`));
      await db!.delete(agentReachModuleGrants).where(eq(agentReachModuleGrants.recordUuid, recordUuid));
      await db!.delete(spiderDataBlood).where(eq(spiderDataBlood.dataBloodId, bloodId));
      await db!.delete(financeWorldDataset).where(eq(financeWorldDataset.uuid, recordUuid));
      await db!.delete(spiderAiProcessed).where(eq(spiderAiProcessed.rawUuid, rawUuid));
      await db!.delete(spiderRawData).where(eq(spiderRawData.rawUuid, rawUuid));
    }
  }, 30_000);

  it("delivers only an RSS publisher's public excerpt into existing TOP news, not fetched full text", async () => {
    const db = await getDb();
    expect(db).toBeTruthy();
    const marker = randomUUID();
    const feedUrl = `https://example.org/research-public-${marker}/rss.xml`;
    const publisherTime = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toUTCString();
    const summary = `公开摘要：来源端只发布了标题、简述和原始新闻链接，研究编号 ${marker}；这段摘要是允许展示的测试内容。`;
    const fullText = `不应向新闻前端提供的来源原始长文本：${marker}。`.repeat(20);
    const receipt = await ingestAgentReachRead({
      mode: "rss", source: "RSS/Atom", url: feedUrl, observedAt: new Date().toISOString(),
      items: [{
        title: `测试来源公开新闻 ${marker}`, url: `https://example.org/news/${marker}`,
        published: publisherTime, summary, content: fullText,
      }],
    });
    expect(receipt.stored).toBe(1);
    const bloodId = receipt.dataBloodIds[0];
    const [lineage] = await db!.select().from(spiderDataBlood).where(eq(spiderDataBlood.dataBloodId, bloodId)).limit(1);
    const recordUuid = lineage.structuredDataUuid;
    const rawUuid = lineage.rawUuids[0];
    try {
      expect(await deliverAgentReachRecord(recordUuid, "news-top")).toBe("not_authorized");
      const grant = await setAgentReachModuleGrant({
        recordUuid, moduleId: "news-top", enabled: true, followRss: true, actorUserId: 1,
      });
      expect(grant.delivered).toBe("delivered");
      const frontend = await getPublicModuleFeed("news-top");
      const visible = frontend.items.find(item => item.title.includes(marker));
      expect(visible?.body).toContain("公开摘要");
      expect(visible?.body).not.toContain("不应向新闻前端提供");
      expect(new Date(visible!.publishedAt!).toISOString()).toBe(new Date(publisherTime).toISOString());
    } finally {
      await db!.delete(adminDataModuleContentItems).where(eq(adminDataModuleContentItems.contentKey, `ar:${recordUuid}:news-top`));
      await db!.delete(agentReachModuleGrants).where(eq(agentReachModuleGrants.recordUuid, recordUuid));
      await db!.delete(spiderDataBlood).where(eq(spiderDataBlood.dataBloodId, bloodId));
      await db!.delete(financeWorldDataset).where(eq(financeWorldDataset.uuid, recordUuid));
      await db!.delete(spiderAiProcessed).where(eq(spiderAiProcessed.rawUuid, rawUuid));
      await db!.delete(spiderRawData).where(eq(spiderRawData.rawUuid, rawUuid));
    }
  }, 30_000);

  it("never delivers unauthorized records, reuses a single delivery, and retracts on revocation", async () => {
    const db = await getDb();
    expect(db).toBeTruthy();
    const module = agentReachDeliveryModules.find(entry => entry.id === "macro-dashboard");
    expect(module).toBeTruthy();
    const marker = randomUUID();
    const receipt = await ingestCompanyKnowledge({
      title: `授权测试 ${marker}`,
      content: `本地集成测试专用研究事实 ${marker}；请勿用作实际投资建议。`.repeat(15),
      sourceName: "本地集成测试",
    });
    expect(receipt.stored).toBe(1);
    const bloodId = receipt.dataBloodIds[0];
    const [lineage] = await db!.select().from(spiderDataBlood).where(eq(spiderDataBlood.dataBloodId, bloodId)).limit(1);
    const recordUuid = lineage.structuredDataUuid;
    const rawUuid = lineage.rawUuids[0];
    try {
      expect(await deliverAgentReachRecord(recordUuid, module!.id)).toBe("not_authorized");
      const grant = await setAgentReachModuleGrant({
        recordUuid, moduleId: module!.id, enabled: true, followRss: false, actorUserId: 1,
      });
      expect(grant.delivered).toBe("delivered");
      expect(await deliverAgentReachRecord(recordUuid, module!.id)).toBe("already_delivered");
      const visible = await getPublicModuleFeed(module!.id);
      expect(visible.items.some(item => item.title.includes(marker))).toBe(true);
      await setAgentReachModuleGrant({
        recordUuid, moduleId: module!.id, enabled: false, followRss: false, actorUserId: 1,
      });
      expect(await deliverAgentReachRecord(recordUuid, module!.id)).toBe("not_authorized");
      const revoked = await getPublicModuleFeed(module!.id);
      expect(revoked.items.some(item => item.title.includes(marker))).toBe(false);
    } finally {
      // Only this test's uniquely identified records are removed.
      await db!.delete(adminDataModuleContentItems).where(eq(adminDataModuleContentItems.contentKey, `ar:${recordUuid}:${module!.id}`));
      await db!.delete(agentReachModuleGrants).where(eq(agentReachModuleGrants.recordUuid, recordUuid));
      await db!.delete(spiderDataBlood).where(eq(spiderDataBlood.dataBloodId, bloodId));
      await db!.delete(financeWorldDataset).where(eq(financeWorldDataset.uuid, recordUuid));
      await db!.delete(spiderAiProcessed).where(eq(spiderAiProcessed.rawUuid, rawUuid));
      await db!.delete(spiderRawData).where(eq(spiderRawData.rawUuid, rawUuid));
    }
  }, 30_000);

  it("follows only the authorized RSS source and does not authorize an unrelated module", async () => {
    const db = await getDb();
    expect(db).toBeTruthy();
    const marker = randomUUID();
    const rssUrl = "https://example.org/agent-reach-test/rss";
    const bloodIds: string[] = [];
    const recordUuids: string[] = [];
    const rawUuids: string[] = [];
    try {
      for (let index = 0; index < 2; index += 1) {
        const receipt = await ingestAgentReachRead({
          mode: "rss", url: rssUrl, source: "RSS/Atom",
          observedAt: new Date().toISOString(),
          items: [{
            title: `测试订阅 ${index} ${marker}`,
            url: `https://example.org/agent-reach-test/${marker}/${index}`,
            summary: `公开订阅摘要：${index === 0 ? "地方债发行安排" : "全球小麦供应季节性"}的真实公开资料测试 ${marker}。`,
            content: (index === 0
              ? `财政政策对地方债到期安排的公开讨论 ${marker}。报告分析了再融资期限、财政收入与公开的审计时间。`
              : `农业气候对全球小麦供应季节性的公开讨论 ${marker}。报告分析了降雨区间、种植面积与收获阶段的时间安排。`).repeat(9),
          }],
        });
        expect(receipt.stored).toBe(1);
        const bloodId = receipt.dataBloodIds[0];
        bloodIds.push(bloodId);
        const [lineage] = await db!.select().from(spiderDataBlood).where(eq(spiderDataBlood.dataBloodId, bloodId)).limit(1);
        recordUuids.push(lineage.structuredDataUuid);
        rawUuids.push(lineage.rawUuids[0]);
        if (index === 0) {
          await setAgentReachModuleGrant({
            recordUuid: recordUuids[0], moduleId: "macro-dashboard",
            enabled: true, followRss: true, actorUserId: 1,
          });
        }
      }
      expect(await deliverAgentReachRecord(recordUuids[1], "macro-dashboard")).toBe("delivered");
      expect(await deliverAgentReachRecord(recordUuids[1], "interest-rates")).toBe("not_authorized");
      expect(await deliverAgentReachRecord(recordUuids[1], "macro-dashboard")).toBe("already_delivered");
      await setAgentReachModuleGrant({
        recordUuid: recordUuids[0], moduleId: "macro-dashboard",
        enabled: false, followRss: false, actorUserId: 1,
      });
      expect(await deliverAgentReachRecord(recordUuids[1], "macro-dashboard")).toBe("not_authorized");
      expect((await getPublicModuleFeed("macro-dashboard")).items.some(item => item.title.includes(marker))).toBe(false);
    } finally {
      for (const recordUuid of recordUuids) {
        await db!.delete(adminDataModuleContentItems).where(eq(adminDataModuleContentItems.contentKey, `ar:${recordUuid}:macro-dashboard`));
        await db!.delete(agentReachModuleGrants).where(eq(agentReachModuleGrants.recordUuid, recordUuid));
        await db!.delete(financeWorldDataset).where(eq(financeWorldDataset.uuid, recordUuid));
      }
      for (const bloodId of bloodIds) await db!.delete(spiderDataBlood).where(eq(spiderDataBlood.dataBloodId, bloodId));
      for (const rawUuid of rawUuids) {
        await db!.delete(spiderAiProcessed).where(eq(spiderAiProcessed.rawUuid, rawUuid));
        await db!.delete(spiderRawData).where(eq(spiderRawData.rawUuid, rawUuid));
      }
    }
  }, 30_000);
});
