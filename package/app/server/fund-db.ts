import { drizzle } from "drizzle-orm/mysql2";
import { eq, like, or, and } from "drizzle-orm";
import { fundData, fundDistributions } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

async function getDb() {
  if (!_db && ENV.databaseUrl) {
    try {
      _db = drizzle(ENV.databaseUrl);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function getAllFunds() {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get funds: database not available");
    return [];
  }

  try {
    const result = await db.select().from(fundData);
    return result || [];
  } catch (error) {
    console.error("[Database] Failed to get all funds:", error);
    return [];
  }
}

export async function getFundById(id: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get fund: database not available");
    return undefined;
  }

  try {
    const result = await db.select().from(fundData).where(eq(fundData.id, id)).limit(1);
    return result.length > 0 ? result[0] : undefined;
  } catch (error) {
    console.error("[Database] Failed to get fund by id:", error);
    return undefined;
  }
}

export async function getFundByCode(code: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get fund: database not available");
    return undefined;
  }

  try {
    const result = await db.select().from(fundData).where(eq(fundData.symbol, code)).limit(1);
    return result.length > 0 ? result[0] : undefined;
  } catch (error) {
    console.error("[Database] Failed to get fund by code:", error);
    return undefined;
  }
}

export async function getFundsByType(type: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get funds: database not available");
    return [];
  }

  try {
    const result = await db.select().from(fundData).where(eq(fundData.fundType, type));
    return result || [];
  } catch (error) {
    console.error("[Database] Failed to get funds by type:", error);
    return [];
  }
}

export async function getFundsByCategory(category: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get funds: database not available");
    return [];
  }

  try {
    const result = await db.select().from(fundData).where(eq(fundData.assetClass, category));
    return result || [];
  } catch (error) {
    console.error("[Database] Failed to get funds by category:", error);
    return [];
  }
}

export async function searchFunds(query: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot search funds: database not available");
    return [];
  }

  try {
    const result = await db.select().from(fundData).where(
      or(
        like(fundData.symbol, `%${query}%`),
        like(fundData.name, `%${query}%`),
        like(fundData.nameEn, `%${query}%`)
      )
    );
    return result || [];
  } catch (error) {
    console.error("[Database] Failed to search funds:", error);
    return [];
  }
}

export async function getFundDistributions(fundId: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get fund distributions: database not available");
    return [];
  }

  try {
    const result = await db.select().from(fundDistributions).where(eq(fundDistributions.fundId, fundId));
    return result || [];
  } catch (error) {
    console.error("[Database] Failed to get fund distributions:", error);
    return [];
  }
}

export async function getFundDistributionsByType(fundId: number, type: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get fund distributions: database not available");
    return [];
  }

  try {
    const result = await db.select().from(fundDistributions).where(
      and(
        eq(fundDistributions.fundId, fundId),
        eq(fundDistributions.distributionType, type)
      )
    );
    return result || [];
  } catch (error) {
    console.error("[Database] Failed to get fund distributions by type:", error);
    return [];
  }
}
