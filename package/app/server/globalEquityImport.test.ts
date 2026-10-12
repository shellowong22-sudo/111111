import { describe, expect, it } from "vitest";
import {
  groupedCounts,
  listCandidateSheets,
  makeListings,
  selectUniqueSources,
} from "../scripts/import_global_equity_listings.mjs";

describe("全球股票清单导入映射", () => {
  it("保留上传工作簿中的国家、代码与名称，并仅合并同国同代码的完全重复行", () => {
    const sources = selectUniqueSources(listCandidateSheets());
    const { listings, duplicateRows } = makeListings(sources);

    expect(sources).toHaveLength(42);
    expect(listings).toHaveLength(48_756);
    expect(duplicateRows).toHaveLength(66);
    expect(new Set(listings.map((listing) => `${listing.countryCode}\u0000${listing.symbol}`)).size).toBe(listings.length);
    expect(listings.every((listing) => listing.symbol.length <= 32 && listing.name.length <= 128)).toBe(true);
    expect(groupedCounts(listings)).toMatchObject({
      中国: 5544,
      中国香港: 2763,
      美国: 6257,
      印度: 8170,
      日本: 3894,
      阿拉伯联合酋长国: 175,
    });
  });

  it("为逐国对账保留元数据行和重复行边界", () => {
    const sources = selectUniqueSources(listCandidateSheets());
    const { listings, duplicateRows } = makeListings(sources);
    const aeSources = sources.filter((source) => source.countryCode === "AE");
    const chinaSources = sources.filter((source) => source.countryCode === "CN");

    expect(sources.reduce((total, source) => total + source.invalidRows.length, 0)).toBe(42);
    expect(aeSources.reduce((total, source) => total + source.rows.length, 0)).toBe(240);
    expect(aeSources.reduce((total, source) => total + source.invalidRows.length, 0)).toBe(2);
    expect(duplicateRows.filter((row) => row.retained.countryCode === "AE")).toHaveLength(65);
    expect(chinaSources.reduce((total, source) => total + source.rows.length, 0)).toBe(5545);
    expect(duplicateRows.filter((row) => row.retained.countryCode === "CN")).toHaveLength(1);
    expect(listings.filter((listing) => listing.countryCode === "AE")).toHaveLength(175);
    expect(listings.filter((listing) => listing.countryCode === "CN")).toHaveLength(5544);
  });
});
