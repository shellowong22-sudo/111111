import { eq, like, and, or } from "drizzle-orm";
import { curves, curveDataPoints, curveCategories, curveRegions } from "../drizzle/schema";
import { getDb } from "./db";

export async function getAllCurves() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(curves);
}

export async function getCurvesByRegion(regionId: number) {
  const db = await getDb();
  if (!db) return [];
  // Lookup region name from curve_regions table, then filter curves by name
  const regionRows = await db.select().from(curveRegions).where(eq(curveRegions.id, regionId)).limit(1);
  if (regionRows.length > 0) {
    const regionName = regionRows[0].name;
    return db.select().from(curves).where(eq(curves.region, regionName));
  }
  return db.select().from(curves).where(eq(curves.region, String(regionId)));
}

export async function getCurvesByCountry(country: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(curves).where(eq(curves.country, country));
}

export async function getCurvesByType(type: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(curves).where(eq(curves.type, type));
}

export async function getCurvesByCurrency(currency: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(curves).where(eq(curves.currency, currency));
}

export async function searchCurves(keyword: string) {
  const db = await getDb();
  if (!db) return [];
  
  const searchPattern = `%${keyword}%`;
  return db
    .select()
    .from(curves)
    .where(
      or(
        like(curves.name, searchPattern),
        like(curves.curveId, searchPattern),
        like(curves.country, searchPattern)
      )
    );
}

export async function getCurvesByFilters(filters: {
  region?: string;
  country?: string;
  type?: string;
  currency?: string;
}) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  if (filters.region) conditions.push(eq(curves.region, filters.region));
  if (filters.country) conditions.push(eq(curves.country, filters.country));
  if (filters.type) conditions.push(eq(curves.type, filters.type));
  if (filters.currency) conditions.push(eq(curves.currency, filters.currency));
  
  if (conditions.length === 0) {
    return db.select().from(curves);
  }
  
  return db
    .select()
    .from(curves)
    .where(and(...conditions));
}

export async function getCurveDetail(curveId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(curves).where(eq(curves.id, curveId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getCurveDataPoints(curveId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db
    .select()
    .from(curveDataPoints)
    .where(eq(curveDataPoints.curveId, curveId))
    .orderBy(curveDataPoints.dataDate);
}

// 获取指定曲线的历史收益率走势（按期限分组，每个期限返回时序数据）
export async function getCurveHistoricalYields(curveId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(curveDataPoints)
    .where(eq(curveDataPoints.curveId, curveId))
    .orderBy(curveDataPoints.dataDate);
}

// 获取指定曲线在最新日期的完整期限结构（收益率曲线截面）
export async function getCurveLatestSnapshot(curveId: number) {
  const db = await getDb();
  if (!db) return [];
  // 先找最新日期
  const allRows = await db
    .select()
    .from(curveDataPoints)
    .where(eq(curveDataPoints.curveId, curveId))
    .orderBy(curveDataPoints.dataDate);
  if (allRows.length === 0) return [];
  const latestDate = allRows[allRows.length - 1].dataDate;
  return allRows.filter(r => r.dataDate === latestDate);
}

export async function getCurveCategories() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(curveCategories);
}

export async function getCurveRegions() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(curveRegions);
}
