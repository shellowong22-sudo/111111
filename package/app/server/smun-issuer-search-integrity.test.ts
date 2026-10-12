import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getSmunIssuerSearchSnapshot } from "./routers/municipalResearch";

describe("SMUN issuer search unique contract", () => {
  it("keeps issuer and city health slices restricted", () => {
    const snapshot = getSmunIssuerSearchSnapshot();
    expect(snapshot.dataContractId).toBe("municipal-smun-issuer-search");
    expect(snapshot.dataStatus).toBe("restricted");
    expect(snapshot.observedAt).toBeNull();
    expect(snapshot.issuers).toEqual([]);
    expect(snapshot.creditHistory).toEqual([]);
    expect(snapshot.debtService).toEqual([]);
    expect(snapshot.cityHealth).toEqual([]);
    expect(snapshot.debtTaxCreditSpread).toEqual([]);
    expect(snapshot.limitation).toContain(
      "不复用 CDRA 评级、MCAL 发行、MBIX 指数、DEAL 成交"
    );
    expect(JSON.stringify(snapshot)).not.toMatch(/https?:\/\//);
  });

  it("removes fixed issuer samples and generated recommendations", () => {
    const source = readFileSync(
      new URL("../client/src/components/SMUNPanel.tsx", import.meta.url),
      "utf8"
    );
    expect(source).not.toMatch(
      /const ISSUERS|const CREDIT_HISTORY|const DEBT_SERVICE_DATA|CITY_HEALTH_DATA|DEBT_TAX_CREDIT_SPREAD_DATA/
    );
    expect(source).not.toMatch(
      /CA-GO|NYC-GO|TX-GO|IL-GO|39538222|89540|AI 智能信用风险评估|建议超配|建议低配|Math\.random|https?:\/\//
    );
    for (const label of [
      "财务档案",
      "健康雷达",
      "债务结构",
      "横向对比",
      "财务健康度",
      "债务负担",
      "税收分析",
    ]) {
      expect(source).toContain(label);
    }
  });
});
