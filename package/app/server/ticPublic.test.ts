import { describe, expect, it } from "vitest";
import { parseLatestTicReleaseUrl, parseTicRelease } from "./routers/ticPublic";

describe("Treasury TIC official release parsing", () => {
  it("discovers the newest Treasury press release URL from the official index", () => {
    expect(parseLatestTicReleaseUrl('<a href=/news/press-releases/sb0610/>Treasury Announces a policy</a><a href=/news/press-releases/sb0606/ hreflang=en>Treasury International Capital Data for June</a>')).toBe("https://home.treasury.gov/news/press-releases/sb0606/");
  });

  it("extracts observation month and published TIC flow components without proxy rates", () => {
    const data = parseTicRelease('August 17, 2026 Treasury International Capital (TIC) data for June 2026. net TIC inflow of $133.5 billion. net foreign private inflows were $85.0 billion, and net foreign official inflows were $48.4 billion. overall net foreign purchases of long-term securities are estimated to have been $172.7 billion.', "https://home.treasury.gov/news/press-releases/sb0606", "2026-08-26T00:00:00.000Z");
    expect(data).toMatchObject({ available: true, observationPeriod: "June 2026", netTicInflowBillions: 133.5, privateInflowBillions: 85, officialInflowBillions: 48.4, netLongTermPurchasesBillions: 172.7 });
  });
});
