import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getMunicipalCactSnapshot } from "./routers/municipalResearch";

describe("CACT municipal disclosure event contract", () => {
  it("returns a truthful empty boundary without a requested issuer", async () => {
    const snapshot = await getMunicipalCactSnapshot({ query: "", cik: null });
    expect(snapshot.dataContractId).toBe("municipal-cact-disclosure-events");
    expect(snapshot.dataStatus).toBe("restricted");
    expect(snapshot.observedAt).toBeNull();
    expect(snapshot.issuerMatches).toEqual([]);
    expect(snapshot.events).toEqual([]);
    expect(snapshot.epsObservations).toEqual([]);
    expect(JSON.stringify(snapshot)).not.toMatch(/https?:\/\/|sourceUrl/);
  });

  it("deduplicates a real issuer's filing and EPS periods at the cleaned boundary", async () => {
    const snapshot = await getMunicipalCactSnapshot({ query: "AAPL", cik: null });
    if (snapshot.dataStatus !== "available") return;
    const eventKeys = snapshot.events.map(
      event =>
        event.accessionNumber ??
        `${event.filingDate}|${event.form}|${event.primaryDocument}`
    );
    expect(new Set(eventKeys).size).toBe(eventKeys.length);
    const epsKeys = snapshot.epsObservations.map(
      observation => `${observation.periodEnd}|${observation.periodType}`
    );
    expect(new Set(epsKeys).size).toBe(epsKeys.length);
  });

  it("uses the dedicated municipal slice and retains both original views", () => {
    const source = readFileSync(
      new URL(
        "../client/src/components/MunicipalCACTPanel.tsx",
        import.meta.url
      ),
      "utf8"
    );
    expect(source).toContain("getMunicipalCactStatus");
    expect(source).not.toContain("stockMarketResearch");
    expect(source).not.toMatch(/useState\(["']AAPL["']\)/);
    expect(source).not.toMatch(/https?:\/\/|sourceUrl/);
    expect(source).toContain("事件日历");
    expect(source).toContain("财报意外");
    expect(source).toContain("一致预期 EPS");
    expect(source).toContain("刷新来源");
  });
});
