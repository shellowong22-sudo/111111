import { describe, expect, it } from "vitest";
import { parseLatestUsManufacturingLink, parseUsManufacturingRelease } from "./routers/pmiPublic";

describe("pmiPublic official-release parsing", () => {
  it("finds the newest non-flash US manufacturing release from the official directory context", () => {
    const html = `<div>August 3 2026 13:45 UTC S&P Global US Manufacturing PMI <a href="/Public/Home/PressRelease/official-id">View More</a></div>`;
    expect(parseLatestUsManufacturingLink(html)).toEqual({
      url: "https://www.pmi.spglobal.com/Public/Home/PressRelease/official-id",
      releasedAt: "2026-08-03T13:45:00.000Z",
    });
  });

  it("extracts only the published headline value, stated prior value, period, and embargo time", () => {
    const html = `
      <h1>S&P Global US Manufacturing PMI</h1>
      <p>News Release Embargoed until 0945 EDT 3 August 2026 / 1345 UTC 3 August 2026</p>
      <p>The headline seasonally adjusted S&P Global US Manufacturing Purchasing Managers’ Index™ (PMI®) recorded 53.9 in July. The reading was unchanged from June.</p>
    `;
    expect(parseUsManufacturingRelease(html)).toMatchObject({
      currentValue: 53.9,
      previousValue: null,
      observationPeriod: "July",
      publicationAt: "2026-08-03T13:45:00.000Z",
    });
  });

  it("uses the explicit from-to wording when the official release provides a prior value", () => {
    const html = `<p>The headline PMI rose from 51.2 in May to 52.7 in June.</p>`;
    expect(parseUsManufacturingRelease(html)).toMatchObject({ currentValue: 52.7, previousValue: 51.2, observationPeriod: "June" });
  });
});
