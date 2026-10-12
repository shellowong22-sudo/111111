import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertMoneyMarketFeatureContractUniqueness,
  fetchAlphaVantageDailySeries,
  fetchBlsPublicSeries,
  fetchEcbReferenceRate,
  fetchEiaWeeklyNaturalGasStorage,
  fetchEurostatEu27Unemployment,
  fetchHkmaDailyExchangeRates,
  fetchBankOfCanadaFx,
  fetchFredPublicSeries,
  fetchImfDataMapperSeries,
  fetchNyFedLatest,
  fetchNormalizedImfForecastMatrix,
  fetchNormalizedMoneyMarketSnapshot,
  fetchSecCompanyFacts,
  fetchStooqDailySeries,
  fetchTwelveDataDailySeries,
  fetchTreasuryTotalPublicDebt,
  fetchWorldBankIndicator,
  listFreeMarketDataSources,
  listOptionalMarketDataSources,
  MONEY_MARKET_FEATURE_CONTRACTS,
} from "./freeMarketData";

describe("免费公开市场数据适配器", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("解析 Stooq 日线并保留 OHLCV 与日终边界", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            [
              "Date,Open,High,Low,Close,Volume",
              "2026-09-10,100,101,99,100.5,1200",
              "2026-09-11,100.5,102,100,101.25,1500",
              "2026-09-12,101.25,103,101,102,1800",
            ].join("\n"),
            { status: 200 }
          )
      )
    );
    const result = await fetchStooqDailySeries("SPY", 2);
    expect(result.available).toBe(true);
    expect(result.source).toBe("Stooq public CSV");
    expect(result.delayStatus).toBe("end_of_day");
    expect(result.history).toHaveLength(2);
    expect(result.history.at(-1)).toMatchObject({
      date: "2026-09-12",
      close: 102,
      volume: 1800,
    });
    expect(result.realtime).toBe(false);
  });

  it("解析香港金管局公开汇率并按日期去重排序", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ result: { records: [
      { end_of_day: "2026-09-11", usd: 7.84, eur: 9.1, cny: 1.16, jpy: 0.049, neeri_2020_trade_wgt: 100.2 },
      { end_of_day: "2026-09-12", usd: 7.83, eur: 9.11, cny: 1.17, jpy: 0.05, neeri_2020_trade_wgt: 100.4 },
      { end_of_day: "2026-09-12", usd: 7.83, eur: 9.11, cny: 1.17, jpy: 0.05, neeri_2020_trade_wgt: 100.4 },
      { end_of_day: "2026-09-13", usd: null, eur: -1 },
    ] } }), { status: 200 })));
    const result = await fetchHkmaDailyExchangeRates(10);
    expect(result.available).toBe(true);
    expect(result.source).toContain("Hong Kong Monetary Authority");
    expect(result.observations).toHaveLength(2);
    expect(result.observedAt).toBe("2026-09-12");
    expect(result.observations[1]).toMatchObject({ usd: 7.83, index: 100.4 });
    expect(result.realtime).toBe(false);
  });

  it("解析加拿大央行 Valet USD/CAD 参考序列", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ observations: [
      { d: "2026-09-11", FXUSDCAD: { v: "1.3850" } },
      { d: "2026-09-12", FXUSDCAD: { v: "1.3875" } },
      { d: "2026-09-12", FXUSDCAD: { v: "1.3875" } },
      { d: "2026-09-13", FXUSDCAD: { v: "0" } },
    ] }), { status: 200 })));
    const result = await fetchBankOfCanadaFx(10);
    expect(result).toMatchObject({ available: true, pair: "USD/CAD", source: "Bank of Canada Valet API", observedAt: "2026-09-12", realtime: false });
    expect(result.history.map(point => point.value)).toEqual([1.385, 1.3875]);
  });

  it("rejects HKMA application errors even on HTTP 200", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ header: { success: false }, result: { records: [{ end_of_day: "2026-09-12", usd: 7.8 }] } }))));
    expect((await fetchHkmaDailyExchangeRates()).available).toBe(false);
  });

  it("将 FRED 的 . 和空值过滤掉，不把缺失观察当作零", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            [
              "observation_date,SOFR",
              "2026-09-10,.",
              "2026-09-11,5.31",
              "2026-09-12,5.30",
            ].join("\n"),
            { status: 200 }
          )
      )
    );
    const result = await fetchFredPublicSeries("SOFR");
    expect(result.available).toBe(true);
    expect(result.history.map(point => point.value)).toEqual([5.31, 5.3]);
    expect(result.sourceUrl).toContain(
      "fred.stlouisfed.org/graph/fredgraph.csv"
    );
  });

  it("rejects a different FRED series instead of relabelling its values", async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('observation_date,WRONG\n2026-09-01,999')));
    expect(await fetchFredPublicSeries('UNRATE')).toMatchObject({available:false,history:[]});
  });

  it("识别 Stooq 浏览器校验页且不将 HTML 解析成行情", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            "<!DOCTYPE html><html><body>browser verification</body></html>",
            { status: 200 }
          )
      )
    );
    const result = await fetchStooqDailySeries("SPY.US", 3);
    expect(result).toMatchObject({
      available: false,
      delayStatus: "unavailable",
      history: [],
    });
    expect(result.limitation).toContain("浏览器校验");
  });

  it("解析世界银行公开指标并过滤空值", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify([
              { page: 1, pages: 1 },
              [
                { date: "2025", value: 3.2 },
                { date: "2024", value: null },
                { date: "2023", value: 2.8 },
              ],
            ]),
            { status: 200, headers: { "content-type": "application/json" } }
          )
      )
    );
    const result = await fetchWorldBankIndicator(
      "WLD",
      "NY.GDP.MKTP.KD.ZG",
      10
    );
    expect(result).toMatchObject({
      available: true,
      source: "World Bank Indicators API",
      observedAt: "2025",
      realtime: false,
      delayStatus: "latest_public_release",
    });
    expect(result.history.map(point => point.value)).toEqual([2.8, 3.2]);
  });

  it("解析 ECB 参考汇率并计算相邻公开观察变化", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            [
              "KEY,FREQ,CURRENCY,CURRENCY_DENOM,TIME_PERIOD,OBS_VALUE",
              "A,D,USD,EUR,2026-09-11,1.1700",
              "A,D,USD,EUR,2026-09-12,1.1720",
            ].join("\n"),
            { status: 200 }
          )
      )
    );
    const result = await fetchEcbReferenceRate("USD/EUR", 30);
    expect(result.available).toBe(true);
    expect(result.rate).toBe(1.172);
    expect(result.change).toBeCloseTo(0.002);
    expect(result.delayStatus).toBe("official_reference");
    expect(result.limitation).toContain("不是实时交易");
  });

  it("NY Fed 无数据时返回明确空状态", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ refRates: [] }), { status: 200 })
      )
    );
    const result = await fetchNyFedLatest();
    expect(result.available).toBe(false);
    expect(result.records).toEqual([]);
    expect(result.limitation).toContain("未生成替代值");
  });

  it("后端清洗资金市场记录，只保留受控字段且不返回外部跳转", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              refRates: [
                {
                  effectiveDate: "2026-09-17",
                  type: "TGCR",
                  percentRate: 3.83,
                  percentPercentile1: 3.7,
                  percentPercentile25: 3.82,
                  percentPercentile75: 3.84,
                  percentPercentile99: 3.9,
                  volumeInBillions: 1208,
                  providerOnlyField: "drop-me",
                },
                {
                  effectiveDate: "2026-09-17",
                  type: "BGCR",
                  percentRate: 3.84,
                  volumeInBillions: 1237,
                },
                {
                  effectiveDate: "2026-09-17",
                  type: "SOFR",
                  percentRate: 3.85,
                },
                {
                  effectiveDate: "2026-09-17",
                  type: "UNKNOWN",
                  percentRate: 99,
                },
                { effectiveDate: "bad-date", type: "TGCR", percentRate: 3.83 },
              ],
            }),
            { status: 200 }
          )
      )
    );
    const result = await fetchNormalizedMoneyMarketSnapshot();
    expect(result.available).toBe(true);
    expect(result.observedAt).toBe("2026-09-17");
    expect(result.rates.map(row => row.instrument)).toEqual(["TGCR", "BGCR"]);
    expect(result.rates[0]).toEqual({
      instrument: "TGCR",
      effectiveDate: "2026-09-17",
      rate: 3.83,
      percentile1: 3.7,
      percentile25: 3.82,
      percentile75: 3.84,
      percentile99: 3.9,
      targetFrom: null,
      targetTo: null,
      volumeInBillions: 1208,
    });
    expect(JSON.stringify(result)).not.toMatch(
      /https?:|providerOnlyField|sourceUrl/i
    );
  });

  it("把货币市场四个功能拆成唯一契约并拒绝重复语义范围", () => {
    expect(assertMoneyMarketFeatureContractUniqueness()).toBe(true);
    expect(
      new Set(MONEY_MARKET_FEATURE_CONTRACTS.map(item => item.featureId)).size
    ).toBe(MONEY_MARKET_FEATURE_CONTRACTS.length);
    expect(
      new Set(MONEY_MARKET_FEATURE_CONTRACTS.map(item => item.dataContractId))
        .size
    ).toBe(MONEY_MARKET_FEATURE_CONTRACTS.length);
    expect(
      new Set(MONEY_MARKET_FEATURE_CONTRACTS.map(item => item.dataScopeKey))
        .size
    ).toBe(MONEY_MARKET_FEATURE_CONTRACTS.length);
    expect(() =>
      assertMoneyMarketFeatureContractUniqueness([
        MONEY_MARKET_FEATURE_CONTRACTS[0],
        {
          ...MONEY_MARKET_FEATURE_CONTRACTS[1],
          featureId: "duplicate-feature",
          dataContractId: "duplicate.contract",
          dataScopeKey: MONEY_MARKET_FEATURE_CONTRACTS[0].dataScopeKey,
        },
      ])
    ).toThrow("MONEY_MARKET_FEATURE_CONTRACT_DUPLICATE:scope");
  });

  it("跨功能分片不重复投递同一标的同一观察日", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes("/all/latest.json"))
          return new Response(
            JSON.stringify({
              refRates: [
                {
                  effectiveDate: "2026-09-17",
                  type: "TGCR",
                  percentRate: 3.83,
                  volumeInBillions: 1208,
                },
                {
                  effectiveDate: "2026-09-17",
                  type: "BGCR",
                  percentRate: 3.84,
                  volumeInBillions: 1237,
                },
                {
                  effectiveDate: "2026-09-17",
                  type: "SOFR",
                  percentRate: 3.85,
                },
              ],
            }),
            { status: 200 }
          );
        if (url.includes("/secured/all/search.json"))
          return new Response(
            JSON.stringify({
              refRates: [
                {
                  effectiveDate: "2026-09-16",
                  type: "SOFRAI",
                  average30day: 3.64,
                  average90day: 3.65,
                  average180day: 3.66,
                  index: 1.25,
                },
                {
                  effectiveDate: "2026-09-17",
                  type: "SOFRAI",
                  average30day: 3.65,
                  average90day: 3.65,
                  average180day: 3.66,
                  index: 1.26,
                },
              ],
            }),
            { status: 200 }
          );
        return new Response(
          JSON.stringify({
            refRates: [
              {
                effectiveDate: "2026-09-17",
                type: "EFFR",
                percentRate: 3.88,
                targetRateFrom: 3.75,
                targetRateTo: 4.0,
              },
              {
                effectiveDate: "2026-09-16",
                type: "EFFR",
                percentRate: 3.63,
                targetRateFrom: 3.5,
                targetRateTo: 3.75,
              },
              {
                effectiveDate: "2026-09-15",
                type: "EFFR",
                percentRate: 3.63,
                targetRateFrom: 3.5,
                targetRateTo: 3.75,
              },
            ],
          }),
          { status: 200 }
        );
      })
    );
    const result = await fetchNormalizedMoneyMarketSnapshot();
    expect(
      result.rates.map(item => `${item.instrument}|${item.effectiveDate}`)
    ).toEqual(["TGCR|2026-09-17", "BGCR|2026-09-17"]);
    expect(result.sofrAverages).toHaveLength(2);
    expect(result.fedFundsHistory).toEqual([
      { effectiveDate: "2026-09-15", targetFrom: 3.5, targetTo: 3.75 },
      { effectiveDate: "2026-09-17", targetFrom: 3.75, targetTo: 4 },
    ]);
    expect(result.repoExecutions).toEqual([]);
    expect(JSON.stringify(result)).not.toMatch(
      /https?:|sourceUrl|providerOnlyField/i
    );
  });

  it("解析 BLS v2 公开序列并排除年度汇总 M13", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              status: "REQUEST_SUCCEEDED",
              Results: {
                series: [
                  {
                    seriesID: "CUUR0000SA0",
                    data: [
                      { year: "2026", period: "M02", value: "321.1" },
                      { year: "2026", period: "M13", value: "320.2" },
                    ],
                  },
                ],
              },
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          )
      )
    );
    const result = await fetchBlsPublicSeries("CUUR0000SA0", 2026, 2026, 12);
    expect(result.available).toBe(true);
    expect(result.source).toBe("U.S. BLS Public Data API");
    expect(result.history).toEqual([{ date: "2026-02", value: 321.1 }]);
  });

  it("解析 EIA 周度库存，并在空响应时保持空态", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            response: {
              data: [
                { period: "2026-09-11", value: "3250" },
                { period: "2026-09-18", value: "3290" },
              ],
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
    );
    vi.stubGlobal("fetch", fetchMock);
    const result = await fetchEiaWeeklyNaturalGasStorage(10);
    expect(result.available).toBe(true);
    expect(result.source).toBe("U.S. EIA Open Data");
    expect(result.history.at(-1)).toEqual({ date: "2026-09-18", value: 3290 });
    const requestUrl = String(fetchMock.mock.calls[0]?.[0]);
    expect(requestUrl).toContain("facets[duoarea][]=R48");
    expect(requestUrl).toContain("facets[process][]=SWO");
  });

  it("解析美国财政部公共债务记录且不把其他金额字段混入总额", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              data: [
                {
                  record_date: "2026-09-17",
                  tot_pub_debt_out_amt: "40093343468150.50",
                  debt_held_public_amt: "32392786557372.46",
                },
                { record_date: "bad-date", tot_pub_debt_out_amt: "99" },
              ],
            }),
            { status: 200 }
          )
      )
    );
    const result = await fetchTreasuryTotalPublicDebt(10);
    expect(result).toMatchObject({
      available: true,
      symbol: "US:DEBT_TOTAL",
      observedAt: "2026-09-17",
      source: "U.S. Treasury Fiscal Data API",
    });
    expect(result.history).toEqual([
      { date: "2026-09-17", value: 40093343468150.5 },
    ]);
  });

  it("解析 IMF 当前 WEO 年度序列并明确历史/估计/预测边界", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              values: {
                NGDP_RPCH: {
                  WEOWORLD: { "2024": 3.3, "2025": 3.4, "2026": 3.1 },
                },
              },
              api: { version: "1" },
            }),
            { status: 200 }
          )
      )
    );
    const result = await fetchImfDataMapperSeries("NGDP_RPCH", "WEOWORLD", 2);
    expect(result).toMatchObject({
      available: true,
      symbol: "WEOWORLD:NGDP_RPCH",
      observedAt: "2026",
      source: "IMF DataMapper API",
    });
    expect(result.history).toEqual([
      { date: "2025", value: 3.4 },
      { date: "2026", value: 3.1 },
    ]);
    expect(result.limitation).toContain("当前 WEO 版本");
  });

  it("IMF 终端矩阵只返回白名单字段，不暴露外链或原始提供方字段", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request) => {
        const indicator = String(url).endsWith("PCPIPCH")
          ? "PCPIPCH"
          : "NGDP_RPCH";
        return new Response(
          JSON.stringify({
            values: {
              [indicator]: {
                USA: { "2026": indicator === "PCPIPCH" ? 2.7 : 2.3 },
                CHN: { "2026": indicator === "PCPIPCH" ? 1.8 : 4.2 },
                RAW_VENDOR_ROW: { "2026": 999 },
              },
            },
            providerUrl: "https://should-not-leave-server.invalid",
          }),
          { status: 200 }
        );
      })
    );
    const result = await fetchNormalizedImfForecastMatrix(["USA", "CHN"]);
    expect(result.available).toBe(true);
    expect(result.rows).toEqual([
      {
        economy: "USA",
        year: 2026,
        gdpGrowthPct: 2.3,
        inflationPct: 2.7,
        periodKind: "estimate_or_forecast",
      },
      {
        economy: "CHN",
        year: 2026,
        gdpGrowthPct: 4.2,
        inflationPct: 1.8,
        periodKind: "estimate_or_forecast",
      },
    ]);
    expect(JSON.stringify(result)).not.toMatch(
      /https?:|providerUrl|sourceUrl/i
    );
  });

  it("解析 Eurostat JSON-stat 月度失业率且保留缺失月份为空", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              id: ["freq", "geo", "time"],
              size: [1, 1, 3],
              value: { "0": 6.2, "2": 6.1 },
              dimension: {
                time: {
                  category: {
                    index: { "2026-06": 0, "2026-07": 1, "2026-08": 2 },
                  },
                },
              },
            }),
            { status: 200 }
          )
      )
    );
    const result = await fetchEurostatEu27Unemployment(12);
    expect(result).toMatchObject({
      available: true,
      symbol: "EU27_2020:UNEMP_SA",
      observedAt: "2026-08",
      source: "Eurostat Dissemination API",
    });
    expect(result.history).toEqual([
      { date: "2026-06", value: 6.2 },
      { date: "2026-08", value: 6.1 },
    ]);
  });

  it("SEC EDGAR 公司事实保留申报元数据且不推断报价", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              facts: {
                "us-gaap": {
                  Revenues: {
                    label: "Revenue",
                    units: {
                      USD: [
                        {
                          val: 100,
                          start: "2025-01-01",
                          end: "2025-12-31",
                          filed: "2026-02-10",
                          form: "10-K",
                          fy: 2025,
                          fp: "FY",
                          frame: "CY2025",
                          accn: "0000000000-26-000001",
                        },
                        {
                          val: 110,
                          start: "2026-01-01",
                          end: "2026-03-31",
                          filed: "2026-05-01",
                          form: "10-Q",
                          fy: 2026,
                          fp: "Q1",
                          frame: "CY2026Q1",
                          accn: "0000000000-26-000002",
                        },
                      ],
                    },
                  },
                },
              },
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          )
      )
    );
    const result = await fetchSecCompanyFacts("320193", ["Revenues"], 10);
    expect(result.available).toBe(true);
    expect(result.cik).toBe("0000320193");
    expect(result.source).toBe("SEC EDGAR Company Facts");
    expect(result.facts).toHaveLength(2);
    expect(result.facts.at(-1)).toMatchObject({
      tag: "Revenues",
      unit: "USD",
      value: 110,
      form: "10-Q",
      filedAt: "2026-05-01",
    });
    expect(result.realtime).toBe(false);
    expect(result.limitation).toContain("不是实时价格");
  });

  it("公开数据源目录不携带静态行情值并声明免费边界", () => {
    const sources = listFreeMarketDataSources();
    expect(sources.map(source => source.id)).toEqual(
      expect.arrayContaining([
        "stooq",
        "fred",
        "ecb-exr",
        "ny-fed",
        "sec-edgar",
        "world-bank",
        "bls",
        "eia",
        "treasury-fiscal-data",
        "imf-datamapper",
        "eurostat",
      ])
    );
    expect(new Set(sources.map(source => source.id)).size).toBe(sources.length);
    expect(
      sources.every(
        source => source.access === "public_no_key" && source.realtime === false
      )
    ).toBe(true);
    expect(
      sources.every(
        source => !Object.prototype.hasOwnProperty.call(source, "value")
      )
    ).toBe(true);
  });

  it("Twelve Data 未配置密钥时保持真实空状态", async () => {
    const previous = process.env.TWELVE_DATA_API_KEY;
    delete process.env.TWELVE_DATA_API_KEY;
    try {
      const result = await fetchTwelveDataDailySeries("EUR/USD");
      expect(result).toMatchObject({
        available: false,
        configured: false,
        delayStatus: "unavailable",
        history: [],
      });
      expect(result.limitation).toContain("TWELVE_DATA_API_KEY");
    } finally {
      if (previous === undefined) delete process.env.TWELVE_DATA_API_KEY;
      else process.env.TWELVE_DATA_API_KEY = previous;
    }
  });

  it("解析 Twelve Data 实际日线响应并保留方案时效边界", async () => {
    const previous = process.env.TWELVE_DATA_API_KEY;
    process.env.TWELVE_DATA_API_KEY = "test-only-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        expect((init?.headers as Record<string, string>).authorization).toBe(
          "apikey test-only-key"
        );
        return new Response(
          JSON.stringify({
            values: [
              {
                datetime: "2026-09-11",
                open: "1.17",
                high: "1.18",
                low: "1.16",
                close: "1.175",
                volume: "100",
              },
              {
                datetime: "2026-09-12",
                open: "1.175",
                high: "1.19",
                low: "1.17",
                close: "1.185",
                volume: "120",
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      })
    );
    try {
      const result = await fetchTwelveDataDailySeries("EUR/USD", 2);
      expect(result).toMatchObject({
        available: true,
        configured: true,
        source: "Twelve Data",
        realtime: false,
        delayStatus: "plan_dependent",
        observedAt: "2026-09-12",
      });
      expect(result.history).toHaveLength(2);
      expect(result.history.at(-1)).toMatchObject({
        close: 1.185,
        volume: 120,
      });
    } finally {
      vi.unstubAllGlobals();
      if (previous === undefined) delete process.env.TWELVE_DATA_API_KEY;
      else process.env.TWELVE_DATA_API_KEY = previous;
    }
  });

  it("把需密钥的免费额度提供方与免密公开源分开列出", () => {
    const optional = listOptionalMarketDataSources();
    expect(optional.length).toBeGreaterThanOrEqual(2);
    expect(optional).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "twelve-data",
          access: "free_tier_api_key",
          apiKeyEnvName: "TWELVE_DATA_API_KEY",
          realtime: "plan_dependent",
        }),
        expect.objectContaining({
          id: "alpha-vantage",
          access: "free_tier_api_key",
          apiKeyEnvName: "ALPHA_VANTAGE_API_KEY",
          realtime: "plan_dependent",
        }),
      ])
    );
  });

  it("Alpha Vantage 未配置密钥时保持真实空状态", async () => {
    const previous = process.env.ALPHA_VANTAGE_API_KEY;
    delete process.env.ALPHA_VANTAGE_API_KEY;
    try {
      const result = await fetchAlphaVantageDailySeries("IBM");
      expect(result).toMatchObject({
        available: false,
        configured: false,
        delayStatus: "unavailable",
        history: [],
      });
      expect(result.limitation).toContain("ALPHA_VANTAGE_API_KEY");
    } finally {
      if (previous === undefined) delete process.env.ALPHA_VANTAGE_API_KEY;
      else process.env.ALPHA_VANTAGE_API_KEY = previous;
    }
  });

  it("解析 Alpha Vantage 实际日线响应且不暴露密钥", async () => {
    const previous = process.env.ALPHA_VANTAGE_API_KEY;
    process.env.ALPHA_VANTAGE_API_KEY = "test-only-alpha-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request) => {
        expect(String(url)).toContain("apikey=test-only-alpha-key");
        return new Response(
          JSON.stringify({
            "Time Series (Daily)": {
              "2026-09-11": {
                "1. open": "100",
                "2. high": "102",
                "3. low": "99",
                "4. close": "101",
                "5. volume": "1500",
              },
              "2026-09-12": {
                "1. open": "101",
                "2. high": "103",
                "3. low": "100",
                "4. close": "102.5",
                "5. volume": "1800",
              },
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      })
    );
    try {
      const result = await fetchAlphaVantageDailySeries("IBM", 2);
      expect(result).toMatchObject({
        available: true,
        configured: true,
        source: "Alpha Vantage",
        realtime: false,
        delayStatus: "end_of_day",
        observedAt: "2026-09-12",
      });
      expect(result.history.at(-1)).toMatchObject({
        close: 102.5,
        volume: 1800,
      });
      expect(result.sourceUrl).not.toContain("test-only-alpha-key");
    } finally {
      vi.unstubAllGlobals();
      if (previous === undefined) delete process.env.ALPHA_VANTAGE_API_KEY;
      else process.env.ALPHA_VANTAGE_API_KEY = previous;
    }
  });
});
