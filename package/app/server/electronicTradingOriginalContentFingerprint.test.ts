import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const originals: Record<string, string> = {
  "client/src/pages/ElectronicTrading.tsx":
    "adf2bf8486db042ccfc133a3b316b3b1faa1b848b2ee8b6b4bb2c132b124b497",
  "client/src/components/electronic-trading/AgencyMBSPanel.tsx":
    "1a97c580ebfa4f0373362f52cdd3cb8d29e68ea25bdc5338c60eb960b6f8aa69",
  "client/src/components/electronic-trading/BBTMPanel.tsx":
    "4bf302c5817f2956a66aff50d5fa884a246363d2a79c3edc8294f2870f71dcd7",
  "client/src/components/electronic-trading/BLOTPanel.tsx":
    "cd84c9b5962e879563af1442fcadd1b9c94fbee196e6bf282284b9ebab682813",
  "client/src/components/electronic-trading/BOLTPanel.tsx":
    "e14130acf512e51b98e0e5acfb954247a8c7f48502561201b5a9e99479f595ca",
  "client/src/components/electronic-trading/BOOMPanel.tsx":
    "8c63a2f8a5aa30312dbde9a2ff646e6a47aff1dc10bc62b4bedce87a48d5d190",
  "client/src/components/electronic-trading/CDSPanel.tsx":
    "4ac13a7bc21777bd7063be27241780e37b8dae71b639c42f07a33c4b7e6d9cf2",
  "client/src/components/electronic-trading/CorporateBondPanel.tsx":
    "e867329862a3e4482aaffc4b3e2b21af76fe54ec240ef877d7caacb5f9b9ad70",
  "client/src/components/electronic-trading/EBNDPanel.tsx":
    "89e96cf10ced84dc14987cc5fa87c34adf1e3531c305559497695cd810e124a2",
  "client/src/components/electronic-trading/ETBTPanel.tsx":
    "3a3ea9241ed2b03006d744b486cfa8195f19d687b209e4ca2a45020444a29c61",
  "client/src/components/electronic-trading/EmergingMarketsPanel.tsx":
    "0431e0ac0da46b3c5980443abdb4c62732953a215d67e93651745bee2757b897",
  "client/src/components/electronic-trading/EquityTradingPanel.tsx":
    "fc7de1088701966db4aa5a3213a74e6cb828531b9bd78d81e8d4f2bfba9594d7",
  "client/src/components/electronic-trading/FITGPanel.tsx":
    "dac8776981e0572c40859187468bae25b66b15f3505ebca6170ca3777bcb7c98",
  "client/src/components/electronic-trading/FITPanel.tsx":
    "04acc0f35c37b5b9b5054f62f6b3b736080b7d2ca7ee847ff79200dbf318c54c",
  "client/src/components/electronic-trading/FXTradingPanel.tsx":
    "65186d085d387cd16c4ed6257d4ed24fd365d96367be7ff260fed91eaf0d4628",
  "client/src/components/electronic-trading/GovtBondQuotePanel.tsx":
    "da2d756e028defbf74e7ba19ec8236b4320fecca952f8c03e1a15866f6d314ca",
  "client/src/components/electronic-trading/IMGRMuniPanel.tsx":
    "23636d6c534404c9425efc756e13e8325528ca5bda3245877db42a591030a61d",
  "client/src/components/electronic-trading/IMGRPanel.tsx":
    "d2ca5afa405f5e85f7b3c69e760157ab8bba6f44b463d5ddb8d31aefb2f9015b",
  "client/src/components/electronic-trading/IRSwapPanel.tsx":
    "514c1dcd168f2c721bee4587e9cdf478c3034312a92c2a4e6b13efc5d06b678e",
  "client/src/components/electronic-trading/MBWDPanel.tsx":
    "8128038d30435d06122d60dfd40db4caf838a3dc3a606b0cec43b8595bfbfb3e",
  "client/src/components/electronic-trading/MIFIETPanel.tsx":
    "f6a2934f243de670a73cd82d397e3b52e315cb65cb514eb466f2fddb34ec1ab2",
  "client/src/components/electronic-trading/MoneyMarketPanel.tsx":
    "2495a83277038b1def196bd32634929038bdc410633619596700e7bd02a01322",
  "client/src/components/electronic-trading/MuniBondPanel.tsx":
    "e3ccaafb5753af6c41782022aa454d0d72dbe5a1fa904ef0c2e556711c2e362d",
  "client/src/components/electronic-trading/NOTCPanel.tsx":
    "28b7340c79b6c574abc53efd89e0fdbc94222bd71c42a32ca3e157e9f4ee6b05",
  "client/src/components/electronic-trading/PICKPanel.tsx":
    "e78d6bb0d6847876dcdb3b6e270ce78d49e85c4260a0da9d3c8eb8d2e677d278",
  "client/src/components/electronic-trading/PTBBPanel.tsx":
    "0f6673e347b4747de02a1fe34ddd2affe065c3b4d2f3b768ad302a86c9ce8bf7",
  "client/src/components/electronic-trading/SplitPane.tsx":
    "70fec2624e5869dd4a4f1513253d94f1eae7298cfbdb3887fd61b570303821ed",
  "client/src/components/electronic-trading/TRDEPanel.tsx":
    "c9fefe6ae87be3eead20902d1412b5f5c4591a1dfdac5bb88d2912f7a54b2826",
  "client/src/components/electronic-trading/TSOXPanel.tsx":
    "b7c2eb2ded212f5f3a64ad93da15170eebe6f56013ced5d5f89ed4fcbb41ce16",
  "client/src/components/electronic-trading/UACKPanel.tsx":
    "9d77ffaf3fe0f50c5a945c79f2b167315a2804c7338f6bb62cae81d09b2cc8f5",
  "client/src/components/electronic-trading/VCONPanel.tsx":
    "bef39b4cd078e0c68948e3f3e5da69a9820af48df79088230d1f38b7c39613f9",
  "client/src/components/electronic-trading/WATLPanel.tsx":
    "f5520cd1cbfa25901211120d45f935373f5b534191ebbb041f5acc2d36228ac0",
  "client/src/components/electronic-trading/WorkflowPanel.tsx":
    "6c09628a39c6e73e577096d347698c73be66150363202259bf5f6036c3a484a3",
};

describe("电子交易原入口与真实数据边界保护", () => {
  it("keeps the page and all 32 original panel files wired after data remediation", () => {
    const pagePath = "client/src/pages/ElectronicTrading.tsx";
    const page = readFileSync(resolve(process.cwd(), pagePath), "utf8");
    expect(page.length).toBeGreaterThan(1_000);
    for (const relativePath of Object.keys(originals)) {
      const source = readFileSync(resolve(process.cwd(), relativePath), "utf8");
      expect(source.length, relativePath).toBeGreaterThan(100);
      if (relativePath !== pagePath) {
        const componentName = basename(relativePath, ".tsx");
        expect(page, relativePath).toContain(componentName);
      }
    }
  });

  it("keeps BOOM source code as an explicit unavailable-data exception rather than displaying its simulated values", () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        "client/src/components/electronic-trading/BOOMPanel.tsx"
      ),
      "utf8"
    );
    expect(source).toContain(
      "generateMockOrders = useMemo(() => [] as Order[], [])"
    );
    expect(source).not.toContain("Math.random");
    expect(source).not.toContain(
      "Data simulated for demonstration purposes only"
    );
  });

  it("keeps MONEY tabs while isolating public observations from licensed trading data", () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        "client/src/components/electronic-trading/MoneyMarketPanel.tsx"
      ),
      "utf8"
    );
    for (const label of ["利率报价", "回购市场", "历史走势", "联邦基金"])
      expect(source).toContain(label);
    expect(source).not.toContain("freeMarketData.fredSeries");
    expect(source).not.toContain("bid: rate.rate");
    expect(source).not.toContain("ask: rate.rate");
    expect(source).not.toContain("counterparty: `${rate.instrument} 参考利率`");
    expect(source).toContain("const repo = useMemo<RepoData[]>(() => [], [])");
    expect(source).toContain("snapshotQuery.data?.sofrAverages");
    expect(source).toContain("snapshotQuery.data?.fedFundsHistory");
  });
});
