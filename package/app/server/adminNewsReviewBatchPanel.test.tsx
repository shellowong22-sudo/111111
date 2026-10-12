// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import AdminNewsReviewBatchPanel, { buildApprovedArticleExportHtml } from '../client/src/pages/admin/AdminNewsReviewBatchPanel';

const mocks = vi.hoisted(() => ({ batchReview: vi.fn(), batchPublish: vi.fn(), prepareExport: vi.fn(), invalidate: vi.fn() }));
const drafts = [
  { id: 41, status: 'draft', sourceHeadline: '来源标题一', aiTitle: '待审草稿一' },
  { id: 42, status: 'draft', sourceHeadline: '来源标题二', aiTitle: '待审草稿二' },
];
const approved = [{ id: 60, status: 'approved', sourceHeadline: '来源标题三', sourceUrl: 'https://source.example.test/3', aiTitle: '已批准草稿', aiSummary: '仅基于来源有限摘要的已批准内容。', category: '市场', sentiment: 'neutral', sourcePublishedAt: new Date('2026-08-27T00:00:00Z'), aiGeneratedAt: new Date('2026-08-27T01:00:00Z'), reviewedAt: new Date('2026-08-27T02:00:00Z') }];

vi.mock('@/lib/trpc', () => ({
  trpc: {
    useUtils: () => ({ adminNewsIngestion: { listArticles: { invalidate: mocks.invalidate }, listAuditEvents: { invalidate: mocks.invalidate }, getAnalytics: { invalidate: mocks.invalidate } } }),
    adminNewsIngestion: {
      listArticles: { useQuery: (input: { status: string }) => ({ data: input.status === 'draft' ? drafts : approved, isLoading: false }) },
      batchReview: { useMutation: (options: { onSuccess?: (result: { decision: 'approved' | 'rejected'; reviewed: number; skipped: number }) => void }) => ({ mutate: (input: { ids: number[]; decision: 'approved' | 'rejected' }) => { mocks.batchReview(input); options.onSuccess?.({ decision: input.decision, reviewed: input.ids.length, skipped: 0 }); }, isPending: false }) },
      batchPublish: { useMutation: (options: { onSuccess?: (result: { published: number; skipped: number }) => void }) => ({ mutate: (input: { ids: number[] }) => { mocks.batchPublish(input); options.onSuccess?.({ published: input.ids.length, skipped: 0 }); }, isPending: false }) },
      prepareApprovedExport: { useMutation: () => ({ mutate: (input: { id: number; format: 'doc' | 'pdf' }) => mocks.prepareExport(input), isPending: false }) },
    },
  },
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

afterEach(() => { cleanup(); mocks.batchReview.mockClear(); mocks.batchPublish.mockClear(); mocks.prepareExport.mockClear(); mocks.invalidate.mockClear(); });

describe('后台新闻批量审核与导出', () => {
  it('仅批量提交用户已选择的 draft 草稿，并明确不自动发布', () => {
    render(<AdminNewsReviewBatchPanel />);
    fireEvent.click(screen.getByRole('checkbox', { name: '全选待审草稿' }));
    fireEvent.click(screen.getByRole('button', { name: /批量通过/ }));
    expect(mocks.batchReview).toHaveBeenCalledWith({ ids: [41, 42], decision: 'approved' });
    expect(screen.getByText(/草稿须先批准；批量发布只处理 approved 状态/)).toBeTruthy();
  });

  it('仅为 approved 文章请求 Word/PDF 导出载荷', () => {
    render(<AdminNewsReviewBatchPanel />);
    fireEvent.click(screen.getByRole('button', { name: /导出 Word/ }));
    expect(mocks.prepareExport).toHaveBeenCalledWith({ id: 60, format: 'doc' });
    fireEvent.click(screen.getByRole('button', { name: /导出 PDF/ }));
    expect(mocks.prepareExport).toHaveBeenCalledWith({ id: 60, format: 'pdf' });
  });

  it('只提交已选择的 approved 文章进行批量发布，草稿不包含在发布请求中', () => {
    render(<AdminNewsReviewBatchPanel />);
    fireEvent.click(screen.getByRole('checkbox', { name: '全选已批准文章' }));
    fireEvent.click(screen.getByRole('button', { name: /批量发布/ }));
    expect(mocks.batchPublish).toHaveBeenCalledWith({ ids: [60] });
    expect(mocks.batchReview).not.toHaveBeenCalled();
  });

  it('导出 HTML 只包含保存的草稿、审核和来源归属字段，不包含来源正文', () => {
    const html = buildApprovedArticleExportHtml({ ...approved[0], sourceHeadline: '<来源标题>', sourceExcerpt: '绝不应被导出的来源正文' });
    expect(html).toContain('&lt;来源标题&gt;');
    expect(html).toContain('https://source.example.test/3');
    expect(html).toContain('已批准（未自动发布）');
    expect(html).not.toContain('绝不应被导出的来源正文');
  });
});
