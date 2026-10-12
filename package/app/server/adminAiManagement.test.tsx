// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render as testingRender, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AdminAiManagement from '../client/src/pages/admin/AdminAiManagement';

const render = (ui: React.ReactElement) => testingRender(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>,
);

const mocks = vi.hoisted(() => ({ runGeneration: vi.fn(), syncSource: vi.fn(), enableSchedule: vi.fn(), addHkexNewsSource: vi.fn(), updateCatalog: vi.fn(), invalidate: vi.fn(), deferRun: false, articles: [{ id: 7, sourceHeadline: '来源标题', status: 'queued', createdAt: new Date() }] as any[], readiness: { queuedCount: 1, activeQueuedSourceCount: 1 }, sources: [{ id: 1, name: '东方财富公告', isActive: true, processingMode: 'queued', lastStatus: 'available' }] as any[] }));

vi.mock('@/lib/trpc', () => ({
  trpc: {
    useUtils: () => ({
      adminNewsIngestion: {
        listSources: { invalidate: mocks.invalidate }, listArticles: { invalidate: mocks.invalidate }, getGenerationReadiness: { invalidate: mocks.invalidate }, listGenerationTasks: { invalidate: mocks.invalidate }, listModelStatus: { invalidate: mocks.invalidate }, listAuditEvents: { invalidate: mocks.invalidate }, listGenerationCatalogSettings: { invalidate: mocks.invalidate }, listGenerationCatalogEvents: { invalidate: mocks.invalidate },
      },
      adminSpider: {
        dashboard: { invalidate: mocks.invalidate },
        listWorldData: { invalidate: mocks.invalidate },
        listTools: { invalidate: mocks.invalidate },
      },
    }),
    adminNewsIngestion: {
      listSources: { useQuery: () => ({ data: mocks.sources, isLoading: false }) },
      listArticles: { useQuery: () => ({ data: mocks.articles, isLoading: false }) },
      getGenerationReadiness: { useQuery: () => ({ data: mocks.readiness, isLoading: false }) },
      listGenerationTasks: { useQuery: () => ({ data: [], isLoading: false }) },
      listModelStatus: { useQuery: () => ({ data: { available: true, models: [{ id: 'gpt-5-mini', provider: 'openai', verifiedAt: '2026-09-28T00:00:00.000Z' }] }, isLoading: false }) },
      setPreferredAiModel: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      listGenerationCatalogSettings: { useQuery: () => ({ data: [], isLoading: false }) },
      updateGenerationCatalogSettings: { useMutation: (options: { onSuccess?: (result: { updatedCodes: string[]; status: string }) => void }) => ({ mutate: (input: { codes: string[]; status: string }) => { mocks.updateCatalog(input); options.onSuccess?.({ updatedCodes: input.codes, status: input.status }); }, isPending: false }) },
      runGeneration: { useMutation: (options: { onSuccess?: (result: { detail: string; generated: number }) => void }) => ({ mutate: (input: unknown) => { mocks.runGeneration(input); if (!mocks.deferRun) options.onSuccess?.({ detail: '处理 1 条已保存新闻元数据，生成 1 条待审核草稿。', generated: 1 }); }, isPending: false }) },
      syncSource: { useMutation: (options: { onSuccess?: (result: { status: string; queued: number }) => void }) => ({ mutate: (input: unknown) => { mocks.syncSource(input); options.onSuccess?.({ status: 'available', queued: 1 }); }, isPending: false }) },
      enableSchedule: { useMutation: (options: { onSuccess?: (result: { sourceId: number; intervalMinutes: number }) => void }) => ({ mutate: (input: { sourceId: number; intervalMinutes: number }) => { mocks.enableSchedule(input); options.onSuccess?.({ ...input }); }, isPending: false }) },
      addHkexNewsReleasesRss: { useMutation: (options: { onSuccess?: (result: { sourceId: number; existed: boolean }) => void }) => ({ mutate: () => { mocks.addHkexNewsSource(); options.onSuccess?.({ sourceId: 8, existed: false }); }, isPending: false }) },
    },
    ucheerAi: {
      adminOverview: { useQuery: () => ({ data: { available: false }, isLoading: false }) },
    },
    municipalResearch: {
      publishOfficial: {
        useMutation: () => ({ mutate: vi.fn(), isPending: false }),
      },
    },
    adminSpider: {
      dashboard: { useQuery: () => ({ data: { tasks: [], seeds: [], stats: { raw: 0, processed: 0, world: 0, tools: 0, snapshots: 0, links: 0, pushes: 0 }, recentDeliveries: [], worldData: [], tools: [], failures: [], scans: [], snapshots: [], links: [], rawData: [], architecture: [] }, isLoading: false, isError: false, isFetching: false }) },
      listWorldData: { useQuery: () => ({ data: { rows: [], total: 0, page: 1, totalPages: 0 }, isLoading: false, isError: false }) },
      listTools: { useQuery: () => ({ data: { rows: [], total: 0, page: 1, totalPages: 0 }, isLoading: false, isError: false }) },
      lineage: { useQuery: () => ({ data: undefined, isLoading: false, isError: false, refetch: vi.fn() }) },
      createTask: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      updateTask: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      deleteTask: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      executeTask: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      createSeed: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      updateSeed: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      deleteSeed: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      checkSeeds: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      runGapScan: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      retryFailures: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      manualPush: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      runAi: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
  },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/components/AdminLayout', () => ({ default: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children) }));

afterEach(() => {
  cleanup();
  mocks.runGeneration.mockClear();
  mocks.syncSource.mockClear();
  mocks.enableSchedule.mockClear();
  mocks.addHkexNewsSource.mockClear();
  mocks.updateCatalog.mockClear();
  mocks.invalidate.mockClear();
  mocks.deferRun = false;
  mocks.articles = [{ id: 7, sourceHeadline: '来源标题', status: 'queued', createdAt: new Date() }];
  mocks.readiness = { queuedCount: 1, activeQueuedSourceCount: 1 };
  mocks.sources = [{ id: 1, name: '东方财富公告', isActive: true, processingMode: 'queued', lastStatus: 'available' }];
});

describe('AdminAiManagement', () => {
  it('显示五个后台工作台页签与真实模型目录状态', () => {
    render(<AdminAiManagement />);
    expect(screen.getByRole('button', { name: '爬虫管理' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'AI生成' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '审核与导出' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '模型状态' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '任务日志' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '模型状态' }));
    expect(screen.getByText('gpt-5-mini')).toBeTruthy();
    expect(screen.getByText(/验证时间/)).toBeTruthy();
  });

  it('将所选生成类型与数量提交给真实生成任务接口，而非创建示例新闻', () => {
    render(<AdminAiManagement />);
    fireEvent.click(screen.getByRole('button', { name: 'AI生成' }));
    fireEvent.change(screen.getByRole('combobox', { name: '生成类型' }), { target: { value: 'template:report' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: '生成数量' }), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: '开始 AI 生成' }));
    expect(mocks.runGeneration).toHaveBeenCalledWith({ generationType: 'report', count: 3 });
    expect(screen.getByText('AI 任务日志')).toBeTruthy();
  });

  it('提供三类快速生成任务，并保持待审核而非自动发布的边界', () => {
    render(<AdminAiManagement />);
    fireEvent.click(screen.getByRole('button', { name: 'AI生成' }));
    expect(screen.getByText(/不会自动发布/)).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: '执行' })[0]);
    expect(mocks.runGeneration).toHaveBeenCalledWith({ generationType: 'news', count: 5 });
  });

  it('将 28 项新闻与研究报告功能放入可审核模板目录，并与通用模板使用同一直接生成动作提交目录代码', () => {
    render(<AdminAiManagement />);
    fireEvent.click(screen.getByRole('button', { name: 'AI生成' }));
    expect(screen.getAllByTestId('news-research-catalog-item')).toHaveLength(28);
    expect(screen.getByRole('option', { name: 'TOP · 要闻精选' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'TREN · 新闻趋势' })).toBeTruthy();

    fireEvent.change(screen.getByRole('combobox', { name: '生成类型' }), { target: { value: 'catalog:TOP' } });
    expect(screen.getByText('当前目录：')).toBeTruthy();
    expect(screen.getAllByText('TOP · 要闻精选').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole('link', { name: '打开 TOP 原功能' }).getAttribute('href')).toBe('/menu-item/TOP');
    expect(screen.getByText(/该目录与通用模板使用同一个直接生成按钮/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '开始 AI 生成' }));
    expect(mocks.runGeneration).toHaveBeenCalledWith({ generationType: 'news', count: 5, catalogCode: 'TOP' });
  });

  it('为工作区分类提供同样受来源约束的可审核模板与原新闻中心入口', () => {
    render(<AdminAiManagement />);
    fireEvent.click(screen.getByRole('button', { name: 'AI生成' }));
    fireEvent.click(screen.getAllByTestId('news-research-catalog-item')[12].querySelector('button')!);
    expect(screen.getByText('当前目录：')).toBeTruthy();
    expect(screen.getAllByText('MDIA · 多媒体').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole('link', { name: '打开 MDIA 原功能' }).getAttribute('href')).toBe('/news-hub?tab=media');
    fireEvent.click(screen.getByRole('button', { name: '开始 AI 生成' }));
    expect(mocks.runGeneration).toHaveBeenCalledWith({ generationType: 'news', count: 5, catalogCode: 'MDIA' });
  });

  it('支持搜索、分类筛选、批量启用/禁用/从目录删除，且操作只发送目录配置代码', () => {
    render(<AdminAiManagement />);
    fireEvent.click(screen.getByRole('button', { name: 'AI生成' }));
    fireEvent.change(screen.getByRole('textbox', { name: '搜索生成类型' }), { target: { value: '新能源' } });
    expect(screen.getAllByTestId('news-research-catalog-item')).toHaveLength(1);
    expect(screen.getByText('彭博新能源财经研究报告')).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox', { name: '全选当前筛选结果' }));
    fireEvent.click(screen.getByRole('button', { name: '批量禁用' }));
    expect(mocks.updateCatalog).toHaveBeenCalledWith({ codes: ['BNEF'], status: 'disabled' });
    fireEvent.change(screen.getByRole('textbox', { name: '搜索生成类型' }), { target: { value: '' } });
    fireEvent.change(screen.getByRole('combobox', { name: '生成类型分类筛选' }), { target: { value: '评论与分析' } });
    expect(screen.getAllByTestId('news-research-catalog-item')).toHaveLength(5);
  });

  it('为每个目录项提供无伪造内容的配置与效果预览弹窗', () => {
    render(<AdminAiManagement />);
    fireEvent.click(screen.getByRole('button', { name: 'AI生成' }));
    fireEvent.click(screen.getByRole('button', { name: '预览 TOP' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('配置参数与生成效果')).toBeTruthy();
    expect(screen.getByText(/未按该目录项预置或伪造/)).toBeTruthy();
    expect(screen.getByRole('link', { name: '打开 TOP 原功能' }).getAttribute('href')).toBe('/menu-item/TOP');
  });

  it('无排队来源时阻止无效生成任务，并提供站内采集同步入口', () => {
    mocks.articles = [];
    mocks.readiness = { queuedCount: 0, activeQueuedSourceCount: 1 };
    render(<AdminAiManagement />);
    fireEvent.click(screen.getByRole('button', { name: 'AI生成' }));
    expect(screen.getByText('暂无可生成的排队来源元数据')).toBeTruthy();
    expect(screen.getByRole('link', { name: '前往数据采集并同步来源' }).getAttribute('href')).toBe('/admin/data-ingestion');
    expect((screen.getByRole('button', { name: '开始 AI 生成' }) as HTMLButtonElement).disabled).toBe(true);
    expect(mocks.runGeneration).not.toHaveBeenCalled();
  });

  it('允许管理员在同页同步已启用 queued 来源，为当前审核模板准备真实元数据而不自动调用模型', () => {
    mocks.articles = [];
    mocks.readiness = { queuedCount: 0, activeQueuedSourceCount: 1 };
    render(<AdminAiManagement />);
    fireEvent.click(screen.getByRole('button', { name: 'AI生成' }));
    fireEvent.click(screen.getByRole('button', { name: '同步当前来源' }));
    expect(mocks.syncSource).toHaveBeenCalledWith({ sourceId: 1 });
    expect(mocks.runGeneration).not.toHaveBeenCalled();
  });

  it('为已验证来源提供发布后自动采集入口，并只提交来源 ID 与受控间隔', () => {
    render(<AdminAiManagement />);
    fireEvent.click(screen.getByRole('button', { name: '种子库管理' }));
    expect(screen.getByText('既有新闻 RSS / ATOM 来源')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '开启定时采集' }));
    expect(mocks.enableSchedule).toHaveBeenCalledWith({ sourceId: 1, intervalMinutes: 30 });
    expect(mocks.runGeneration).not.toHaveBeenCalled();
  });

  it('在当前来源返回空频道时，允许管理员添加并同步已验证的官方 HKEX 新闻来源，不自动调用模型', () => {
    mocks.articles = [];
    mocks.readiness = { queuedCount: 0, activeQueuedSourceCount: 1 };
    render(<AdminAiManagement />);
    fireEvent.click(screen.getByRole('button', { name: 'AI生成' }));
    fireEvent.click(screen.getByRole('button', { name: '添加并同步 HKEX 官方新闻来源' }));
    expect(mocks.addHkexNewsSource).toHaveBeenCalledTimes(1);
    expect(mocks.syncSource).toHaveBeenCalledWith({ sourceId: 8 });
    expect(mocks.runGeneration).not.toHaveBeenCalled();
  });

  it('以服务端队列准备度决定生成按钮，而不受当前文章列表分页限制', () => {
    mocks.articles = [];
    mocks.readiness = { queuedCount: 6, activeQueuedSourceCount: 1 };
    render(<AdminAiManagement />);
    fireEvent.click(screen.getByRole('button', { name: 'AI生成' }));
    expect((screen.getByRole('button', { name: '开始 AI 生成' }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByText('待生成新闻：6 条；每次任务最多生成 10 条草稿。')).toBeTruthy();
  });

  it('在生成请求尚未完成时显示目录校验进度，而不提前展示成功草稿', () => {
    mocks.deferRun = true;
    render(<AdminAiManagement />);
    fireEvent.click(screen.getByRole('button', { name: 'AI生成' }));
    fireEvent.click(screen.getByRole('button', { name: '开始 AI 生成' }));
    expect(screen.getByRole('status').textContent).toContain('正在校验目录模板与排队来源');
    expect(screen.queryByText('任务已完成，草稿已进入审核队列。')).toBeNull();
  });
});
