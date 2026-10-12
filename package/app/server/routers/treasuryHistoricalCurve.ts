import { desc, eq } from 'drizzle-orm';
import { curveDataPoints, treasuryHistoricalCurveImports } from '../../drizzle/schema';
import { getDb } from '../db';
import { publicProcedure, router } from '../_core/trpc';

export async function readImportedTreasuryHistoricalCurve() {
  const db = await getDb();
  if (!db) return { available: false as const, limitation: '数据库当前不可用；系统未以 ZIP 测试性曲线或合成历史替代官方资产。' };
  const [audit] = await db.select().from(treasuryHistoricalCurveImports).orderBy(desc(treasuryHistoricalCurveImports.createdAt)).limit(1);
  if (!audit) return { available: false as const, limitation: '尚未导入可核验的美国财政部历史曲线资产；系统保持真实空状态。' };
  const latestRows = await db.select({ dataDate: curveDataPoints.dataDate, period: curveDataPoints.period, value: curveDataPoints.value })
    .from(curveDataPoints)
    .where(eq(curveDataPoints.curveId, audit.curveId))
    .orderBy(desc(curveDataPoints.dataDate))
    .limit(48);
  const latestByDate = new Map<string, Array<{ period: string; value: string }>>();
  for (const row of latestRows) {
    const rows = latestByDate.get(row.dataDate) ?? [];
    rows.push({ period: row.period, value: row.value });
    latestByDate.set(row.dataDate, rows);
  }
  return {
    available: true as const,
    audit: {
      importKey: audit.importKey,
      sourceUrl: audit.sourceUrl,
      sourceSha256: audit.sourceSha256,
      sourceFirstDate: audit.sourceFirstDate,
      sourceLastDate: audit.sourceLastDate,
      samplingRule: audit.samplingRule,
      selectedObservationCount: audit.selectedObservationCount,
      importedPointCount: audit.importedPointCount,
      fetchedAt: audit.fetchedAt.toISOString(),
    },
    latestObservations: Array.from(latestByDate.entries()).slice(0, 3).map(([date, points]) => ({ date, points })),
    limitation: '资产由美国财政部 Daily Treasury Par Yield Curve 官方归档的每月最后一个实际发布观测构成；未插值、未预测，且不是可执行报价、订单簿或交易建议。',
  };
}

export const treasuryHistoricalCurveRouter = router({
  getImported: publicProcedure.query(readImportedTreasuryHistoricalCurve),
});
