// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PortfolioManagementMenu } from "../client/src/components/PortfolioManagementMenu";

vi.stubGlobal("React", React);

const entries = [
  ["SYS", "sys"], ["PRTU", "prtu"], ["BBU", "bbu"], ["PORT", "port"],
  ["PORT IP", "portip"], ["PDSP", "pdsp"], ["PORT TE", "portte"], ["PORT VR", "portvr"],
  ["PORT SA", "portsa"], ["PORT HD", "porthd"], ["PORT CH", "portch"], ["PORT HP", "porthp"],
  ["PORT PA", "portpa"], ["PORT TS", "portts"], ["PORT OP", "portop"], ["NL", "nl"],
  ["EVTS", "evts"], ["PREP", "prep"], ["MIFI", "mifi"], ["ALRT", "alert"],
  ["DRPT", "report"], ["AUDT", "audit"], ["INTG", "integ"], ["BOND RISK", "bondrisk"],
] as const;

describe("PortfolioManagementMenu", () => {
  it("保留全部 24 个原始功能码，并将每一项传递到对应工作区", () => {
    const onClose = vi.fn();
    const onOpenTab = vi.fn();
    render(<PortfolioManagementMenu onClose={onClose} onOpenTab={onOpenTab} />);

    entries.forEach(([code, tabId], index) => {
      fireEvent.click(screen.getByText(code, { exact: true }));
      expect(onOpenTab).toHaveBeenLastCalledWith(tabId);
      expect(onClose).toHaveBeenCalledTimes(index + 1);
    });
  });
});
