import { describe, expect, it } from "vitest";
import {
  MUNICIPAL_SOURCE_REGISTRY,
  parseSlgsDemandRate,
  parseSlgsSecurityRow,
  parseSlgsTimeRate,
} from "./routers/municipalResearch";

describe("municipalResearch official-source boundary", () => {
  it("parses published Treasury SLGS activity and every maturity bucket without fabricating values", () => {
    const row = parseSlgsSecurityRow({
      record_date: "2026-08-18",
      new_subscriptions_amt: "929540995.45",
      new_subscriptions_cnt: "22",
      cancelled_subscriptions_amt: "0.00",
      cancelled_subscriptions_cnt: "0",
      demand_deposit_redemptions_amt: "10378487.89",
      time_deposit_redemptions_amt: "57435321.00",
      issues_0_3_mos_amt: "89048913.00",
      issues_0_3_mos_cnt: "4",
      outstanding_0_3_mos_amt: "24538822174.95",
      outstanding_0_3_mos_cnt: "841",
      issues_3_6_mos_amt: "35433071.00",
      issues_3_6_mos_cnt: "1",
      outstanding_3_6_mos_amt: "11333788651.00",
      outstanding_3_6_mos_cnt: "258",
      issues_6_mos_to_2_yrs_amt: "11152629.00",
      issues_6_mos_to_2_yrs_cnt: "7",
      outstanding_6_mos_to_2_yrs_amt: "7700995027.00",
      outstanding_6_mos_to_2_yrs_cnt: "2078",
      issues_2_5_yrs_amt: "1202134.00",
      issues_2_5_yrs_cnt: "8",
      outstanding_2_5_yrs_amt: "22812300690.00",
      outstanding_2_5_yrs_cnt: "4593",
      issues_5_10_yrs_amt: "6424287.00",
      issues_5_10_yrs_cnt: "3",
      outstanding_5_10_yrs_amt: "7878619578.00",
      outstanding_5_10_yrs_cnt: "2400",
      issues_over_10_yrs_amt: "0.00",
      issues_over_10_yrs_cnt: "0",
      outstanding_over_10_yrs_amt: "2253995856.00",
      outstanding_over_10_yrs_cnt: "3090",
    });

    expect(row).toMatchObject({
      recordDate: "2026-08-18",
      newSubscriptionsAmount: 929540995.45,
      newSubscriptionsCount: 22,
    });
    expect(row?.buckets).toHaveLength(6);
    expect(row?.buckets.find(bucket => bucket.id === "0-3m")).toMatchObject({
      outstandingAmount: 24538822174.95,
      outstandingCount: 841,
    });
    expect(row?.buckets.find(bucket => bucket.id === "10y+")).toMatchObject({
      issuedAmount: 0,
      outstandingAmount: 2253995856,
    });
  });

  it("returns no activity when the official record date is absent", () => {
    expect(parseSlgsSecurityRow({ new_subscriptions_amt: "10" })).toBeNull();
  });

  it("keeps SLGS rate contracts separate from securities activity", () => {
    expect(
      parseSlgsDemandRate({
        record_date: "2026-09-18",
        annualized_effective_rate: "3.13",
        daily_factor: "0.000084442",
      })
    ).toEqual({
      recordDate: "2026-09-18",
      annualizedEffectiveRate: 3.13,
      dailyFactor: 0.000084442,
    });
    expect(
      parseSlgsTimeRate({
        record_date: "2026-09-18",
        from: "10-00",
        through: "ONLY",
        rate: "4.97",
      })
    ).toMatchObject({
      recordDate: "2026-09-18",
      monthsFrom: 120,
      monthsThrough: 120,
      rate: 4.97,
    });
    expect(
      parseSlgsTimeRate({
        record_date: "2026-09-18",
        from: "00-01",
        through: "ONLY",
        rate: "",
      })
    ).toBeNull();
  });

  it("does not expose third-party URLs in the public municipal source payload", () => {
    expect(
      MUNICIPAL_SOURCE_REGISTRY.find(
        source => source.id === "TREASURY-SLGS-RATES"
      )
    ).toMatchObject({ status: "probe", frequency: "日度" });
    const sourceKeys = Object.keys(MUNICIPAL_SOURCE_REGISTRY[0]);
    expect(sourceKeys).toContain("sourceUrl");
  });

  it("keeps unsubscribed MSRB as an internal unavailable state instead of presenting a synthetic quote feed", () => {
    const msrb = MUNICIPAL_SOURCE_REGISTRY.find(
      source => source.id === "MSRB-EMMA"
    );
    expect(msrb).toMatchObject({ status: "unavailable", sourceUrl: "" });
    expect(msrb?.scope).toContain("未订阅结构化成交资料");
    expect(msrb?.scope).toContain("不显示替代成交");
  });
});
