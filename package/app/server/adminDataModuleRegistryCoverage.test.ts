import { describe, expect, it } from 'vitest';
import { ADMIN_DATA_MODULES } from '@shared/adminDataModules';

const REQUIRED_REGISTERED_PATHS = [
  '/terminal',
  '/_convertible-bonds-category',
  '/_credit-derivatives',
  '/_derivatives-base',
  '/_derivatives-enhanced',
  '/_derivatives-news',
  '/_derivatives-research',
  '/_global-cds',
  '/_latest',
  '/_pricing-and-risk',
  '/_showcase',
  '/bmap',
  '/help',
  '/settings',
  '/verify-export',
] as const;

describe('后台模块目录覆盖', () => {
  it('为每个已登记模块提供唯一后台标识和前端入口路径', () => {
    expect(new Set(ADMIN_DATA_MODULES.map((module) => module.id)).size).toBe(ADMIN_DATA_MODULES.length);
    expect(ADMIN_DATA_MODULES.every((module) => module.path.startsWith('/'))).toBe(true);
    expect(ADMIN_DATA_MODULES).toHaveLength(364);
  });

  it('将主权债 24 个原有入口登记为互不串流的后台数据槽', () => {
    const sovereign = ADMIN_DATA_MODULES.filter((module) => module.id.startsWith('sov-'));
    expect(sovereign).toHaveLength(24);
    expect(new Set(sovereign.map((module) => module.path)).size).toBe(24);
    expect(sovereign.every((module) => module.path.includes('module=sovereign-bonds'))).toBe(true);
  });

  it('将抵押债 26 个原有入口登记为互不串流的后台数据槽', () => {
    const mortgage = ADMIN_DATA_MODULES.filter((module) => module.id.startsWith('mortgage-'));
    expect(mortgage).toHaveLength(26);
    expect(new Set(mortgage.map((module) => module.path)).size).toBe(26);
    expect(mortgage.every((module) => module.path.includes('module=mortgage-bonds'))).toBe(true);
    expect(mortgage.every((module) => module.delivery.canRefresh)).toBe(true);
  });

  it('将股市、优先股和行业分组逐功能登记为 33/23/22 个唯一推送目标', () => {
    const groups = [
      ['stock-', 33, 'module=stocks'],
      ['preferred-stock-', 23, 'module=preferred-stock'],
      ['industry-group-', 22, 'module=industry-group'],
    ] as const;
    for (const [prefix, expected, query] of groups) {
      const modules = ADMIN_DATA_MODULES.filter(module => module.id.startsWith(prefix));
      expect(modules).toHaveLength(expected);
      expect(new Set(modules.map(module => module.path)).size).toBe(expected);
      expect(modules.every(module => module.path.includes(query))).toBe(true);
      expect(modules.every(module => module.delivery.canRefresh && module.delivery.canSchedule)).toBe(true);
    }
    expect(ADMIN_DATA_MODULES.some(module => ['stock-research', 'preferred-stock-research', 'industry-group'].includes(module.id))).toBe(false);
  });

  it('覆盖此前遗漏的冻结前端功能路由，且登记不修改这些前端入口', () => {
    const managedPaths = new Set(ADMIN_DATA_MODULES.map((module) => module.path));
    for (const path of REQUIRED_REGISTERED_PATHS) expect(managedPaths.has(path)).toBe(true);
  });
});
