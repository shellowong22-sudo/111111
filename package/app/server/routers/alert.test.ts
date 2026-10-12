import { describe, expect, it } from "vitest";
import { shouldTrigger } from "./alert";

describe("alert trigger condition", () => {
  it("在当前值达到或超过上行阈值时触发", () => {
    expect(shouldTrigger("price_above", 100, 100)).toBe(true);
    expect(shouldTrigger("var_above", 100, 101)).toBe(true);
    expect(shouldTrigger("return_above", 100, 99.99)).toBe(false);
  });

  it("在当前值达到或低于下行阈值时触发", () => {
    expect(shouldTrigger("price_below", 100, 100)).toBe(true);
    expect(shouldTrigger("volatility_below", 100, 99)).toBe(true);
    expect(shouldTrigger("var_below", 100, 100.01)).toBe(false);
  });

  it("拒绝非有限数值，避免产生无效告警事件", () => {
    expect(shouldTrigger("price_above", Number.NaN, 100)).toBe(false);
    expect(shouldTrigger("price_below", 100, Number.POSITIVE_INFINITY)).toBe(false);
  });
});

