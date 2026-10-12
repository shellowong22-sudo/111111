import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  adminDataModuleContentItems,
  adminDataModuleProfiles,
  marketData,
} from "../drizzle/schema";
import { getDb } from "./db";
import { generateAdminDataModuleContentDraft } from "./adminDataModuleDelivery";

let originalProfiles: Array<typeof adminDataModuleProfiles.$inferSelect> = [];
let createdContentKey: string | null = null;
let testSymbol: string | null = null;

beforeEach(async () => {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  originalProfiles = (
    await Promise.all(
      ["market", "equity-market"].map(
        async moduleId =>
          (
            await db
              .select()
              .from(adminDataModuleProfiles)
              .where(eq(adminDataModuleProfiles.moduleId, moduleId))
              .limit(1)
          )[0] ?? null
      )
    )
  ).filter(
    (profile): profile is typeof adminDataModuleProfiles.$inferSelect =>
      profile !== null
  );
  if (originalProfiles.length !== 2)
    throw new Error("MARKET_PROFILES_NOT_MATERIALIZED");
  await Promise.all(
    ["market", "equity-market"].map(moduleId =>
      db
        .update(adminDataModuleProfiles)
        .set({
          sourceKind: "real",
          runtimeStatus: "enabled",
          updatedAt: new Date(),
        })
        .where(eq(adminDataModuleProfiles.moduleId, moduleId))
    )
  );
  testSymbol = `T${randomUUID().replaceAll("-", "").slice(0, 15)}`;
  await db.insert(marketData).values({
    symbol: testSymbol,
    name: "Global dedupe integration fixture",
    market: "stock",
    price: "101.25",
    changeVal: "0.35",
    changePct: "0.3469",
    volume: "125000",
    updatedAt: new Date(Date.now() + 60_000),
  });
});

afterEach(async () => {
  const db = await getDb();
  if (!db) return;
  if (createdContentKey)
    await db
      .delete(adminDataModuleContentItems)
      .where(eq(adminDataModuleContentItems.contentKey, createdContentKey));
  if (testSymbol)
    await db.delete(marketData).where(eq(marketData.symbol, testSymbol));
  await Promise.all(
    originalProfiles.map(profile =>
      db
        .update(adminDataModuleProfiles)
        .set({
          sourceKind: profile.sourceKind,
          runtimeStatus: profile.runtimeStatus,
          updatedByUserId: profile.updatedByUserId,
          updatedAt: profile.updatedAt,
        })
        .where(eq(adminDataModuleProfiles.moduleId, profile.moduleId))
    )
  );
  createdContentKey = null;
  testSymbol = null;
  originalProfiles = [];
});

describe("adminDataModuleDelivery global dedupe integration", () => {
  it("对同一既有市场快照跨运行、跨模块返回重复结果，并保持候选内容表中仅一条记录", async () => {
    const first = await generateAdminDataModuleContentDraft({
      moduleId: "market",
      runKey: `modrun_${randomUUID().replaceAll("-", "")}`,
      actorUserId: 1,
    });
    createdContentKey = first.contentKey;
    expect(first.duplicate).toBe(false);
    const second = await generateAdminDataModuleContentDraft({
      moduleId: "equity-market",
      runKey: `modrun_${randomUUID().replaceAll("-", "")}`,
      actorUserId: 1,
    });
    expect(second).toMatchObject({
      contentKey: first.contentKey,
      duplicate: true,
      status: "pending_review",
    });
    const db = await getDb();
    if (!db) throw new Error("DATABASE_UNAVAILABLE");
    const count = await db
      .select()
      .from(adminDataModuleContentItems)
      .where(eq(adminDataModuleContentItems.contentKey, first.contentKey));
    expect(count).toHaveLength(1);
  });
});
