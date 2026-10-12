import { describe, expect, it } from "vitest";
import { parseLatestSepUrl, parseSepTable } from "./routers/fedSepPublic";

describe("fedSepPublic accessible-material parsing", () => {
  it("selects the newest accessible SEP material referenced by the official FOMC calendar", () => {
    const html = `<a href="/monetarypolicy/fomcprojtabl20250319.htm">March</a><a href="/monetarypolicy/fomcprojtabl20260617.htm">June</a>`;
    expect(parseLatestSepUrl(html)).toEqual({ url: "https://www.federalreserve.gov/monetarypolicy/fomcprojtabl20260617.htm", date: "20260617" });
  });

  it("extracts Table 1 medians and all-participant ranges without inferring participant dots", () => {
    const html = `<table><tr><th>Change in real GDP</th><td>2.2</td><td>2.3</td><td>2.2</td><td>2.0</td><td>2.0–2.3</td><td>2.0–2.4</td><td>2.0–2.3</td><td>1.8–2.0</td><td>1.8–2.6</td><td>1.9–2.9</td><td>1.8–2.6</td><td>1.7–2.5</td></tr><tr><th>Unemployment rate</th><td>4.3</td><td>4.3</td><td>4.2</td><td>4.2</td><td>4.3–4.4</td><td>4.2–4.5</td><td>4.1–4.3</td><td>4.0–4.3</td><td>4.3–4.6</td><td>4.0–4.6</td><td>4.0–4.4</td><td>3.8–4.5</td></tr><tr><th>PCE inflation</th><td>3.6</td><td>2.3</td><td>2.0</td><td>2.0</td><td>3.5–3.7</td><td>2.2–2.5</td><td>2.0–2.1</td><td>2.0</td><td>2.7–4.1</td><td>1.9–2.8</td><td>2.0–2.3</td><td>2.0</td></tr><tr><th>Federal funds rate</th><td>3.8</td><td>3.6</td><td>3.4</td><td>3.1</td><td>3.6–4.1</td><td>3.1–3.9</td><td>3.1–3.6</td><td>3.0–3.5</td><td>3.4–4.4</td><td>2.9–4.4</td><td>2.9–3.9</td><td>2.9–3.9</td></tr></table>`;
    const rows = parseSepTable(html);
    expect(rows).toHaveLength(4);
    expect(rows.find((row) => row.variable === "Change in real GDP")).toMatchObject({ medians: { "2026": 2.2 }, ranges: { "2026": "1.8–2.6" } });
    expect(rows.find((row) => row.variable === "Federal funds rate")).toMatchObject({ medians: { "2027": 3.6 }, ranges: { "2027": "2.9–4.4" } });
  });
});
