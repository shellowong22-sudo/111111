import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const marketPage = readFileSync(resolve(projectRoot, "client/src/pages/MarketDataPage.tsx"), "utf8");
const curvePage = readFileSync(resolve(projectRoot, "client/src/pages/YieldCurveAnalysis.tsx"), "utf8");

describe("行情与曲线刷新体验契约", () => {
  it("行情页仅在 WebSocket 实际 connected 时标记 LIVE，并展示查询快照刷新状态", () => {
    expect(marketPage).toContain("const isLive = status === 'connected'");
    expect(marketPage).toContain("<ConnectionIndicator status={wsStatus} />");
    expect(marketPage).toContain("正在更新数据库快照");
    expect(marketPage).toContain("snapshotUpdatedAt");
    expect(marketPage).toContain("activeQuery.refetch()");
    expect(marketPage).not.toContain("wsStatus === 'connected' || wsStatus === 'connecting'");
  });

  it("曲线页对已落库数据执行查询级刷新，保留现有曲线并在后台更新时给出反馈", () => {
    expect(curvePage).toContain("refetchInterval: 60_000");
    expect(curvePage).toContain("const handleRefresh = async () =>");
    expect(curvePage).toContain("snapshotQuery.refetch()");
    expect(curvePage).toContain("historyQuery.refetch()");
    expect(curvePage).toContain("正在重新读取已落库曲线");
    expect(curvePage).toContain("后台更新中");
    expect(curvePage).toContain("disabled={curvesQuery.isLoading || isRefreshing}");
  });
});
