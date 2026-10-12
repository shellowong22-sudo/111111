// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import AdminNewsIngestionDesk from '../client/src/components/news/AdminNewsIngestionDesk';

const mocks = vi.hoisted(() => ({ mutation: () => ({ mutate: vi.fn(), isPending: false }) }));

vi.mock('@/lib/trpc', () => ({
  trpc: {
    useUtils: () => ({ adminNewsIngestion: { listSources: { invalidate: vi.fn() }, listArticles: { invalidate: vi.fn() }, getAnalytics: { invalidate: vi.fn() } } }),
    auth: { me: { useQuery: () => ({ data: { id: 1, role: 'admin' } }) } },
    adminNewsIngestion: {
      listSources: { useQuery: () => ({ data: [{ id: 1, name: '新浪财经要闻汇总', provider: '新浪财经 RSS', sourceUrl: 'https://rss.sina.com.cn/finance/', lastStatus: 'never', lastFetchedAt: null, lastError: null }], isLoading: false }) },
      listArticles: { useQuery: () => ({ data: [], isLoading: false }) },
      getAnalytics: { useQuery: () => ({ data: { totalPublished: 0, totalDrafts: 0, categories: [] }, isLoading: false }) },
      addSinaFinanceRss: { useMutation: mocks.mutation },
      createSource: { useMutation: mocks.mutation },
      syncSource: { useMutation: mocks.mutation },
      approve: { useMutation: mocks.mutation },
      publish: { useMutation: mocks.mutation },
      reject: { useMutation: mocks.mutation },
    },
  },
}));

vi.mock('recharts', () => { const Container = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>; const Shape = () => null; return { ResponsiveContainer: Container, BarChart: Container, Bar: Shape, CartesianGrid: Shape, Tooltip: Shape, XAxis: Shape, YAxis: Shape }; });
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

describe('管理员新闻采集审核窗口', () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('仅呈现 RSS 来源、手动同步、待审队列与发布统计，不显示自动发布结果', () => {
    render(<AdminNewsIngestionDesk />);
    expect(screen.getByText('管理员新闻采集与审核')).toBeTruthy();
    expect(screen.getByText('新浪财经要闻汇总')).toBeTruthy();
    expect(screen.getByRole('button', { name: /立即同步/ })).toBeTruthy();
    expect(screen.getByText(/同步成功后，新文章会先进入“待审”而不是自动发布/)).toBeTruthy();
    expect(screen.getByText('站内已发布新闻统计')).toBeTruthy();
  });
});
