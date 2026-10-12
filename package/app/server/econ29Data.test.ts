import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const dataRouter = fs.readFileSync(path.join(root, "server/routers/econ29Data.ts"), "utf8");
const bridge = fs.readFileSync(path.join(root, "client/src/components/econ/EconOneToOneExtensionBridge.tsx"), "utf8");

describe("econ29 real-data contract", () => {
  it("dispatches every one-to-one extension ID through an explicit backend profile", () => {
    const ids = Array.from({ length: 29 }, (_, index) => String(index + 1).padStart(2, "0"));
    for (const id of ids) expect(dataRouter).toContain(`case "${id}":`);
    expect(dataRouter).toContain("readEcon29DataProfile");
    expect(bridge).toContain("trpc.econ29Data.getProfile.useMutation");
    expect(bridge).toContain("dataProfileMutation.mutateAsync");
  });

  it("keeps official SEP and PMI as source-specific contracts, not ZIP-value fallbacks", () => {
    expect(dataRouter).toContain("readLatestFedSep");
    expect(dataRouter).toContain("case \"20\": return sepProfile()");
    expect(dataRouter).toContain("readLatestUsManufacturingPmi");
    expect(dataRouter).toContain("case \"24\": return pmiProfile()");
    expect(bridge).toContain("SEP 官方可访问表");
    expect(bridge).toContain("S&P Global PMI 官方公开发布");
    expect(bridge).toContain("来源不可用");
  });

  it("routes the next release, material, document and freshness modules through different official-data paths", () => {
    expect(dataRouter).toContain("readLatestBlsMacroReleases");
    expect(dataRouter).toContain("blsReleaseTimingProfile(options)");
    expect(dataRouter).toContain("fedReleaseChainProfile()");
    expect(dataRouter).toContain("fedMaterialsWindowProfile()");
    expect(dataRouter).toContain('fedDocumentProfile("18", "minutes")');
    expect(dataRouter).toContain('fedDocumentProfile("19", "statement")');
    expect(dataRouter).toContain("sourceFreshnessProfile()");
    expect(dataRouter).toContain("inspectOfficialPolicyDocument");
    expect(dataRouter).toContain("deriveFedMinutesHtmlUrl");
    expect(bridge).toContain("BLS 发布时区与滞后");
    expect(bridge).toContain("FOMC 会议纪要原文证据");
    expect(bridge).toContain("多源官方发布时效簿");
  });
});
