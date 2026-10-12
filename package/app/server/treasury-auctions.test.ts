import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fetchTreasuryAuctions } from './realDataService';

afterEach(() => vi.unstubAllGlobals());

describe('美国财政部官方拍卖适配器', () => {
  it('将官方字符串字段转换为可解释的拍卖参考并跳过 null 结果', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { record_date: '2026-08-20', cusip: '91282CRF0', security_type: 'Note', security_term: '10-Year', auction_date: '2026-08-12', issue_date: '2026-08-15', maturity_date: '2036-08-15', offering_amt: '42000000000', bid_to_cover_ratio: '2.5', high_yield: '4.683000', high_investment_rate: 'null', high_discnt_rate: 'null', high_price: 'null', int_rate: '4.625000' },
          { record_date: '2026-08-20', cusip: '912797VC8', security_type: 'Bill', security_term: '4-Week', auction_date: '2026-08-11', issue_date: '2026-08-13', maturity_date: '2026-09-10', offering_amt: '110000000000', bid_to_cover_ratio: 'null', high_yield: 'null', high_investment_rate: '3.686000', high_discnt_rate: 'null', high_price: 'null', int_rate: 'null' },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const data = await fetchTreasuryAuctions(2);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(data).toHaveLength(2);
    expect(data[0]).toMatchObject({ cusip: '91282CRF0', offeringAmount: 42_000_000_000, resultMetricLabel: '最高收益率', resultMetricValue: 4.683, couponRate: 4.625 });
    expect(data[1]).toMatchObject({ cusip: '912797VC8', bidToCoverRatio: null, resultMetricLabel: '投资利率', resultMetricValue: 3.686, couponRate: null });
  });

  it('官方接口失败时返回真实空状态而非生成拍卖记录', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    await expect(fetchTreasuryAuctions()).resolves.toEqual([]);
  });
});

describe('账户研究登记簿工作流完整性', () => {
  const root = resolve(import.meta.dirname, '..');
  const source = readFileSync(resolve(root, 'server/routers/researchLedger.ts'), 'utf8');

  it('提交要求登录、审批要求管理员，且具备不可覆盖式审计查询', () => {
    expect(source).toContain('submit: protectedProcedure');
    expect(source).toContain('pending: adminProcedure');
    expect(source).toContain('review: adminProcedure');
    expect(source).toContain('audit: protectedProcedure');
  });

  it('共享界面不再将新研究条目写入浏览器本地存储', () => {
    const workspace = readFileSync(resolve(root, 'client/src/components/sovereign/ResearchLedgerWorkspace.tsx'), 'utf8');
    expect(workspace).not.toContain('localStorage.setItem');
    expect(workspace).toContain('登录并同步');
    expect(workspace).toContain('提交账户登记并送审');
  });

  it('提交和审核均使用账户通知，并把审批截止时间作为持久化数据与界面倒计时依据', () => {
    const database = readFileSync(resolve(root, 'server/db.ts'), 'utf8');
    const schema = readFileSync(resolve(root, 'drizzle/schema.ts'), 'utf8');
    const workspace = readFileSync(resolve(root, 'client/src/components/sovereign/ResearchLedgerWorkspace.tsx'), 'utf8');
    expect(schema).toContain('approvalDueAt: timestamp("approval_due_at").notNull()');
    expect(database).toContain('24 * 60 * 60 * 1000');
    expect(database).toContain("where(eq(users.role, 'admin'))");
    expect(database).toContain("relatedType: 'research_ledger'");
    expect(workspace).toContain('approvalCountdown');
    expect(workspace).toContain('提交账户登记并送审（24 小时）');
  });

  it('管理员可按即将到期或已逾期筛选队列，且审计记录支持基于当前权限数据的 PDF/PNG 导出', () => {
    const workspace = readFileSync(resolve(root, 'client/src/components/sovereign/ResearchLedgerWorkspace.tsx'), 'utf8');
    expect(workspace).toContain("approvalFilter === 'dueSoon'");
    expect(workspace).toContain("approvalFilter === 'overdue'");
    expect(workspace).toContain('即将到期（2 小时内）');
    expect(workspace).toContain('ExportMenu');
    expect(workspace).toContain('targetRef={auditExportRef}');
  });
});
