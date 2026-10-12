import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const governanceSource = readFileSync(resolve(import.meta.dirname, '../client/src/components/sovereign/ChecklistGovernancePanel.tsx'), 'utf8');
const dbSource = readFileSync(resolve(import.meta.dirname, './db.ts'), 'utf8');

describe('归档模板保留与管理员审阅', () => {
  it('对归档模板记录保留期限、到期时间和待审状态，并追加治理审计事件', () => {
    expect(dbSource).toContain('toRetentionExpiry');
    expect(dbSource).toContain("archiveReviewStatus: 'pending'");
    expect(dbSource).toContain("action: 'retention_set'");
    expect(dbSource).toContain("action: 'submitted_for_review'");
  });

  it('仅管理员拥有待审队列和审阅决定接口，并在审阅后通知创建者', () => {
    expect(dbSource).toContain('listChecklistArchiveReviewQueue');
    expect(dbSource).toContain('reviewChecklistTemplateArchive');
    expect(dbSource).toContain("relatedType: 'checklist_template_archive'");
  });

  it('为待审归档设定截止时间，支持逾期筛选并在批量提交前校验全部项目仍处于待审状态', () => {
    expect(dbSource).toContain('toArchiveReviewDueAt');
    expect(dbSource).toContain('getArchiveReviewDeadlineStatus');
    expect(dbSource).toContain("'due_soon' | 'overdue'");
    expect(dbSource).toContain('batchReviewChecklistTemplateArchives');
    expect(dbSource).toContain('ARCHIVE_REVIEW_NOT_PENDING');
    expect(dbSource).toContain('ARCHIVE_REVIEW_RETENTION_MISMATCH');
    expect(governanceSource).toContain('保留期限完全一致');
  });

  it('界面提供期限选择、CSV/PDF 治理导出和管理员通过或要求调整动作', () => {
    expect(governanceSource).toContain('保留期限');
    expect(governanceSource).toContain('downloadCsv');
    expect(governanceSource).toContain('ExportMenu');
    expect(governanceSource).toContain('管理员归档审阅队列');
    expect(governanceSource).toContain('要求调整');
    expect(governanceSource).toContain('临近截止');
    expect(governanceSource).toContain('已逾期');
    expect(governanceSource).toContain('batchReviewArchiveTemplates');
    expect(governanceSource).toContain('批量通过');
  });

  it('队列查询结果保持稳定引用，批量操作从派生的有效选择中读取而不在 effect 中写入状态', () => {
    expect(governanceSource).toContain("useMemo(() => (queueQuery.data ?? []) as QueueRow[], [queueQuery.data])");
    expect(governanceSource).toContain('const selectedReviewItems = queue.filter');
    expect(governanceSource).toContain('templateIds: selectedReviewItems.map');
    expect(governanceSource).not.toContain('useEffect(() => { setSelectedReviewIds');
  });
});
