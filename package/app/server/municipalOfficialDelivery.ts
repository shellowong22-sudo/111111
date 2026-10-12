import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { adminDataModuleContentItems } from '../drizzle/schema';
import { getDb } from './db';
import { getIssuerFundamentals, getMunicipalReference, ISSUER_TERRITORIES, type OfficialSeries } from './municipalWorkbenchData';

export type MunicipalPublishScope = 'funding' | 'curve' | 'issuers';
const sha = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

/** Source content, not request time or receipt id, determines the immutable version. */
export function officialDeliveryDraft(moduleId: string, series: OfficialSeries, prefix = '') {
  if (series.status !== 'available') throw new Error(`${series.id}: 上游未通过本次核验，禁止发布过期资料`);
  const points = series.history.filter(p => p.value != null);
  const point = points.at(-1);
  if (!point) throw new Error(`${series.id}: 没有有效观察`);
  const window = points.slice(-250), values = window.map(p => p.value!);
  const mean = values.reduce((a,b) => a+b,0) / values.length;
  const previous = points.at(-2);
  const title = `${prefix}${series.label} · ${point.date}`;
  const body = `观察值 ${point.value} ${series.unit}；上一有效观察 ${previous?.date ?? '无'}：${previous?.value ?? '—'}。最近 ${window.length} 个有效观察范围 ${Math.min(...values)}—${Math.max(...values)}，均值 ${mean.toFixed(4)} ${series.unit}。序列 ${series.id}；频率 ${series.frequency}；定义：${series.definition}；机构：${series.source}；资料地址：${series.sourceUrl}`;
  const contentHash = sha([moduleId, series.id, series.revision, title, body]);
  return { moduleId, title, body, contentHash, contentKey: `muni-official:${contentHash}`, sourceReference: series.sourceUrl, sourceId: series.id, version: series.revision };
}

let active: Promise<{ inserted: number; duplicates: number; failed: string[]; scope: MunicipalPublishScope }> | null = null;
export async function publishMunicipalOfficial(scope: MunicipalPublishScope, actorUserId: number) {
  if (active) throw new Error('已有地方债核验发布正在执行，请完成后再试');
  active = (async () => {
    const db = await getDb();
    if (!db) throw new Error('DATABASE_UNAVAILABLE');
    const groups: Array<{ moduleId: string; prefix?: string; series: OfficialSeries[] }> = [];
    if (scope === 'issuers') {
      for (const territory of ISSUER_TERRITORIES) {
        const result = await getIssuerFundamentals(territory.id);
        groups.push({ moduleId: 'muni-smun', prefix: territory.name + ' · ', series: result.series });
      }
    } else {
      const result = await getMunicipalReference(scope);
      groups.push({ moduleId: scope === 'curve' ? 'muni-aaa' : 'muni-btmm', series: result.series });
    }
    let inserted = 0, duplicates = 0;
    const failed: string[] = [];
    for (const group of groups) for (const series of group.series) {
      try {
        const draft = officialDeliveryDraft(group.moduleId, series, group.prefix);
        const exists = (await db.select({id:adminDataModuleContentItems.id}).from(adminDataModuleContentItems).where(eq(adminDataModuleContentItems.contentKey,draft.contentKey)).limit(1))[0];
        if (exists) { duplicates++; continue; }
        const now = new Date(), code = group.moduleId.replace('muni-','').toUpperCase();
        await db.insert(adminDataModuleContentItems).values({
          moduleId: draft.moduleId, contentKey: draft.contentKey, title: draft.title, body: draft.body,
          contentHash: draft.contentHash, sourceReference: draft.sourceReference,
          contentType:'generic', sourceKind:'real', status:'delivered', keywords:[series.id], tags:['municipal-official',series.source],
          topic:series.label, category:'官方观察', sortWeight:100, publishedAt:now, deliveryAttempts:1,
          reviewedByUserId:actorUserId, reviewedAt:now, qualityScore:100, dedupeScope:`municipal-official:${group.moduleId}`,
          qualityReport:{ official:true, schemaValidated:true, nullFiltered:true, immutableVersion:draft.version },
          targetPayload:{
            sourceDataUuid:`official:${series.id}`, sourceId:series.id, version:draft.version,
            manualSelection:true, targetPath:`/terminal?open=${code}&module=local-bonds`,
            deliveryReceipt:{ receiptId:draft.contentKey,sentAt:now.toISOString(),targetScope:group.moduleId,sentCount:1,successCount:0,failureCount:0,
              currentStatus:'waiting_front_ack',frontAckAt:null,latestFrontAckAt:null,failureReason:null,retryStatus:'not_required',acknowledgedClientCount:0,acknowledgedClients:[] },
          },
        });
        inserted++;
      } catch(error) { failed.push(error instanceof Error ? error.message : String(error)); }
    }
    return { inserted, duplicates, failed, scope };
  })().finally(() => { active = null; });
  return active;
}
