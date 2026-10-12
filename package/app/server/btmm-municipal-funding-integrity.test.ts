import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getMunicipalBtmmSnapshot } from "./routers/municipalResearch";

describe("BTMM municipal short-funding contract", () => {
  it("returns a dedicated, deduplicated and URL-free cleaned contract", async () => {
    const snapshot = await getMunicipalBtmmSnapshot();
    expect(snapshot.dataContractId).toBe("municipal-btmm-short-funding");
    for (const rate of Object.values(snapshot.rates)) {
      const dates = rate.observations.map(point => point.date);
      expect(new Set(dates).size).toBe(dates.length);
    }
    expect(JSON.stringify(snapshot)).not.toMatch(/https?:\/\/|sourceUrl/);
  });

  it("keeps the original views on a municipal-only component", () => {
    const terminal = readFileSync(
      new URL("../client/src/pages/Terminal.tsx", import.meta.url),
      "utf8"
    );
    const component = readFileSync(
      new URL("../client/src/components/MunicipalBTMMPanel.tsx", import.meta.url),
      "utf8"
    );
    expect(terminal).toMatch(
      /BTMM:\s*\{[\s\S]*?<MunicipalBTMMPanel[\s\S]*?lb-BTMM/
    );
    expect(component).toContain("getMunicipalBtmmStatus");
    expect(component).not.toContain("sovereignBonds");
    expect(component).toContain("融资参考");
    expect(component).toContain("短端期限结构");
    expect(component).toContain("抵押与交收核验");
    expect(component).not.toMatch(/Math\.random|https?:\/\/|sourceUrl/);
  });
});
