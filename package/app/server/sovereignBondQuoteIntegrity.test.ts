import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

vi.mock("./realDataService", async importOriginal => {
  const actual = await importOriginal<typeof import("./realDataService")>();
  return { ...actual, fetchMultipleYahoo: vi.fn(), fetchNasdaqHistorical: vi.fn() };
});
vi.mock("./archivedPublicDataset", () => ({ readArchivedPublicDataset: vi.fn() }));
vi.mock("./adminMarketIngestion", () => ({ archiveCanonicalObservationSeries: vi.fn(async () => ({ inserted: 0, duplicate: 0, revisions: 0, total: 0 })) }));
vi.mock("./publicDatasetPersistence", () => ({ archivePublicDatasetObservations: vi.fn() }));

import { fetchMultipleYahoo, fetchNasdaqHistorical } from "./realDataService";
import { readArchivedPublicDataset } from "./archivedPublicDataset";
import { archiveCanonicalObservationSeries } from "./adminMarketIngestion";
import { sovereignBondsRouter } from "./routers/sovereignBonds";
import type { TrpcContext } from "./_core/context";

const context = { user: null } as TrpcContext;
const caller = sovereignBondsRouter.createCaller(context);
const history = [
  { date: "2026-09-25", value: 100 },
  { date: "2026-09-28", value: 101 },
];

describe("WB 原有跨市场面板的报价边界", () => {
  beforeEach(() => {
    vi.mocked(fetchMultipleYahoo).mockReset();
    vi.mocked(fetchNasdaqHistorical).mockReset().mockResolvedValue(null);
    vi.mocked(readArchivedPublicDataset).mockReset().mockResolvedValue({ available: false, status: "not_collected", observations: [] });
    vi.mocked(archiveCanonicalObservationSeries).mockClear();
  });

  it("接口空响应时保留品种入口，但绝不按时钟生成期货或 ETF 价格", async () => {
    vi.mocked(fetchMultipleYahoo).mockResolvedValue({});
    const futures = await caller.getTreasuryFutures();
    const etfs = await caller.getGlobalBondETFs({ range: "1mo" });
    expect(futures.dataMode).toBe("UNAVAILABLE");
    expect(etfs.dataMode).toBe("UNAVAILABLE");
    expect(futures.data.every(row => row.price === null && row.history.length === 0)).toBe(true);
    expect(etfs.data.every(row => row.price === null && row.history.length === 0)).toBe(true);
  });

  it("过期归档保留真实历史日期，但不作为当前价格；新发布观察仍可显示", async () => {
    const today = new Date().toISOString().slice(0, 10);
    vi.mocked(fetchMultipleYahoo).mockResolvedValue({
      "ZN=F": {
        price: 101, change: 1, changePct: 1, history,
        meta: { realtimeStatus: "archived", observedAt: "2026-09-28", persistentFallback: true },
      },
      "ZB=F": {
        price: 102, change: 1, changePct: 1,
        history: [{ date: today, value: 101 }, { date: today, value: 102 }],
        meta: { realtimeStatus: "end_of_day", observedAt: today, persistentFallback: false },
      },
    } as Awaited<ReturnType<typeof fetchMultipleYahoo>>);
    const result = await caller.getTreasuryFutures();
    expect(result.dataMode).toBe("MIXED");
    expect(result.data[0]).toMatchObject({
      symbol: "ZN=F", price: null, dataMode: "ARCHIVED", observedAt: "2026-09-28",
      history,
    });
    expect(result.data[1]).toMatchObject({ symbol: "ZB=F", price: 102, dataMode: "OBSERVED", observedAt: today });
    expect(result.data[2]).toMatchObject({ symbol: "ZT=F", price: null, dataMode: "UNAVAILABLE" });
  });

  it("跨国研究矩阵不会因接收到重复通道帧而制造价格波动或标称 LIVE", () => {
    const source = readFileSync(new URL("../client/src/pages/BondMarketData.tsx", import.meta.url), "utf8");
    expect(source).not.toContain("Math.sin((simulationTick");
    expect(source).not.toContain('"SIM FLOW" : "LIVE"');
    expect(source).toContain("研究参数 · 非实时行情");
  });

  it("原有 ETF 槽位在第一路径缺失时读取真实日线，并在失败时仅显示归档历史", async () => {
    vi.mocked(fetchMultipleYahoo).mockResolvedValue({});
    const today = new Date().toISOString().slice(0, 10);
    vi.mocked(fetchNasdaqHistorical).mockImplementation(async symbol => symbol === "IGOV" ? {
      symbol, price: 40.5, change: 0.5, changePct: 1.25, currency: "USD",
      history: [{ date: "2026-09-30", value: 40, close: 40, volume: 100, open: null, high: null, low: null },
        { date: today, value: 40.5, close: 40.5, volume: 120, open: null, high: null, low: null }],
      meta: { realtimeStatus: "end_of_day", observedAt: today }, source: "Nasdaq historical market data",
    } : null);
    vi.mocked(readArchivedPublicDataset).mockResolvedValue({
      available: true, status: "available",
      observations: [
        { date: "2026-09-26", payload: { symbol: "BWX", value: 20, close: 20 } },
        { date: "2026-09-29", payload: { symbol: "BWX", value: 21, close: 21 } },
      ],
    });
    const etfs = await caller.getGlobalBondETFs({ range: "1mo" });
    expect(etfs.dataMode).toBe("MIXED");
    expect(etfs.data.find(row => row.symbol === "IGOV")).toMatchObject({ price: 40.5, dataMode: "OBSERVED", observedAt: today });
    expect(etfs.data.find(row => row.symbol === "BWX")).toMatchObject({ price: null, dataMode: "ARCHIVED", observedAt: "2026-09-29" });
    expect(etfs.data.find(row => row.symbol === "BWX")?.history).toHaveLength(2);
    expect(archiveCanonicalObservationSeries).toHaveBeenCalledWith(expect.objectContaining({
      dataContractId: "bond.global.etf.nasdaq.daily.v1",
      moduleId: "sov-04-wb",
      history: expect.arrayContaining([expect.objectContaining({ symbol: "IGOV", date: today })]),
    }));
  });
});
