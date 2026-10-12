// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import YCURVEPanel from '../client/src/components/YCURVEPanel';

vi.mock('@/hooks/useModuleLiveFeed', () => ({
  useModuleLiveFeed: () => ({ items: [], connected: false }),
}));

vi.mock('@/lib/trpc', () => ({
  trpc: {
    sovereignBonds: {
      getMultipleRateSeries: {
        useQuery: () => ({
          isLoading: false,
          isFetching: false,
          refetch: vi.fn(),
          data: {
            source: 'FRED',
            timestamp: '2026-08-26T12:10:23.000Z',
            data: Object.fromEntries([
              ['DGS1MO', 4.30], ['DGS3MO', 4.25], ['DGS6MO', 4.12], ['DGS1', 4.02],
              ['DGS2', 3.95], ['DGS5', 3.88], ['DGS10', 4.05], ['DGS30', 4.36],
            ].map(([id, latest]) => [id, {
              latest,
              data: [
                { date: '2026-08-22', value: Number(latest) - 0.03 },
                { date: '2026-08-25', value: Number(latest) - 0.01 },
                { date: '2026-08-26', value: Number(latest) },
              ],
            }])),
          },
        }),
      },
    },
    treasuryHistoricalCurve: {
      getImported: {
        useQuery: () => ({
          isLoading: false,
          data: {
            available: true,
            audit: { sourceUrl: 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates', fetchedAt: '2026-08-25T16:19:07.000Z' },
            latestObservations: [{ date: '2023-12-29', points: [{ period: '2Y', value: '4.23' }, { period: '5Y', value: '3.84' }, { period: '10Y', value: '3.88' }, { period: '30Y', value: '4.03' }] }],
            limitation: '只读导入的官方历史曲线观测；不是实时或可执行报价。',
          },
        }),
      },
    },
    moneyMarketResearch: {
      getSnapshot: {
        useQuery: () => ({
          data: {
            asOf: '2026-08-26T12:10:23.000Z',
            rates: [
              { id: 'DTB4WK', label: '4W T-Bill', sourceUrl: 'https://fred.stlouisfed.org/series/DTB4WK', observationDate: '2026-08-25', value: 4.12, changeBps: 1.2, history: [], status: 'available', limitation: 'FRED 公开历史观察。' },
              { id: 'DTB3', label: '3M T-Bill', sourceUrl: 'https://fred.stlouisfed.org/series/DTB3', observationDate: '2026-08-25', value: 4.05, changeBps: 0.8, history: [], status: 'available', limitation: 'FRED 公开历史观察。' },
              { id: 'DTB6', label: '6M T-Bill', sourceUrl: 'https://fred.stlouisfed.org/series/DTB6', observationDate: '2026-08-25', value: 3.98, changeBps: -0.4, history: [], status: 'available', limitation: 'FRED 公开历史观察。' },
              { id: 'SOFR', label: 'SOFR', sourceUrl: 'https://fred.stlouisfed.org/series/SOFR', observationDate: '2026-08-25', value: 4.31, changeBps: 0.5, history: [{ date: '2026-08-21', value: 4.28 }, { date: '2026-08-22', value: 4.30 }, { date: '2026-08-25', value: 4.31 }], status: 'available', limitation: 'FRED 公开历史观察。' },
            ],
            cdi: [{ date: '2026-08-25', valuePct: 10.15 }],
            taiwanCallRate: [{ date: '2026-08-25', valuePct: 1.21 }],
          },
        }),
      },
    },
  },
}));

const source = readFileSync('client/src/components/YCURVEPanel.tsx', 'utf8');
const distinctSource = readFileSync('client/src/components/CurveDistinctTools.tsx', 'utf8');
const treasuryRouteSource = readFileSync('server/routers/treasuryHistoricalCurve.ts', 'utf8');
const moneyMarketRouteSource = readFileSync('server/routers/moneyMarketResearch.ts', 'utf8');
const codes = ['GCT', 'FWCV', 'FWCM', 'ICUR', 'BNCH', 'ICVS', 'GC3D', 'CRV', 'VCUB'];

describe('收益曲线第 4–12 项输入工具', () => {
  it('目录页不新增工作台，期限数据仅嵌入原有 YCDF 现金曲线设定', () => {
    const page = render(<YCURVEPanel onClose={() => {}} />);
    expect(page.queryByText('期限结构与滚降工作区')).toBeNull();
    expect(page.container.querySelector('[data-ycdf-curve-reference]')).toBeNull();
    fireEvent.click(page.getByText('现金曲线设定'));
    expect(page.getByText('当前期限曲线')).toBeTruthy();
    expect(page.getByText('结构利差与蝶式')).toBeTruthy();
    expect(page.getByText('历史走势下钻')).toBeTruthy();
    expect(page.container.querySelector('[data-ycdf-curve-reference]')).toBeTruthy();
  });

  it('不再渲染无限数据加载占位弹窗', () => {
    expect(source).not.toContain('数据加载中，请稍候...');
    expect(source).not.toContain('setPlaceholder');
  });

  it('九个入口都具有专属输入定义与计算结果', () => {
    for (const code of codes) {
      expect(distinctSource).toContain(`function ${code}`);
    }
    expect(distinctSource).toContain('CurveDistinctTools');
    expect(source).toContain('<CurveDistinctTools');
  });

  it('外部曲线未接入时明确说明数据边界', () => {
    expect(source).toContain('未接入外部市场数据');
    expect(source).toContain('本工具仅处理当前用户输入');
  });

  it('读取恢复曲线快照并以来源、观测日和收益率节点填充工具', () => {
    expect(distinctSource).toContain('treasuryHistoricalCurve.getImported.useQuery');
    expect(distinctSource).toContain('已恢复官方历史曲线快照');
    expect(distinctSource).toContain('官方期限锚点与本地结论');
    expect(distinctSource).toContain('载入 {snapshot.date');
  });

  it('恢复国债曲线与货币市场接口保留可追溯状态字段，失败时不以样本替代', () => {
    expect(treasuryRouteSource).toContain('sourceUrl: audit.sourceUrl');
    expect(treasuryRouteSource).toContain('fetchedAt: audit.fetchedAt.toISOString()');
    expect(treasuryRouteSource).toContain('未插值、未预测，且不是可执行报价');
    expect(treasuryRouteSource).toContain('系统保持真实空状态');
    expect(moneyMarketRouteSource).toContain('observationDate: latest?.date ?? null');
    expect(moneyMarketRouteSource).toContain("status: latest ? 'available' : 'unavailable'");
    expect(moneyMarketRouteSource).toContain('asOf: new Date().toISOString()');
    expect(moneyMarketRouteSource).toContain('不使用缓存样本、随机路径或替代报价填充');
  });

  it('第 6、7、12 项使用不同公开基准并有标签化数据表', () => {
    for (const sourceLabel of ['Banco Central do Brasil SGS · CDI / Central Bank of Taiwan', 'FRED · DTB4WK / DTB3 / DTB6', 'FRED · SOFR 历史观察']) {
      expect(distinctSource).toContain(sourceLabel);
    }
    expect(distinctSource).toContain('数据基准 ·');
    expect(distinctSource).toContain('当前来源未返回可核验记录；不使用样本替代。');
  });

  it('第 7 与第 12 项使用非矩阵数据结构并显示可解释归因', () => {
    expect(distinctSource).toContain('期限分段斜率审阅');
    expect(distinctSource).toContain('相邻期限斜率记录');
    expect(distinctSource).toContain('三期限比较曲线');
    expect(distinctSource).toContain('期限利差与蝶式归因');
    expect(distinctSource).toContain('FRED SOFR 历史轨迹');
    expect(distinctSource).not.toContain('<CurveVisual code={item.ticker}/>');
    expect(distinctSource).not.toContain('已恢复曲线观测热力图');
    expect(distinctSource).not.toContain('远期矩阵热力图');
    expect(distinctSource).not.toContain('五档远期变化阶梯');
    expect(distinctSource).not.toContain('波动率热力图');
  });

  it('点击 GCT 与 VCUB 可进入输入计算视图', () => {
    const gct = render(<YCURVEPanel onClose={() => {}} />);
    fireEvent.click(gct.getByText('图表曲线期间'));
    expect(gct.getByText(/多日期期限曲线比较/)).toBeTruthy();
    expect(gct.getByText(/期限利差变化与结论/)).toBeTruthy();
    expect(gct.getAllByText('2023-12-29').length).toBeGreaterThan(0);
    gct.unmount();

    const vcub = render(<YCURVEPanel onClose={() => {}} />);
    fireEvent.click(vcub.getByText('利率波动率立方图'));
    expect(vcub.getByText(/FRED SOFR 历史轨迹/)).toBeTruthy();
    expect(vcub.getByText(/官方期限锚点与本地结论/)).toBeTruthy();
    expect(vcub.getAllByText('2026-08-21').length).toBeGreaterThan(0);
    expect(vcub.getAllByText('4.23%').length).toBeGreaterThan(0);
    expect(vcub.getByText('2023-12-29')).toBeTruthy();
  });
});
