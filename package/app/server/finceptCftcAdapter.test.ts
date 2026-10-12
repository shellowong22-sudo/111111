import { describe, expect, it } from "vitest";
import { parseFinceptCftcDisaggregatedText } from "./finceptCftcAdapter";

describe("Fincept CFTC adapter", () => {
  it("parses selected official weekly rows and normalizes position fields", () => {
    const fields = Array.from({ length: 192 }, () => "");
    fields[0] = '"GOLD - COMEX"';
    fields[2] = "2026-09-22";
    fields[3] = "088691";
    fields[7] = "1000";
    fields[8] = "120";
    fields[9] = "80";
    fields[10] = "200";
    fields[11] = "100";
    fields[13] = "300";
    fields[14] = "350";
    fields[16] = "50";
    fields[17] = "20";
    fields[21] = "100";
    fields[22] = "50";
    const rows = parseFinceptCftcDisaggregatedText(fields.join(","));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      date: "2026-09-22",
      symbol: "CFTC:088691",
      value: 1000,
      fields: {
        contractName: "COMEX 黄金期货",
        producerNet: 40,
        swapNet: 100,
        managedMoneyNet: -50,
        otherReportNet: 30,
        nonReportableNet: 50,
      },
    });
  });

  it("filters unsupported contracts and duplicate report identities", () => {
    const base = Array.from({ length: 192 }, () => "");
    base[0] = '"GOLD - COMEX"';
    base[2] = "2026-09-22";
    base[3] = "088691";
    base[7] = "10";
    const duplicate = [...base];
    const unsupported = [...base];
    unsupported[3] = "999999";
    const rows = parseFinceptCftcDisaggregatedText([
      base.join(","),
      duplicate.join(","),
      unsupported.join(","),
    ].join("\n"));
    expect(rows).toHaveLength(1);
  });
});
