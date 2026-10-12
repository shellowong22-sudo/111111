import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..');
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');

describe('municipal issuer evidence archive and review', () => {
  const db = read('server/municipalIssuerEvidenceDb.ts');
  const router = read('server/routers/municipalIssuerEvidence.ts');
  const schema = read('drizzle/schema.ts');
  const layer = read('client/src/components/municipal/MunicipalResearchLayer.tsx');
  const workspace = read('client/src/components/municipal/MunicipalIssuerEvidenceWorkspace.tsx');
  const uploader = read('client/src/components/municipal/MunicipalIssuerEvidenceBatchUploader.tsx');
  const searchPanel = read('client/src/components/municipal/MunicipalIssuerEvidenceSearchPanel.tsx');

  it('persists external links as metadata and stores only user-selected upload bytes in account-private object storage', () => {
    expect(schema).toContain('municipalIssuerEvidenceDocuments');
    expect(schema).toContain('sourceUrl: text("source_url").notNull()');
    expect(schema).toContain('documentFingerprint: varchar("document_fingerprint", { length: 64 }).notNull()');
    expect(schema).toContain('evidenceExtracts: json("evidence_extracts")');
    expect(workspace).toContain('不保存完整外部文件');
    expect(schema).toContain('storageKey: varchar("storage_key", { length: 512 })');
    expect(router).toContain('uploadDocuments');
    expect(router).toContain('storagePut');
    expect(router).toContain('MUNICIPAL_EVIDENCE_UPLOAD_SIZE_MISMATCH');
    expect(uploader).toContain('每批最多 10 份、单份 6 MB、合计 25 MB');
    expect(schema).toContain('municipalIssuerEvidenceDocumentTags');
    expect(router).toContain('saveDocumentTags');
    expect(router).toContain('searchDocuments');
    expect(router).toContain('batchSaveDocumentTags');
    expect(router).toContain('suggestDocumentTags');
    expect(router).toContain('saveSearchPreset');
    expect(db).not.toContain('fetch(');
  });

  it('enforces account roles and separates viewer, editor, reviewer and owner actions', () => {
    expect(db).toContain("type MunicipalEvidencePermission = 'owner' | 'editor' | 'reviewer' | 'viewer' | 'none'");
    expect(db).toContain("mode: 'view' | 'edit' | 'share' | 'review'");
    expect(db).toContain("permission === 'owner' || permission === 'editor'");
    expect(db).toContain("permission === 'owner'");
    expect(db).toContain("permission === 'reviewer'");
    expect(router).toContain('protectedProcedure');
    expect(router).toContain('MUNICIPAL_EVIDENCE_BATCH_TOO_LARGE');
    expect(db).toContain('searchMunicipalEvidenceDocuments');
    expect(db).toContain('saveMunicipalEvidenceDocumentTags');
    expect(db).toContain('batchSaveMunicipalEvidenceDocumentTags');
    expect(db).toContain('suggestMunicipalEvidenceDocumentTags');
    expect(db).toContain('listMunicipalEvidenceSearchPresets');
  });

  it('requires official evidence and a reviewer before freezing a review version', () => {
    expect(db).toContain('MUNICIPAL_EVIDENCE_PACKAGE_REQUIRES_REVIEWER');
    expect(db).toContain('MUNICIPAL_EVIDENCE_PACKAGE_REQUIRES_DOCUMENT');
    expect(db).toContain('MUNICIPAL_EVIDENCE_PACKAGE_REQUIRES_VERIFIED_DOCUMENT');
    expect(db).toContain("status: 'submitted'");
    expect(db).toContain('documentSnapshot: snapshot');
    expect(db).toContain('MUNICIPAL_EVIDENCE_PACKAGE_LOCKED_FOR_REVIEW');
  });

  it('keeps an append-only audit, review-state aggregation and version comparison', () => {
    expect(schema).toContain('municipalIssuerEvidenceAuditEvents');
    expect(schema).toContain('municipalIssuerEvidenceVersions');
    expect(db).toContain("'changes_requested'");
    expect(db).toContain("'approved'");
    expect(db).toContain('compareMunicipalEvidenceVersions');
    expect(router).toContain('submitForReview');
    expect(router).toContain('saveReview');
    expect(router).toContain('compareVersions');
  });

  it('adds the workspace only after the preserved SMUN module rather than altering the original issuer panel', () => {
    expect(layer).toContain("knownId === 'SMUN' && <>");
    expect(layer.indexOf('<MunicipalIssuerEvidenceWorkspace')).toBeLessThan(layer.indexOf('<MunicipalIssuerEvidenceBatchUploader'));
    expect(layer).not.toContain('SMUNPanel');
    expect(workspace).toContain('原面板后追加');
    expect(layer.indexOf('<MunicipalIssuerEvidenceBatchUploader')).toBeLessThan(layer.indexOf('<MunicipalIssuerEvidenceSearchPanel'));
    expect(searchPanel).toContain('<Highlight value={document.title} terms={terms} />');
    expect(searchPanel).toContain('保存检索');
    expect(searchPanel).toContain('批量保存');
    expect(searchPanel).toContain('使用建议：');
  });

  it('adds traceable internal source-boundary labels around retained municipal fields without editing original panels', () => {
    const preserved = read('client/src/components/municipal/MunicipalPreservedModule.tsx');
    const sources = read('client/src/components/municipal/MunicipalWorkspaceFieldSources.tsx');
    expect(preserved).toContain('<MunicipalWorkspaceFieldSources moduleId={moduleId}>{original}</MunicipalWorkspaceFieldSources>');
    expect(sources).toContain('当前未订阅结构化成交资料');
    expect(sources).toContain('不会将其自动视为实时市场数据');
    expect(sources).toContain("root.querySelectorAll('th')");
    expect(sources).not.toContain("root.querySelectorAll('div,p,span')");
    expect(sources).toContain("badge.textContent = 'i'");
    expect(preserved).toContain('原工作区字段与交互保持不变');
  });

  it('keeps the evidence workspace entry points, empty states and review controls inside the terminal', () => {
    expect(workspace).toContain('读取账户归档…');
    expect(workspace).toContain('尚无账户级发行人证据包');
    expect(workspace).toContain('创建证据包');
    expect(workspace).toContain('冻结并提交审阅');
    expect(uploader).toContain('导入已选文件');
    expect(uploader).toContain('账户私有对象存储');
    expect(workspace).toContain('不镜像完整第三方文件');
    expect(workspace).not.toContain('window.open(');
    expect(workspace).not.toContain('<a href=');
  });
});
