// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { setLocation } = vi.hoisted(() => ({ setLocation: vi.fn() }));

vi.mock("wouter", () => ({
  useLocation: () => ["/", setLocation],
}));

import { PricingRiskMenu } from "../client/src/components/PricingRiskMenu";

vi.stubGlobal("React", React);

const entries = [
  ["ANN", "announce"], ["DASH", "dashboard"], ["ASST", "asset-class"], ["LIVE", "realtime"],
  ["STAT", "static-data"], ["YLD", "yield-curve"], ["VOL", "vol-surface"], ["VAL", "valuation"],
  ["GRK", "greeks"], ["VaR", "var"], ["STR", "stress"], ["PnL", "pnl"], ["CVA", "cva"],
  ["LIQ", "liquidity"], ["CAP", "capital"], ["WIF", "whatif"], ["COR", "correlation"],
  ["TAIL", "tail-risk"], ["BKT", "backtest"], ["ALT", "alert"], ["DEC", "decision"],
  ["AUD", "audit"], ["INT", "integration"],
] as const;

describe("PricingRiskMenu", () => {
  it("保留全部 23 个原始入口，并将每一项路由至对应的 tab 参数", () => {
    const onClose = vi.fn();
    render(<PricingRiskMenu onClose={onClose} />);

    entries.forEach(([code, tabKey], index) => {
      fireEvent.click(screen.getByText(code, { exact: true }));
      expect(setLocation).toHaveBeenLastCalledWith(`/pricing-risk?tab=${tabKey}`);
      expect(onClose).toHaveBeenCalledTimes(index + 1);
    });
  });
});
