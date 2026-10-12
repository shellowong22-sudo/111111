import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { ECONOMIC_API_CONTRACTS } from '../shared/economicApiContracts';
import { WORLD_BANK_CONTRACTS } from '../shared/worldBankContracts';
import { ADMIN_DATA_MODULES } from '../shared/adminDataModules';
import {
  buildOpenBBApiCatalog,
  isOpenBBDuplicateKeyError,
  mergeHydratedOpenBBRuns,
  markOpenBBContractOnly,
  normalizeOpenBBResult,
  openBBDeliveryContentHash,
  OPENBB_ENDPOINTS,
  selectOpenBBAutomationEndpoints,
  summarizeOpenBBApiDocument,
  validateCatalogRequestBody,
  type OpenBBQueryRun,
} from "./openbbPriorityAService";

describe("OpenBB priority A data contract", () => {
  it("keeps the complete live OpenBB directory unique and on one canonical front-end shard", () => {
    const contractPath = path.join(
      process.cwd(),
      ".runtime",
      "openbb-admin",
      "live-openapi.json"
    );
    expect(
      existsSync(contractPath),
      "运行时 OpenAPI 合同缺失；须先完成 OpenBB 目录探测"
    ).toBe(true);
    const document = JSON.parse(readFileSync(contractPath, "utf8"));
    const catalog = buildOpenBBApiCatalog(document);

    expect(catalog).toMatchObject({
      pathCount: 193,
      operationCount: 193,
      controlledOperationCount: 193,
      controlledProxyOperationCount: 193,
      dedicatedAdapterCount: 14,
      dedicatedAdapterPercent: 7.25,
      contractOperationCount: 193,
      contractCoveragePercent: 100,
      coveragePercent: 100,
      methods: { GET: 189, POST: 4 },
    });

    const operationIds = catalog.operations.map(item => item.operationId);
    const dataContractIds = catalog.operations.map(item => item.dataContractId);
    const shardKeys = catalog.operations.map(item => item.shardKey);
    expect(new Set(operationIds).size).toBe(operationIds.length);
    expect(new Set(dataContractIds).size).toBe(dataContractIds.length);
    expect(new Set(shardKeys).size).toBe(shardKeys.length);

    for (const operation of catalog.operations) {
      expect(operation.dataContractId).toBe(
        `openbb.${operation.operationId}`
      );
      expect(operation.shardKey).toMatch(/^[^.]+\.[^.]+\.[^.]+$/);

      const sourceOperation =
        document.paths?.[operation.path]?.[operation.method.toLowerCase()];
      expect(sourceOperation, `${operation.id} 的原始请求合同缺失`).toBeTruthy();
      const sourceParameters = [
        ...(document.paths?.[operation.path]?.parameters ?? []),
        ...(sourceOperation?.parameters ?? []),
      ];
      expect(operation.parameters.map(item => [item.name, item.location])).toEqual(
        sourceParameters.map((item: any) => [item.name, item.in ?? "query"])
      );
      expect(operation.requestBodyRequired).toBe(
        Boolean(sourceOperation?.requestBody?.required)
      );

      const coverageOnly = operation.tags.includes("Coverage");
      if (coverageOnly) {
        expect(operation.primaryModuleId).toBeNull();
      } else if (operation.primaryModuleId) {
        expect(ADMIN_DATA_MODULES.some(module=>module.id===operation.primaryModuleId)).toBe(true);
      }

      if (operation.executionState.startsWith("restricted")) {
        expect(operation.blockReason).toEqual(expect.any(String));
        expect(operation.controlledEndpointId).toBeNull();
      } else {
        expect(operation.executionState).toBe("controlled_ready");
        expect(operation.blockReason).toBeNull();
        expect(operation.controlledEndpointId).toEqual(expect.any(String));
      }
    }
  });

  it("keeps all 193 cached contracts browseable but non-executable while the runtime is offline", () => {
    const contractPath = path.join(
      process.cwd(),
      ".runtime",
      "openbb-admin",
      "live-openapi.json"
    );
    const document = JSON.parse(readFileSync(contractPath, "utf8"));
    const cached = markOpenBBContractOnly(buildOpenBBApiCatalog(document));
    expect(cached).toMatchObject({
      pathCount: 193,
      operationCount: 193,
      controlledOperationCount: 0,
      controlledProxyOperationCount: 0,
      dedicatedAdapterCount: 0,
      dedicatedAdapterPercent: 0,
      contractOperationCount: 193,
      contractCoveragePercent: 100,
      coveragePercent: 0,
      stateCounts: {
        controlled_ready: 0,
        contract_only: 193,
      },
    });
    expect(cached.operations).toHaveLength(193);
    expect(cached.operations.every(item => item.executionState === "contract_only")).toBe(true);
    expect(cached.operations.every(item => item.controlledEndpointId === null)).toBe(true);
    expect(cached.operations.every(item => item.blockReason?.includes("禁止执行"))).toBe(true);
  });

  it("reports requested OpenBB asset classes separately from the API tag directory", () => {
    const contractPath = path.join(
      process.cwd(),
      ".runtime",
      "openbb-admin",
      "live-openapi.json"
    );
    const catalog = buildOpenBBApiCatalog(
      JSON.parse(readFileSync(contractPath, "utf8"))
    );
    const byId = new Map(catalog.assetClassSummary.map(item => [item.id, item]));
    expect(byId.get("news")).toMatchObject({ operationCount: 2, runtimeExposure: "available" });
    expect(byId.get("indices")).toMatchObject({ operationCount: 3, runtimeExposure: "available" });
    expect(byId.get("crypto")).toMatchObject({ operationCount: 2, runtimeExposure: "available" });
    expect(byId.get("commodities")).toMatchObject({ operationCount: 7, runtimeExposure: "available" });
    expect(byId.get("bonds")).toMatchObject({ operationCount: 24, runtimeExposure: "available" });
    expect(byId.get("forex")).toMatchObject({ operationCount: 3, runtimeExposure: "available" });
    expect(byId.get("etf")).toMatchObject({ operationCount: 9, runtimeExposure: "available" });
    expect(byId.get("futures")).toMatchObject({ operationCount: 2, runtimeExposure: "available" });
    expect(byId.get("options")).toMatchObject({ operationCount: 4, runtimeExposure: "available" });
    expect(byId.get("funds")).toMatchObject({
      operationCount: 0,
      runtimeExposure: "not_exposed",
    });
  });

  it("exposes unique allow-listed endpoints without executable input", () => {
    expect(OPENBB_ENDPOINTS).toHaveLength(14+ECONOMIC_API_CONTRACTS.length+WORLD_BANK_CONTRACTS.length);
    expect(new Set(OPENBB_ENDPOINTS.map(item => item.id)).size).toBe(
      OPENBB_ENDPOINTS.length
    );
    for (const endpoint of OPENBB_ENDPOINTS) {
      const dedicated = ECONOMIC_API_CONTRACTS.find(contract => contract.id === endpoint.id);
      if (dedicated) expect(endpoint.path).toBe(dedicated.endpoint);
      else expect(endpoint.path).toMatch(/^(\/api\/v1\/|https:\/\/api.worldbank.org\/v2\/)/);
      expect(endpoint.allowed).not.toContain("code");
      expect(endpoint.allowed).not.toContain("script");
      expect(endpoint.suggestedModuleIds.length).toBeGreaterThan(0);
    }
  });

  it("selects a bounded stale automatic batch and cools down recent attempts", () => {
    const now = Date.parse("2026-09-23T08:00:00.000Z");
    const first = OPENBB_ENDPOINTS.find(item => item.id === "equity_price_historical")!;
    const second = OPENBB_ENDPOINTS.find(item => item.id === "equity_price_quote")!;
    const recent = [{
      runId: "obbrun_recent",
      status: "succeeded",
      endpointId: first.id,
      params: first.defaults,
      primaryModuleId: first.suggestedModuleIds[0],
      createdAt: "2026-09-23T07:55:00.000Z",
      startedAt: "2026-09-23T07:55:00.000Z",
      completedAt: "2026-09-23T07:55:10.000Z",
      actorUserId: 1,
      command: "scheduled",
      error: null,
      logs: [],
      result: null,
      push: null,
    }] as OpenBBQueryRun[];
    const selected = selectOpenBBAutomationEndpoints(recent, now, 2);
    expect(selected).toHaveLength(2);
    expect(selected.map(item => item.id)).not.toContain(first.id);
    expect(selected.map(item => item.id)).toContain(second.id);
    expect(selected.every(item => item.required.every(key => item.defaults[key] !== undefined))).toBe(true);
  });

  it("normalizes provider rows and preserves source evidence", () => {
    const endpoint = OPENBB_ENDPOINTS.find(
      item => item.id === "equity_price_historical"
    )!;
    const result = normalizeOpenBBResult(
      endpoint,
      { symbol: "AAPL", provider: "yfinance" },
      {
        provider: "yfinance",
        results: [
          {
            date: "2026-09-16",
            open: 231.1,
            high: 235.2,
            low: 229.8,
            close: 234.7,
            volume: 123456,
          },
          {
            date: "2026-09-17",
            open: 234.7,
            high: 236.8,
            low: 232.4,
            close: 235.9,
            volume: 111222,
          },
        ],
      }
    );
    expect(result.metadata).toMatchObject({
      provider: "yfinance",
      rowCount: 2,
      quality: "provider_response",
      observedAt: "2026-09-17",
    });
    expect(result.columns).toEqual([
      "date",
      "open",
      "high",
      "low",
      "close",
      "volume",
    ]);
    expect(result.fields).toEqual([
      {
        fieldId: "date",
        dataType: "date",
        role: "time",
        nonNullCount: 2,
        nullCount: 0,
      },
      {
        fieldId: "open",
        dataType: "number",
        role: "measure",
        nonNullCount: 2,
        nullCount: 0,
      },
      {
        fieldId: "high",
        dataType: "number",
        role: "measure",
        nonNullCount: 2,
        nullCount: 0,
      },
      {
        fieldId: "low",
        dataType: "number",
        role: "measure",
        nonNullCount: 2,
        nullCount: 0,
      },
      {
        fieldId: "close",
        dataType: "number",
        role: "measure",
        nonNullCount: 2,
        nullCount: 0,
      },
      {
        fieldId: "volume",
        dataType: "number",
        role: "measure",
        nonNullCount: 2,
        nullCount: 0,
      },
    ]);
    expect(result.metadata).toMatchObject({
      rangeStart: "2026-09-16",
      rangeEnd: "2026-09-17",
      numericFieldCount: 5,
      nullCellCount: 0,
      nullRate: 0,
    });
    expect(result.rows[1].close).toBe(235.9);
    expect(result.metadata.checksum).toMatch(/^[a-f0-9]{64}$/);
  });

  it("selects the latest provider observation even when rows are not ordered", () => {
    const endpoint = OPENBB_ENDPOINTS.find(
      item => item.id === "treasury_rates"
    )!;
    const result = normalizeOpenBBResult(endpoint, endpoint.defaults, {
      provider: "federal_reserve",
      results: [
        { date: "2026-07-07", year_10: 0.0455 },
        { date: "2025-09-17", year_10: 0.0406 },
        { date: "2026-01-02", year_10: 0.0419 },
      ],
    });
    expect(result.metadata.observedAt).toBe("2026-07-07");
  });

  it("marks empty provider responses without manufacturing rows", () => {
    const endpoint = OPENBB_ENDPOINTS[0];
    const result = normalizeOpenBBResult(endpoint, endpoint.defaults, {
      provider: "test",
      results: [],
    });
    expect(result.rows).toEqual([]);
    expect(result.metadata).toMatchObject({
      rowCount: 0,
      quality: "empty_response",
    });
  });

  it("registers credential-free SEC and OECD depth endpoints in the existing workspace", () => {
    expect(
      OPENBB_ENDPOINTS.filter(item => item.defaults.provider === "sec").map(
        item => item.id
      )
    ).toEqual([
      "equity_income_statement",
      "equity_balance_sheet",
      "equity_cash_flow",
    ]);
    expect(
      OPENBB_ENDPOINTS.filter(item => item.defaults.provider === "oecd").map(
        item => item.id
      )
    ).toEqual(["economy_cpi", "economy_real_gdp", "economy_unemployment"]);
  });

  it("measures null cells from the provider response instead of filling them", () => {
    const endpoint = OPENBB_ENDPOINTS.find(
      item => item.id === "economy_real_gdp"
    )!;
    const result = normalizeOpenBBResult(endpoint, endpoint.defaults, {
      provider: "oecd",
      results: [
        { date: "2026-01-01", value: 100, revision: null },
        { date: "2026-04-01", value: null, revision: "preliminary" },
      ],
    });
    expect(
      result.fields.find(field => field.fieldId === "value")
    ).toMatchObject({ dataType: "number", nonNullCount: 1, nullCount: 1 });
    expect(result.metadata).toMatchObject({
      nullCellCount: 2,
      nullRate: 0.333333,
    });
    expect(result.rows[1].value).toBeNull();
  });

  it("caps oversized result sets and records truncation", () => {
    const endpoint = OPENBB_ENDPOINTS[0];
    const result = normalizeOpenBBResult(endpoint, endpoint.defaults, {
      results: Array.from({ length: 540 }, (_, index) => ({ index })),
    });
    expect(result.rows).toHaveLength(500);
    expect(result.metadata).toMatchObject({ rowCount: 540, truncated: true });
  });

  it("deduplicates only the same dataset, module and recipient audience", () => {
    const first = openBBDeliveryContentHash(
      "yield-curve",
      "dataset-checksum",
      [4110001, 7, 4110001]
    );
    const reordered = openBBDeliveryContentHash(
      "yield-curve",
      "dataset-checksum",
      [7, 4110001]
    );
    const differentAudience = openBBDeliveryContentHash(
      "yield-curve",
      "dataset-checksum",
      [8, 4110001]
    );
    expect(first).toBe(reordered);
    expect(differentAudience).not.toBe(first);
  });

  it("treats concurrent MySQL unique-index collisions as idempotent duplicate delivery", () => {
    expect(
      isOpenBBDuplicateKeyError({
        code: "ER_DUP_ENTRY",
        errno: 1062,
        message: "Duplicate entry",
      })
    ).toBe(true);
    expect(isOpenBBDuplicateKeyError({ errno: 1062 })).toBe(true);
    expect(
      isOpenBBDuplicateKeyError(
        new Error("Duplicate entry for key admin_mod_content_dedupe_uq")
      )
    ).toBe(true);
    expect(isOpenBBDuplicateKeyError(new Error("ECONNRESET"))).toBe(false);
  });

  it("persists the hydrated front-end ACK without replacing duplicate-attempt audit evidence", () => {
    const stored = {
      runId: "obbrun_test",
      push: {
        pushId: "obbpush_original",
        status: "waiting_front_ack",
        successCount: 0,
        pendingCount: 2,
      },
      lastPushAttempt: {
        pushId: "obbpush_duplicate",
        status: "duplicate_blocked",
        duplicateOfPushIds: ["obbpush_original"],
      },
    } as unknown as OpenBBQueryRun;
    const hydrated = {
      ...stored,
      push: {
        ...stored.push!,
        status: "front_acknowledged",
        successCount: 2,
        pendingCount: 0,
      },
    } as OpenBBQueryRun;
    const merged = mergeHydratedOpenBBRuns([stored], [hydrated]);
    expect(merged.changed).toBe(true);
    expect(merged.runs[0].push).toMatchObject({
      pushId: "obbpush_original",
      status: "front_acknowledged",
      successCount: 2,
      pendingCount: 0,
    });
    expect(merged.runs[0].lastPushAttempt).toEqual(stored.lastPushAttempt);
    expect(mergeHydratedOpenBBRuns(merged.runs, [hydrated]).changed).toBe(
      false
    );
  });

  it("summarizes the real OpenAPI document without retaining executable definitions", () => {
    const summary = summarizeOpenBBApiDocument({
      info: { title: "OpenBB Platform API", version: "1.2.3" },
      tags: [{ name: "equity" }, { name: "equity" }, { name: "fixedincome" }],
      paths: {
        "/api/v1/equity/price/historical": {
          get: { operationId: "equity_history" },
        },
        "/api/v1/fixedincome/government/treasury_rates": {
          get: { operationId: "treasury_rates" },
        },
      },
    });
    expect(summary).toEqual({
      title: "OpenBB Platform API",
      version: "1.2.3",
      pathCount: 2,
      tagCount: 2,
      pathSample: [
        "/api/v1/equity/price/historical",
        "/api/v1/fixedincome/government/treasury_rates",
      ],
    });
    expect(summary).not.toHaveProperty("paths");
  });

  it("builds a complete operation catalog and enables every contracted GET endpoint", () => {
    const catalog = buildOpenBBApiCatalog({
      info: { title: "OpenBB Platform API", version: "1" },
      tags: [{ name: "equity" }, { name: "commodity" }],
      paths: {
        "/api/v1/equity/price/historical": {
          get: {
            operationId: "equity_price_historical",
            summary: "Historical",
            tags: ["equity"],
            parameters: [
              {
                name: "symbol",
                in: "query",
                required: true,
                schema: { type: "string" },
              },
            ],
            responses: {
              200: {
                content: {
                  "application/json": {
                    schema: { $ref: "#/components/schemas/EquityHistorical" },
                  },
                },
              },
            },
          },
        },
        "/api/v1/equity/search": {
          get: {
            operationId: "equity_search",
            summary: "Search",
            tags: ["equity"],
            parameters: [],
            responses: { 200: { description: "OK" } },
          },
        },
        "/api/v1/commodity/weather_bulletins_download": {
          post: {
            operationId: "commodity_weather_bulletins_download",
            summary: "Download",
            tags: ["commodity"],
            requestBody: { required: true },
            responses: { 200: { description: "OK" } },
          },
        },
      },
    });
    expect(catalog).toMatchObject({
      pathCount: 3,
      operationCount: 3,
      declaredTagCount: 2,
      controlledOperationCount: 3,
      controlledProxyOperationCount: 3,
      dedicatedAdapterCount: 1,
      dedicatedAdapterPercent: 33.33,
      contractOperationCount: 3,
      contractCoveragePercent: 100,
      coveragePercent: 100,
      methods: { GET: 2, POST: 1 },
      stateCounts: {
        controlled_ready: 3,
        contract_only: 0,
        restricted_write: 0,
        restricted_system: 0,
      },
    });
    expect(
      catalog.operations.find(
        item => item.operationId === "equity_price_historical"
      )
    ).toMatchObject({
      executionState: "controlled_ready",
      controlledEndpointId: "equity_price_historical",
      responseSchema: "EquityHistorical",
    });
    expect(
      catalog.operations.find(item => item.operationId === "equity_search")
    ).toMatchObject({
      executionState: "controlled_ready",
      controlledEndpointId: "equity_search",
      primaryModuleId: "stock-eqs",
      shardKey: "equity.search.root",
      dataContractId: "openbb.equity_search",
    });
    expect(
      catalog.operations.find(
        item => item.operationId === "commodity_weather_bulletins_download"
      )
    ).toMatchObject({
      method: "POST",
      executionState: "controlled_ready",
      requestBodyRequired: true,
      requestBodyType: null,
    });
  });

  it("executes only allow-listed data POST contracts and rejects arbitrary POST routes", () => {
    const catalog = buildOpenBBApiCatalog({
      paths: {
        "/api/v1/uscongress/bill_text": {
          post: {
            operationId: "congress_gov_router_bill_text",
            tags: ["uscongress"],
            requestBody: {
              content: {
                "application/json": {
                  schema: { type: "array", items: { type: "string" } },
                },
              },
            },
            responses: { 200: { description: "OK" } },
          },
        },
        "/api/v1/equity/arbitrary_write": {
          post: {
            operationId: "equity_arbitrary_write",
            tags: ["equity"],
            responses: { 200: { description: "OK" } },
          },
        },
      },
    });
    expect(catalog.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          operationId: "congress_gov_router_bill_text",
          executionState: "controlled_ready",
          primaryModuleId: "news-hub",
        }),
        expect.objectContaining({
          operationId: "equity_arbitrary_write",
          executionState: "restricted_write",
        }),
      ])
    );
  });

  it("validates approved document URLs and blocks POST request SSRF targets", () => {
    const operation = buildOpenBBApiCatalog({
      paths: {
        "/api/v1/uscongress/bill_text": {
          post: {
            operationId: "congress_gov_router_bill_text",
            tags: ["uscongress"],
            requestBody: { required: true },
            responses: { 200: { description: "OK" } },
          },
        },
      },
    }).operations[0];
    expect(
      validateCatalogRequestBody(operation, {
        urls: ["https://www.congress.gov/119/bills/hr1/BILLS-119hr1eh.pdf"],
      })
    ).toEqual([
      "https://www.congress.gov/119/bills/hr1/BILLS-119hr1eh.pdf",
    ]);
    expect(() =>
      validateCatalogRequestBody(operation, {
        urls: ["http://127.0.0.1/private"],
      })
    ).toThrow("OPENBB_REQUEST_URL_HTTPS_ONLY");
    expect(() =>
      validateCatalogRequestBody(operation, {
        urls: ["https://example.com/document.pdf"],
      })
    ).toThrow("OPENBB_REQUEST_URL_DOMAIN_NOT_ALLOWED");
  });
});
