import { describe, expect, it } from "vitest";
import { getAkShareCatalog } from "./akshareMarketData";
import { routeAkShareCapability as routeCapability } from "./akshareCapabilityRouting";

describe("AKShare existing-module integration", () => {
  it("binds only to existing frontend module paths", () => {
    const catalog = getAkShareCatalog();
    expect(catalog).toHaveLength(23);
    expect(catalog.every(item => item.decision === "bind" && item.persisted)).toBe(true);
    expect(new Set(catalog.map(item => item.frontendEntry))).toEqual(new Set([
      "/terminal?open=eqs&module=stocks",
      "/index-hub?panel=WEI",
      "/menu-item/COMM",
      "/fund-browse",
      "/commodity-futures",
      "/moso",
      "/forex-hub",
      "/bond-market",
      "/news-hub?tab=top",
      "/econ-hub?tab=ecst",
    ]));
    expect(catalog.find(item => item.operation === "news_publication")?.frontendModule).toBe("news-top");
    expect(catalog.find(item => item.operation === "stock_directory")?.frontendEntry).toBe("/terminal?open=eqs&module=stocks");
    expect(catalog.find(item => item.operation === "futures_inventory")?.frontendEntry).toBe("/commodity-futures");
    expect(catalog.find(item => item.operation === "macro_japan_bank_rate")?.frontendModule).toBe("economic-ecst");
  });

  it("does not invent a route for an unknown operation", () => {
    expect(routeCapability("unknown_operation")).toBeNull();
  });
});
