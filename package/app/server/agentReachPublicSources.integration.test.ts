import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { agentReachPublicSources } from "../drizzle/schema";
import { getDb } from "./db";
import { authorizeAgentReachPublicSource, listAgentReachPublicSources, registerAgentReachPublicSource } from "./agentReachDelivery";

describe.skipIf(process.env.RUN_AGENT_REACH_DB_INTEGRATION !== "1")("Agent Reach public source health", () => {
  it("persists an unavailable public URL with its actual reason without publishing or granting it", async () => {
    const db = await getDb();
    expect(db).toBeTruthy();
    const url = `https://localhost/${crypto.randomUUID()}/feed.xml`;
    const hash = createHash("sha256").update(url).digest("hex");
    try {
      const receipt = await registerAgentReachPublicSource(url, 1, true);
      expect(receipt.status).toBe("unavailable");
      expect(receipt.error).toBe("RSS_URL_MUST_USE_PUBLIC_HOST");
      expect(receipt.newlyStored).toBe(0);
      const [stored] = await db!.select().from(agentReachPublicSources)
        .where(eq(agentReachPublicSources.urlHash, hash)).limit(1);
      expect(stored.status).toBe("unavailable");
      expect(stored.lastError).toBe(receipt.error);
      expect((await listAgentReachPublicSources()).some(row => row.id === stored.id)).toBe(true);
      const repeat = await registerAgentReachPublicSource(url, 1, true);
      expect(repeat.status).toBe("unavailable");
      const rows = await db!.select().from(agentReachPublicSources)
        .where(eq(agentReachPublicSources.urlHash, hash));
      expect(rows).toHaveLength(1);
    } finally {
      await db!.delete(agentReachPublicSources).where(eq(agentReachPublicSources.urlHash, hash));
    }
  });
  it("fails closed on an unverified frontend destination", async () => {
    await expect(authorizeAgentReachPublicSource(1, "not-a-real-module", 1))
      .rejects.toThrow("MODULE_HAS_NO_VERIFIED_FRONTEND_FEED");
  });
});
