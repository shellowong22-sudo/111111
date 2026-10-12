import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("主权债第 23 项内部职责去重", () => {
  it("已完成拍卖只做需求与定价分析，未来排期由融资日历负责", () => {
    const issuance = readFileSync(`${root}/client/src/components/IssuancePanel.tsx`, "utf8");
    const calendar = readFileSync(`${root}/client/src/components/sovereign/SovereignFinancingCalendar.tsx`, "utf8");
    expect(issuance).toContain("已完成拍卖的需求与定价结果");
    expect(issuance).toContain("completedAuctions");
    expect(issuance).toContain("投标覆盖");
    expect(calendar).toContain("已公布的未来融资排期");
    expect(calendar).toContain("record.auctionDate >= futureWindow.from");
    expect(calendar).toContain("已完成场次的需求与定价结果请在");
  });

  it("第 23 项只挂载一个原面板，不再叠加第二套拍卖工作台", () => {
    const terminal = readFileSync(`${root}/client/src/pages/Terminal.tsx`, "utf8");
    expect(terminal).toContain("itemId === '23'");
    expect(terminal).toContain("<IssuancePanel onClose={c} />");
    expect(terminal).not.toContain("TreasuryAuctionLedgerDesk");
  });
});
