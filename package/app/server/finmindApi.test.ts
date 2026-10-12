import { afterEach, describe, expect, it, vi } from "vitest";
import { projectArchivedPublicObservations } from "./archivedPublicDataset";
import {
  cleanFinMindRow,
  fetchFinMindDataset,
  finMindDatasetRequiresDataId,
  listFinMindDatasetCatalog,
} from "./finmindApi";
import {
  assertFinMindBindingUniqueness,
  FINMIND_MODULE_BINDINGS,
} from "../shared/finmindModuleBindings";
import { finMindObservationSymbol } from "./finmindSync";
import {
  formatTaiwanContractMonth,
  taiwanDerivativeUnderlying,
  taiwanFuturesContractName,
  taiwanOptionContractName,
  taiwanTradingSession,
} from "../shared/taiwanDerivativeNames";

describe("FinMind adapter boundaries", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("removes transport, credential, collection, and provenance fields before projection", () => {
    expect(cleanFinMindRow({
      date: "2026-09-22",
      close: 128.5,
      title: "公开业务标题",
      source: "internal",
      source_url: "https://internal.invalid",
      provider: "internal-provider",
      api_key: "secret",
      token: "secret",
      crawler_status: "done",
      nested: { hidden: true },
    })).toEqual({ date: "2026-09-22", close: 128.5, title: "公开业务标题", nested: null });
  });

  it("rejects datasets outside the allowlist without making a network request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await fetchFinMindDataset({ dataset: "UnknownDataset" });
    expect(result).toMatchObject({ available: false, rows: [], freshness: "unavailable" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not fabricate observations when an allowed dataset is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 402, msg: "permission required", data: [] }), { status: 200 })));
    const result = await fetchFinMindDataset({ dataset: "TaiwanOptionDaily", dataId: "TXO" });
    expect(result.available).toBe(false);
    expect(result.rows).toEqual([]);
    expect(result.freshness).toBe("unavailable");
  });

  it("returns only cleaned business fields from a successful response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status: 200,
      data: [{ date: "2026-09-22 00:00:00", Price: 4366.37, sourceReference: "private", endpoint: "hidden", token: "hidden" }],
    }), { status: 200 })));
    const result = await fetchFinMindDataset({ dataset: "GoldPrice", limit: 1 });
    expect(result).toMatchObject({ available: true, observedAt: "2026-09-22 00:00:00", freshness: "official_reference" });
    expect(result.rows).toEqual([{ date: "2026-09-22 00:00:00", Price: 4366.37 }]);
  });

  it("keeps data-id requirements explicit instead of sending synthetic symbols", () => {
    expect(finMindDatasetRequiresDataId("GoldPrice")).toBe(false);
    expect(finMindDatasetRequiresDataId("TaiwanStockPrice")).toBe(true);
    expect(listFinMindDatasetCatalog().some(item => item.dataset === "USStockInfo")).toBe(true);
  });

  it("selects actual latest-day options by volume rather than arbitrary response order", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status: 200,
      data: [
        { date: "2026-09-23", option_id: "TXO", volume: 9, strike_price: 23000 },
        { date: "2026-09-24", option_id: "TXO", volume: 15, strike_price: 24000, token: "private" },
        { date: "2026-09-24", option_id: "TXO", volume: 3, strike_price: 25000 },
        { date: "2026-09-24", option_id: "TXO", volume: 30, strike_price: 26000 },
        { date: "2026-09-23", option_id: "TXO", volume: 99, strike_price: 27000 },
      ],
    }), { status: 200 })));
    const result = await fetchFinMindDataset({
      dataset: "TaiwanOptionDaily", dataId: "TXO", limit: 2, selection: "latest_active_options",
    });
    expect(result).toMatchObject({ available: true, observedAt: "2026-09-24", freshness: "end_of_day" });
    expect(result.rows.map(row => row.strike_price)).toEqual([26000, 24000]);
    expect(JSON.stringify(result.rows)).not.toContain("private");
  });
});

describe("FinMind ownership and archive projection", () => {
  it("names only verified index products, including calendar spreads and weekly options", () => {
    expect(taiwanDerivativeUnderlying("TXO")).toBe("台湾加权股价指数");
    expect(taiwanDerivativeUnderlying("UNKNOWN")).toBe("标的名称待核验");
    expect(taiwanFuturesContractName("TX", "202610/202611"))
      .toBe("台股指数期货跨月价差 2026年10月 / 2026年11月");
    expect(taiwanOptionContractName("TXO", "202609W4", 57400, "PUT"))
      .toBe("台股指数选择权 2026年9月第4周 57,400点 卖权");
    expect(formatTaiwanContractMonth("202706")).toBe("2027年6月");
    expect(taiwanOptionContractName("TXO", "", null, ""))
      .toContain("履约价未提供");
    expect(taiwanTradingSession("position")).toContain("待核验");
  });

  it("assigns every contract and scope to one existing module only", () => {
    expect(assertFinMindBindingUniqueness()).toBe(true);
    const contractOwners = new Map<string, string>();
    for (const binding of FINMIND_MODULE_BINDINGS) {
      expect(contractOwners.has(binding.dataContractId)).toBe(false);
      contractOwners.set(binding.dataContractId, binding.moduleId);
    }
  });

  it("rejects a duplicate data contract before it can be delivered twice", () => {
    const first = FINMIND_MODULE_BINDINGS[0];
    expect(() => assertFinMindBindingUniqueness([
      first,
      { ...first, id: "another-id", moduleId: "commodity-market", dataScopeKey: "another-scope" },
    ])).toThrow(/FINMIND_BINDING_DUPLICATE:contract/);
  });

  it("keeps each futures and options contract as a separate permanent series", () => {
    const future = FINMIND_MODULE_BINDINGS.find(binding => binding.dataset === "TaiwanFuturesDaily")!;
    const option = FINMIND_MODULE_BINDINGS.find(binding => binding.dataset === "TaiwanOptionDaily")!;
    expect(finMindObservationSymbol(future, { futures_id: "TX", contract_date: "202610", trading_session: "position" }))
      .not.toBe(finMindObservationSymbol(future, { futures_id: "TX", contract_date: "202611", trading_session: "position" }));
    expect(finMindObservationSymbol(option, { option_id: "TXO", contract_date: "202610", strike_price: 25000, call_put: "call", trading_session: "position" }))
      .not.toBe(finMindObservationSymbol(option, { option_id: "TXO", contract_date: "202610", strike_price: 25000, call_put: "put", trading_session: "position" }));
  });

  it("keeps the newest permanent revision per symbol and date and preserves news text", () => {
    const rows = projectArchivedPublicObservations([
      { id: 1, symbol: "2330", observationDate: "2026-09-20", fetchedAt: new Date("2026-09-20T01:00:00Z"), payload: { symbol: "2330", title: "旧标题", description: "旧摘要", sourceReference: "hidden" } },
      { id: 2, symbol: "2330", observationDate: "2026-09-20", fetchedAt: new Date("2026-09-20T02:00:00Z"), payload: { symbol: "2330", title: "新标题", description: "专业摘要", frequency: "发布时", freshness: "historical", sourceReference: "hidden" } },
    ]);
    expect(rows).toEqual([{
      date: "2026-09-20",
      payload: { title: "新标题", description: "专业摘要", symbol: "2330", frequency: "发布时", freshness: "historical" },
    }]);
    expect(JSON.stringify(rows)).not.toMatch(/source|provider|crawler|endpoint/i);
  });

  it("projects only safe derivative names and measurements, not collection metadata", () => {
    const rows = projectArchivedPublicObservations([{
      id: 1, symbol: "TXO:202706:57400:PUT:position", observationDate: "2026-09-24",
      fetchedAt: new Date("2026-09-24T03:00:00Z"),
      payload: {
        symbol: "TXO:202706:57400:PUT:position", underlyingName: "台湾加权股价指数（非个股）",
        contractName: "台股指数选择权 2027年6月 57,400点 卖权",
        contractMonth: "202706", strikePrice: 57400, optionType: "PUT", volume: 12,
        sourceReference: "internal", token: "private",
      },
    }]);
    expect(rows[0]?.payload).toMatchObject({
      contractName: "台股指数选择权 2027年6月 57,400点 卖权", underlyingName: "台湾加权股价指数",
      contractMonth: "202706", volume: 12,
    });
    expect(JSON.stringify(rows)).not.toMatch(/source|token|private|internal/i);
  });
});
