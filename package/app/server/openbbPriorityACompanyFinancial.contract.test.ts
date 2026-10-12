import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  selectCompanyFinancialDelivery,
  type CompanyFinancialDelivery,
} from "../client/src/lib/openBBCompanyFinancial";
import type { ModuleLiveFeedItem } from "../client/src/hooks/useModuleLiveFeed";

const read = (path: string) => readFileSync(path, "utf8");

describe("OpenBB Priority A company financial frontend closure", () => {
  it("keeps all three deliveries inside their existing frontend routes", () => {
    const bi = read("client/src/components/BIPanel.tsx");
    const res = read("client/src/components/RESPanel.tsx");
    const analysis = read("client/src/pages/FinancialAnalysis.tsx");
    expect(bi).toContain("/terminal?open=bi-stox&module=stocks");
    expect(bi).toContain("BI STOX 公司财务横截面");
    expect(res).toContain("/terminal?open=res&module=stocks");
    expect(res).toContain("RES SEC 申报财务证据");
    expect(analysis).toContain("/financial-analysis");
    expect(analysis).toContain("数据源未配置；原页面不再用静态数字填充");
  });

  it("accepts only SEC income-statement shaped datasets and orders periods", () => {
    const item: ModuleLiveFeedItem = {
      itemKey: "sec-aapl",
      title: "公司利润表 · AAPL",
      body: "SEC provider response",
      topic: "公司利润表",
      category: "宏观与研究",
      sourceKind: "public",
      dataset: {
        label: "公司利润表",
        columns: ["period_ending", "total_revenue", "net_income", "reported_currency"],
        rows: [
          { period_ending: "2025-09-27", total_revenue: 416161000000, net_income: 112010000000, reported_currency: "USD" },
          { period_ending: "2024-09-28", total_revenue: 391035000000, net_income: 93736000000, reported_currency: "USD" },
        ],
        metadata: { provider: "sec", queriedAt: "2026-09-17T00:00:00Z", observedAt: "2025-09-27", timezone: "provider-defined", rowCount: 2, displayedRowCount: 2, truncated: false, quality: "provider_response", realtimeStatus: "provider_defined", schemaVersion: "openbb-query-v1", checksum: "a".repeat(64) },
      },
    };
    const selected = selectCompanyFinancialDelivery([item]) as CompanyFinancialDelivery;
    expect(selected.symbol).toBe("AAPL");
    expect(selected.rows.map(row => row.periodEnding)).toEqual(["2024-09-28", "2025-09-27"]);
    expect(selected.rows.at(-1)?.revenue).toBe(416161000000);
    expect(selectCompanyFinancialDelivery([{ ...item, dataset: { ...item.dataset!, metadata: { ...item.dataset!.metadata, provider: "unknown" } } }])).toBeNull();
  });
});
