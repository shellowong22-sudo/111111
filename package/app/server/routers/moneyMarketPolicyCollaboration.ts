import { createHash } from 'node:crypto';
import { z } from 'zod';
import { protectedProcedure, router } from '../_core/trpc';
import { listChecklistMemberDirectory } from '../db';
import { inspectOfficialPolicyDocument } from './moneyMarketPolicy';
import { capturePolicyEvidenceDocument, comparePolicyEvidenceGuidance, listPolicyEvidenceAnnotations, listPolicyEvidenceAudit, listPolicyEvidenceDocuments, listPolicyEvidenceShares, revokePolicyEvidenceShare, savePolicyEvidenceAnnotation, savePolicyEvidenceShare } from '../policyEvidenceDb';
import { createPolicyEvidenceMention, getPolicyEvidenceVersionReview, listBoomSubscriptionPresetShares, listBoomSubscriptionPresets, listPolicyEvidenceMentions, resolvePolicyEvidenceMention, revokeBoomSubscriptionPresetShare, saveBoomSubscriptionPreset, saveBoomSubscriptionPresetShare, savePolicyEvidenceVersionReview } from '../policyWorkflowDb';
import { pushNotificationToUser } from '../uploadAndSse';

const sourceId = z.enum(['FED', 'ECB', 'BOE', 'PBOC', 'CBC', 'BCB']);
const annotationInput = z.object({ annotationId: z.number().int().positive().optional(), documentId: z.number().int().positive(), category: z.enum(['key_rate', 'policy_action', 'forward_guidance', 'manual_note']), quotedText: z.string().trim().min(1).max(6000), annotation: z.string().trim().min(1).max(12000), highlightColor: z.enum(['amber', 'cyan', 'rose', 'emerald', 'violet']), startOffset: z.number().int().min(0).nullable().optional(), endOffset: z.number().int().min(0).nullable().optional() });

export const moneyMarketPolicyCollaborationRouter = router({
  listDocuments: protectedProcedure.input(z.object({ sourceId: sourceId.optional(), limit: z.number().int().min(1).max(200).default(100) }).optional()).query(({ ctx, input }) => listPolicyEvidenceDocuments(ctx.user.id, input?.sourceId, input?.limit)),
  captureDocument: protectedProcedure.input(z.object({ sourceId, url: z.string().url().max(2000), title: z.string().trim().max(240).optional() })).mutation(async ({ ctx, input }) => {
    const inspected = await inspectOfficialPolicyDocument(input.sourceId, input.url);
    const fingerprint = createHash('sha256').update(`${input.sourceId}|${input.url}|${inspected.text}`).digest('hex');
    return capturePolicyEvidenceDocument(ctx.user.id, { sourceId: input.sourceId, sourceUrl: input.url, title: input.title?.trim() || `${inspected.source.label} · ${new URL(input.url).pathname}`, documentFingerprint: fingerprint, retrievedAt: new Date(inspected.retrievedAt), highlights: inspected.highlights, guidanceEvidence: inspected.highlights.filter((item) => item.category === 'forward_guidance').map((item) => ({ phrase: item.phrase, context: item.context })) });
  }),
  listAnnotations: protectedProcedure.input(z.object({ documentId: z.number().int().positive(), limit: z.number().int().min(1).max(200).default(120) })).query(({ ctx, input }) => listPolicyEvidenceAnnotations(ctx.user.id, input.documentId, input.limit)),
  saveAnnotation: protectedProcedure.input(annotationInput).mutation(async ({ ctx, input }) => ({ id: await savePolicyEvidenceAnnotation(ctx.user.id, input) })),
  listShares: protectedProcedure.input(z.object({ documentId: z.number().int().positive() })).query(({ ctx, input }) => listPolicyEvidenceShares(ctx.user.id, input.documentId)),
  searchMembers: protectedProcedure.input(z.object({ query: z.string().trim().max(80).default(''), limit: z.number().int().min(1).max(50).default(20) })).query(({ ctx, input }) => listChecklistMemberDirectory(ctx.user.id, input.query, input.limit)),
  saveShare: protectedProcedure.input(z.object({ documentId: z.number().int().positive(), sharedWithUserId: z.number().int().positive(), canEdit: z.boolean() })).mutation(({ ctx, input }) => savePolicyEvidenceShare(ctx.user.id, input)),
  revokeShare: protectedProcedure.input(z.object({ documentId: z.number().int().positive(), sharedWithUserId: z.number().int().positive() })).mutation(({ ctx, input }) => revokePolicyEvidenceShare(ctx.user.id, input.documentId, input.sharedWithUserId)),
  listAudit: protectedProcedure.input(z.object({ documentId: z.number().int().positive(), limit: z.number().int().min(1).max(200).default(100) })).query(({ ctx, input }) => listPolicyEvidenceAudit(ctx.user.id, input.documentId, input.limit)),
  compareGuidance: protectedProcedure.input(z.object({ olderDocumentId: z.number().int().positive(), newerDocumentId: z.number().int().positive() })).mutation(({ ctx, input }) => comparePolicyEvidenceGuidance(ctx.user.id, input.olderDocumentId, input.newerDocumentId)),
  listMentions: protectedProcedure.input(z.object({ documentId: z.number().int().positive() })).query(({ ctx, input }) => listPolicyEvidenceMentions(ctx.user.id, input.documentId)),
  createMention: protectedProcedure.input(z.object({ annotationId: z.number().int().positive(), mentionedUserId: z.number().int().positive() })).mutation(async ({ ctx, input }) => { const result = await createPolicyEvidenceMention(ctx.user.id, input); if (result.notification) pushNotificationToUser(result.notification.userId, result.notification); return result; }),
  resolveMention: protectedProcedure.input(z.object({ mentionId: z.number().int().positive(), responseNote: z.string().trim().max(4000).nullable().optional() })).mutation(({ ctx, input }) => resolvePolicyEvidenceMention(ctx.user.id, input)),
  getVersionReview: protectedProcedure.input(z.object({ olderDocumentId: z.number().int().positive(), newerDocumentId: z.number().int().positive() })).query(({ ctx, input }) => getPolicyEvidenceVersionReview(ctx.user.id, input.olderDocumentId, input.newerDocumentId)),
  saveVersionReview: protectedProcedure.input(z.object({ olderDocumentId: z.number().int().positive(), newerDocumentId: z.number().int().positive(), status: z.enum(['pending', 'confirmed', 'follow_up']), reviewNote: z.string().trim().max(8000).nullable().optional() })).mutation(({ ctx, input }) => savePolicyEvidenceVersionReview(ctx.user.id, input)),
  listBoomPresets: protectedProcedure.query(({ ctx }) => listBoomSubscriptionPresets(ctx.user.id)),
  saveBoomPreset: protectedProcedure.input(z.object({ presetId: z.number().int().positive().optional(), name: z.string().trim().min(1).max(96), filters: z.object({ terms: z.array(z.string().max(32)).max(12).default([]), cusip: z.string().max(16).default(''), minAmount: z.string().max(15).default(''), maxAmount: z.string().max(15).default('') }) })).mutation(({ ctx, input }) => saveBoomSubscriptionPreset(ctx.user.id, input)),
  listBoomPresetShares: protectedProcedure.input(z.object({ presetId: z.number().int().positive() })).query(({ ctx, input }) => listBoomSubscriptionPresetShares(ctx.user.id, input.presetId)),
  saveBoomPresetShare: protectedProcedure.input(z.object({ presetId: z.number().int().positive(), sharedWithUserId: z.number().int().positive(), canEdit: z.boolean() })).mutation(({ ctx, input }) => saveBoomSubscriptionPresetShare(ctx.user.id, input)),
  revokeBoomPresetShare: protectedProcedure.input(z.object({ presetId: z.number().int().positive(), sharedWithUserId: z.number().int().positive() })).mutation(({ ctx, input }) => revokeBoomSubscriptionPresetShare(ctx.user.id, input.presetId, input.sharedWithUserId)),
});
