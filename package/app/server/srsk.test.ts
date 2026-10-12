import { describe, expect, it } from "vitest";
import {
  RESERVE_ROWS,
  NON_RESERVE_ROWS,
  ALL_ROWS,
  COUNTRY_DETAILS,
  deriveDetail,
  buildHistory,
  cdsDiff,
} from "../client/src/lib/srskData";

describe("SRSK 主权债信用风险数据", () => {
  it("主表分组行数与截图一致（储备10 + 非储备10 = 20）", () => {
    expect(RESERVE_ROWS).toHaveLength(10);
    expect(NON_RESERVE_ROWS).toHaveLength(10);
    expect(ALL_ROWS).toHaveLength(20);
  });

  it("每行 lo <= cur 范围合理，model 为正整数", () => {
    for (const r of ALL_ROWS) {
      expect(r.lo).toBeLessThanOrEqual(r.hi);
      expect(r.model).toBeGreaterThan(0);
      expect(Number.isFinite(r.cur)).toBe(true);
    }
  });

  it("cdsDiff = 模型 - 市场；无市场报价时为 null", () => {
    const spain = ALL_ROWS.find(r => r.name === "西班牙")!;
    expect(cdsDiff(spain)).toBe(spain.model - (spain.market as number)); // 34 - 16 = 18
    const venezuela = ALL_ROWS.find(r => r.name === "委内瑞拉")!;
    expect(venezuela.market).toBeNull();
    expect(cdsDiff(venezuela)).toBeNull();
  });

  it("西班牙详情使用截图显式数据（非派生）", () => {
    const spain = ALL_ROWS.find(r => r.name === "西班牙")!;
    const d = deriveDetail(spain);
    expect(d).toBe(COUNTRY_DETAILS["西班牙"]);
    expect(d.ig).toBe("IG6");
    expect(d.inflation).toBeCloseTo(2.867, 3);
    expect(d.political).toBe(72);
  });

  it("无显式详情的国家派生合理：评级随违约概率分级，且字段齐全", () => {
    const venezuela = ALL_ROWS.find(r => r.name === "委内瑞拉")!; // cur 91.78
    const d = deriveDetail(venezuela);
    expect(d.ig).toBe("HY4");
    expect(d.dp).toBe(venezuela.cur);
    expect(d.political).toBeGreaterThanOrEqual(20);
    expect(d.news.length).toBeGreaterThan(0);

    const portugal = ALL_ROWS.find(r => r.name === "葡萄牙")!; // cur 0.21 -> IG6
    expect(deriveDetail(portugal).ig).toBe("IG6");
  });

  it("历史曲线确定性：同一国家两次构建结果一致，且点数=24、值为正", () => {
    const d = deriveDetail(ALL_ROWS.find(r => r.name === "土耳其")!);
    const h1 = buildHistory(d);
    const h2 = buildHistory(d);
    expect(h1).toEqual(h2);
    expect(h1).toHaveLength(24);
    for (const p of h1) {
      expect(p.dp).toBeGreaterThan(0);
      expect(p.inflation).toBeGreaterThan(0);
    }
  });

  it("不同国家历史曲线不相同", () => {
    const a = buildHistory(deriveDetail(ALL_ROWS.find(r => r.name === "希腊")!));
    const b = buildHistory(deriveDetail(ALL_ROWS.find(r => r.name === "葡萄牙")!));
    expect(a).not.toEqual(b);
  });
});
