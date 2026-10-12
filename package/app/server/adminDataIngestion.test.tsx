// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import AdminDataIngestion from '../client/src/pages/admin/AdminDataIngestion';

vi.mock('@/components/AdminLayout', () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
const mocks = vi.hoisted(() => ({ createSourceMutate: vi.fn(), syncSourceMutate: vi.fn(), mutation: () => ({ mutate: vi.fn(), isPending: false }) }));
vi.mock('@/lib/trpc', () => ({ trpc: {
  useUtils: () => ({ adminNewsIngestion: { listSources: { invalidate: vi.fn() }, getAnalytics: { invalidate: vi.fn() }, listAuditEvents: { invalidate: vi.fn() }, listArticles: { invalidate: vi.fn() } }, adminMarketIngestion: { listTargets: { invalidate: vi.fn() }, listEvents: { invalidate: vi.fn() } } }),
  adminNewsIngestion: {
    listSources: { useQuery: () => ({ data: [{ id: 1, name: '新浪财经要闻汇总', provider: '新浪财经 RSS', feedUrl: 'https://rss.sina.com.cn/roll/finance/hot_roll.xml', sourceUrl: 'https://finance.sina.com.cn/', maxItemsPerRun: 50, processingMode: 'queued', isActive: true, lastFetchedAt: null, lastStatus: 'never', lastError: null, scheduleCronTaskUid: null }] }) },
    getAnalytics: { useQuery: () => ({ data: { totalDrafts: 0 } }) },
    listAuditEvents: { useQuery: () => ({ data: [] }) }, listArticles: { useQuery: () => ({ data: [] }) },
    syncSource: { useMutation: (options: { onSuccess?: (data: { status: string; queued: number; processed: number; drafted: number; failed: number; waiting: number; mode: string; reason: string | null }) => void }) => ({ mutate: (input: unknown) => { mocks.syncSourceMutate(input); options.onSuccess?.({ status: 'available', queued: 0, processed: 0, drafted: 0, failed: 0, waiting: 0, mode: 'queued', reason: null }); }, isPending: false }) }, createSource: { useMutation: () => ({ mutate: mocks.createSourceMutate, isPending: false }) }, updateSource: { useMutation: mocks.mutation }, setSourceActive: { useMutation: mocks.mutation }, deleteSource: { useMutation: mocks.mutation }, enableSchedule: { useMutation: mocks.mutation }, pauseSchedule: { useMutation: mocks.mutation },
  },
  adminMarketIngestion: {
    providerCatalog: { useQuery: () => ({ data: { freeSources: [], optionalSources: [], localSdkSources: [], managedDatasets: [] }, isLoading: false }) },
    listProviderConfigs: { useQuery: () => ({ data: [] }) }, saveProviderConfig: { useMutation: mocks.mutation },
    testIfindConnection: { useMutation: mocks.mutation },
    listTargets: { useQuery: () => ({ data: [{ id: 8, symbol: '600519.SS', displayName: '贵州茅台', marketType: 'stock', lastStatus: 'never', lastError: null, lastObservationDate: null, lastClose: null, currency: null, source: null, scheduleCronTaskUid: null }] }) },
    listEvents: { useQuery: () => ({ data: [] }) },
    createTarget: { useMutation: mocks.mutation }, syncTarget: { useMutation: mocks.mutation }, enableSchedule: { useMutation: mocks.mutation }, pauseSchedule: { useMutation: mocks.mutation },
    syncManagedPublicDataset: { useMutation: mocks.mutation },
    enableManagedPublicDatasetSchedule: { useMutation: mocks.mutation },
    pauseManagedPublicDatasetSchedule: { useMutation: mocks.mutation },
  },
} }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

describe('管理后台 AI 数据采集入口', () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); vi.restoreAllMocks(); });
  it('将许可新闻、投资标的、计划控制与审计状态置于受保护后台入口', () => {
    render(<AdminDataIngestion />);
    expect(screen.getByRole('button', { name: '数据源监控' })).toBeTruthy();
    expect(screen.getByText('新浪财经要闻汇总')).toBeTruthy();
    expect(screen.getByRole('button', { name: '重新抓取' })).toBeTruthy();
    expect(screen.getByText('数据源可视化监控')).toBeTruthy();
  });

  it('网站名称和网址必填、RSS／Atom 选填，支持 50 条与两种 AI 草稿模式', () => {
    render(<AdminDataIngestion />);
    fireEvent.click(screen.getByRole('button', { name: '爬取源管理' }));
    fireEvent.click(screen.getByRole('button', { name: '添加爬取源' }));
    fireEvent.change(screen.getByPlaceholderText('如：新浪财经'), { target: { value: '示例财经网站' } });
    fireEvent.change(screen.getByPlaceholderText('https://example.com'), { target: { value: 'https://www.example.test' } });
    fireEvent.change(screen.getByPlaceholderText('https://rss.example.com/feed.xml'), { target: { value: 'https://rss.example.test/feed.xml' } });
    fireEvent.click(screen.getByRole('button', { name: '确认添加' }));
    expect(mocks.createSourceMutate).toHaveBeenCalledWith(expect.objectContaining({ name: '示例财经网站', websiteUrl: 'https://www.example.test', feedUrl: 'https://rss.example.test/feed.xml', maxItemsPerRun: 5, processingMode: 'queued', isActive: true }));
  });

  it('新闻同步结果与分钟级计划频率在页面中可见，而非只显示短暂提示', () => {
    render(<AdminDataIngestion />);
    fireEvent.click(screen.getByRole('button', { name: '采集控制' }));
    fireEvent.click(screen.getByRole('button', { name: '立即爬取' }));
    expect(mocks.syncSourceMutate).toHaveBeenCalledWith({ sourceId: 1, maxItemsPerRun: 5 });
    expect(screen.getByText('采集完成：新增 0 条，已处理 0 条，草稿 0 条，待处理 0 条。')).toBeTruthy();
    expect(screen.getByText(/预览环境不能启动计划/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '爬取源管理' }));
    fireEvent.click(screen.getByRole('button', { name: '添加爬取源' }));
    expect(screen.getByText('爬取间隔：5 分钟')).toBeTruthy();
  });

  it('提供五段工作台、真实日志筛选、工具箱入口和来源启停控件', () => {
    render(<AdminDataIngestion />);
    expect(screen.getByRole('button', { name: '采集控制' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '爬取源管理' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '爬取日志' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '工具箱' })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: '重新抓取' }).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: '爬取日志' }));
    expect(screen.getByRole('combobox', { name: '爬取源筛选' })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: '状态筛选' })).toBeTruthy();
    expect(screen.getByText('暂无匹配的真实爬取日志。')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '重置' }));

    fireEvent.click(screen.getByRole('button', { name: '工具箱' }));
    expect(screen.getByRole('button', { name: '开始采集' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '生成待审核草稿' })).toBeTruthy();
    expect(screen.getByText(/AI 仅生成待审核草稿/)).toBeTruthy();
  });
});
