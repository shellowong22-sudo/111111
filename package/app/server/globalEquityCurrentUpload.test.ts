import { describe, expect, it } from "vitest";
import {
  groupedCounts,
  listCandidateSheets,
  makeListings,
  selectUniqueSources,
} from "../scripts/import_global_equity_listings.mjs";

describe("当前上传全球股票工作簿导入", () => {
  it("保留当前用户上传的国家来源、名称和同国同代码去重边界", () => {
    const sources = selectUniqueSources(listCandidateSheets());
    const { listings, duplicateRows } = makeListings(sources);
    const counts = groupedCounts(listings);

    expect(sources).toHaveLength(42);
    expect(listings).toHaveLength(48_756);
    expect(duplicateRows).toHaveLength(66);
    expect(new Set(listings.map((listing) => `${listing.countryCode}\u0000${listing.symbol}`)).size).toBe(listings.length);
    expect(counts).toMatchObject({ 美国: 6257, 中国台湾: 2373, 韩国: 2967, 中国: 5544, 印度: 8170, 日本: 3894 });
  });
});
