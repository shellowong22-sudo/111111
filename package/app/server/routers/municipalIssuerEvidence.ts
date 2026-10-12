import { createHash } from 'node:crypto';
import { z } from 'zod';
import { listChecklistMemberDirectory } from '../db';
import {
  batchSaveMunicipalEvidenceDocumentTags,
  compareMunicipalEvidenceVersions,
  deleteMunicipalEvidenceSearchPreset,
  listMunicipalEvidenceAudit,
  listMunicipalEvidenceDocuments,
  listMunicipalEvidencePackages,
  listMunicipalEvidenceReviews,
  listMunicipalEvidenceSearchPresets,
  listMunicipalEvidenceShares,
  listMunicipalEvidenceVersions,
  removeMunicipalEvidenceDocument,
  revokeMunicipalEvidenceShare,
  saveMunicipalEvidenceDocument,
  saveMunicipalEvidenceDocumentTags,
  saveMunicipalEvidenceSearchPreset,
  saveMunicipalEvidencePackage,
  saveMunicipalEvidenceReview,
  saveMunicipalEvidenceShare,
  submitMunicipalEvidencePackage,
  searchMunicipalEvidenceDocuments,
  suggestMunicipalEvidenceDocumentTags,
} from '../municipalIssuerEvidenceDb';
import { pushNotificationToUser } from '../uploadAndSse';
import { protectedProcedure, router } from '../_core/trpc';
import { storagePut } from '../storage';

const documentType = z.enum(['official_statement', 'annual_financial', 'operating_disclosure', 'event_notice', 'rating_material', 'other_official']);
const evidenceExtract = z.object({ label: z.string().trim().max(120).default('核验证据'), quotedText: z.string().trim().min(1).max(6000), note: z.string().trim().max(4000).default('') });
const uploadedDocument = z.object({ fileName: z.string().trim().min(1).max(255), mimeType: z.enum(['application/pdf', 'text/plain', 'text/csv', 'application/xml', 'text/xml']), sizeBytes: z.number().int().positive().max(6_000_000), contentBase64: z.string().min(4).max(8_500_000), title: z.string().trim().min(2).max(240).optional(), documentType, documentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(), originalSourceUrl: z.string().url().max(2000).nullable().optional() });

function fingerprint(input: { sourceUrl: string; title: string; sourceInstitution: string; documentDate?: string | null; evidenceExtracts: Array<{ quotedText: string }> }) {
  return createHash('sha256').update(JSON.stringify({ sourceUrl: input.sourceUrl.trim(), title: input.title.trim(), sourceInstitution: input.sourceInstitution.trim(), documentDate: input.documentDate ?? null, extracts: input.evidenceExtracts.map((item) => item.quotedText.trim()) })).digest('hex');
}

export const municipalIssuerEvidenceRouter = router({
  listPackages: protectedProcedure.query(({ ctx }) => listMunicipalEvidencePackages(ctx.user.id)),
  savePackage: protectedProcedure.input(z.object({ packageId: z.number().int().positive().optional(), name: z.string().trim().min(2).max(160), issuerName: z.string().trim().min(2).max(240), issuerIdentifier: z.string().trim().max(80).nullable().optional(), approvalDeadlineAt: z.date().nullable().optional() })).mutation(({ ctx, input }) => saveMunicipalEvidencePackage(ctx.user.id, input)),
  listDocuments: protectedProcedure.input(z.object({ packageId: z.number().int().positive() })).query(({ ctx, input }) => listMunicipalEvidenceDocuments(ctx.user.id, input.packageId)),
  saveDocument: protectedProcedure.input(z.object({ packageId: z.number().int().positive(), sourceUrl: z.string().url().max(2000), title: z.string().trim().min(2).max(240), sourceInstitution: z.string().trim().min(2).max(160), documentType, documentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(), evidenceExtracts: z.array(evidenceExtract).min(1).max(24), retrievedAt: z.date().optional() })).mutation(({ ctx, input }) => saveMunicipalEvidenceDocument(ctx.user.id, { ...input, documentFingerprint: fingerprint(input), retrievedAt: input.retrievedAt ?? new Date() })),
  uploadDocuments: protectedProcedure.input(z.object({ packageId: z.number().int().positive(), sourceInstitution: z.string().trim().min(2).max(160), documents: z.array(uploadedDocument).min(1).max(10) })).mutation(async ({ ctx, input }) => {
    const totalBytes = input.documents.reduce((sum, document) => sum + document.sizeBytes, 0);
    if (totalBytes > 25_000_000) throw new Error('MUNICIPAL_EVIDENCE_BATCH_TOO_LARGE');
    const results = [];
    for (const document of input.documents) {
      const bytes = Buffer.from(document.contentBase64, 'base64');
      if (bytes.length !== document.sizeBytes || bytes.length > 6_000_000) throw new Error('MUNICIPAL_EVIDENCE_UPLOAD_SIZE_MISMATCH');
      const cleanName = document.fileName.replace(/[^A-Za-z0-9._-]/g, '_').slice(-180) || 'official-document';
      const stored = await storagePut(`municipal-evidence/${ctx.user.id}/${input.packageId}/${Date.now()}-${cleanName}`, bytes, document.mimeType);
      const sourceUrl = document.originalSourceUrl ?? stored.url;
      const title = document.title?.trim() || document.fileName.replace(/\.[^.]+$/, '');
      const uploadedFingerprint = createHash('sha256').update(bytes).digest('hex');
      results.push(await saveMunicipalEvidenceDocument(ctx.user.id, { packageId: input.packageId, sourceUrl, title, sourceInstitution: input.sourceInstitution, documentType: document.documentType, documentDate: document.documentDate ?? null, documentFingerprint: uploadedFingerprint, evidenceExtracts: [], retrievedAt: new Date(), storageKey: stored.key, storageUrl: stored.url, uploadedFileName: document.fileName, uploadedMimeType: document.mimeType, uploadedSizeBytes: bytes.length }));
    }
    return { packageId: input.packageId, uploaded: results.length, documents: results };
  }),
  removeDocument: protectedProcedure.input(z.object({ packageId: z.number().int().positive(), documentId: z.number().int().positive() })).mutation(({ ctx, input }) => removeMunicipalEvidenceDocument(ctx.user.id, input.packageId, input.documentId)),
  searchDocuments: protectedProcedure.input(z.object({ packageId: z.number().int().positive(), query: z.string().trim().max(400).optional(), tag: z.string().trim().max(80).optional() })).query(({ ctx, input }) => searchMunicipalEvidenceDocuments(ctx.user.id, input)),
  saveDocumentTags: protectedProcedure.input(z.object({ packageId: z.number().int().positive(), documentId: z.number().int().positive(), tags: z.array(z.string().trim().min(1).max(80)).max(20) })).mutation(({ ctx, input }) => saveMunicipalEvidenceDocumentTags(ctx.user.id, input)),
  batchSaveDocumentTags: protectedProcedure.input(z.object({ packageId: z.number().int().positive(), documentIds: z.array(z.number().int().positive()).min(1).max(100), tags: z.array(z.string().trim().min(1).max(80)).max(20), mode: z.enum(['add', 'replace', 'remove']) })).mutation(({ ctx, input }) => batchSaveMunicipalEvidenceDocumentTags(ctx.user.id, input)),
  suggestDocumentTags: protectedProcedure.input(z.object({ packageId: z.number().int().positive(), documentIds: z.array(z.number().int().positive()).min(1).max(100) })).query(({ ctx, input }) => suggestMunicipalEvidenceDocumentTags(ctx.user.id, input)),
  listSearchPresets: protectedProcedure.input(z.object({ packageId: z.number().int().positive() })).query(({ ctx, input }) => listMunicipalEvidenceSearchPresets(ctx.user.id, input.packageId)),
  saveSearchPreset: protectedProcedure.input(z.object({ packageId: z.number().int().positive(), id: z.number().int().positive().optional(), name: z.string().trim().min(1).max(80), query: z.string().trim().max(400).nullable().optional(), tag: z.string().trim().max(80).nullable().optional() })).mutation(({ ctx, input }) => saveMunicipalEvidenceSearchPreset(ctx.user.id, input)),
  deleteSearchPreset: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => deleteMunicipalEvidenceSearchPreset(ctx.user.id, input.id)),
  searchMembers: protectedProcedure.input(z.object({ query: z.string().trim().max(160).default(''), limit: z.number().int().min(1).max(40).default(20) })).query(({ ctx, input }) => listChecklistMemberDirectory(ctx.user.id, input.query, input.limit)),
  listShares: protectedProcedure.input(z.object({ packageId: z.number().int().positive() })).query(({ ctx, input }) => listMunicipalEvidenceShares(ctx.user.id, input.packageId)),
  saveShare: protectedProcedure.input(z.object({ packageId: z.number().int().positive(), sharedWithUserId: z.number().int().positive(), permission: z.enum(['viewer', 'editor', 'reviewer']) })).mutation(({ ctx, input }) => saveMunicipalEvidenceShare(ctx.user.id, input)),
  revokeShare: protectedProcedure.input(z.object({ packageId: z.number().int().positive(), sharedWithUserId: z.number().int().positive() })).mutation(({ ctx, input }) => revokeMunicipalEvidenceShare(ctx.user.id, input.packageId, input.sharedWithUserId)),
  listReviews: protectedProcedure.input(z.object({ packageId: z.number().int().positive() })).query(({ ctx, input }) => listMunicipalEvidenceReviews(ctx.user.id, input.packageId)),
  listVersions: protectedProcedure.input(z.object({ packageId: z.number().int().positive() })).query(({ ctx, input }) => listMunicipalEvidenceVersions(ctx.user.id, input.packageId)),
  compareVersions: protectedProcedure.input(z.object({ packageId: z.number().int().positive(), leftVersion: z.number().int().positive(), rightVersion: z.number().int().positive() })).query(({ ctx, input }) => compareMunicipalEvidenceVersions(ctx.user.id, input)),
  listAudit: protectedProcedure.input(z.object({ packageId: z.number().int().positive(), limit: z.number().int().min(1).max(200).default(100) })).query(({ ctx, input }) => listMunicipalEvidenceAudit(ctx.user.id, input.packageId, input.limit)),
  submitForReview: protectedProcedure.input(z.object({ packageId: z.number().int().positive(), note: z.string().trim().max(500).nullable().optional() })).mutation(async ({ ctx, input }) => { const result = await submitMunicipalEvidencePackage(ctx.user.id, input.packageId, input.note); result.emitted.forEach((item) => pushNotificationToUser(item.userId, item)); return result; }),
  saveReview: protectedProcedure.input(z.object({ packageId: z.number().int().positive(), status: z.enum(['approved', 'changes_requested']), reviewNote: z.string().trim().max(6000).nullable().optional() })).mutation(async ({ ctx, input }) => { const result = await saveMunicipalEvidenceReview(ctx.user.id, input); result.emitted.forEach((item) => pushNotificationToUser(item.userId, item)); return result; }),
});
