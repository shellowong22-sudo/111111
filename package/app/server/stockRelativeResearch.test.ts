import { describe, it, expect } from "vitest";
import {
  compareEtfPrices,
  environmentRelationMatrix,
} from "../client/src/components/stock/stockRelativeResearch";

const points = (values: number[]) =>
  values.map((value, index) => ({
    date: `2026-09-${String(index + 1).padStart(2, "0")}`,
    value,
  }));
describe("ETF price-relative research", () => {
  it("compares normalized traded-price paths, not NAV or arithmetic return ratios", () => {
    const result = compareEtfPrices(
      points([100, 110, 121]),
      points([200, 220, 220])
    );
    expect(result.count).toBe(3);
    expect(result.intervalCount).toBe(2);
    expect(result.fundReturn).toBeCloseTo(21);
    expect(result.referenceReturn).toBeCloseTo(10);
    expect(result.relativeReturn).toBeCloseTo(10);
    expect(result.rows[0].activeReturn).toBeNull();
    expect(result.rows[1].activeReturn).toBeCloseTo(0);
    expect(result.rows[2].activeReturn).toBeCloseTo(10);
    expect(result.activeDispersion).toBeCloseTo(Math.sqrt(50));
  });
  it("uses exactly the same interval endpoints when source trading dates are incomplete", () => {
    const result = compareEtfPrices(points([100, 110, 120]), [
      { date: "2026-09-01", value: 200 },
      { date: "2026-09-03", value: 220 },
    ]);
    expect(result.count).toBe(2);
    expect(result.rows[1].fundReturn).toBeCloseTo(20);
    expect(result.rows[1].referenceReturn).toBeCloseTo(10);
    expect(result.intervalCount).toBe(1);
    expect(result.activeDispersion).toBeNull();
  });
  it("returns no inferred performance when either source is empty or lacks two shared dates", () => {
    const empty = compareEtfPrices(points([100, 120]), []);
    expect(empty.count).toBe(0);
    expect(empty.fundReturn).toBeNull();
    expect(empty.relativeReturn).toBeNull();
    const single = compareEtfPrices(points([100, 120]), [
      { date: "2026-09-02", value: 200 },
    ]);
    expect(single.count).toBe(1);
    expect(single.fundReturn).toBeNull();
    expect(single.relativeReturn).toBeNull();
  });
  it("excludes invalid or conflicting source values and preserves genuine observations", () => {
    const result = compareEtfPrices(
      [
        ...points([100, 110, 120]),
        { date: "2026-09-02", value: 111 },
        { date: "2026-09-04", value: 0 },
      ],
      points([200, 220, 240, 260])
    );
    expect(result.rows.map(row => row.date)).toEqual([
      "2026-09-01",
      "2026-09-03",
    ]);
    expect(result.relativeReturn).toBeCloseTo(0);
  });
  it("does not annualize active dispersion or infer a legal fund benchmark", () => {
    const result = compareEtfPrices(
      points([100, 110, 121]),
      points([100, 100, 100])
    );
    expect(result.meanActive).toBeCloseTo(10);
    expect(result.activeDispersion).toBeCloseTo(0);
    expect(result).not.toHaveProperty("trackingError");
    expect(result).not.toHaveProperty("premium");
    expect(result).not.toHaveProperty("nav");
  });
});

describe("IMAP unique cross-series relations", () => {
  it("contains each unordered pair once without self or mirrored duplicate cells", () => {
    const series = ["A", "B", "C", "D"].map((id, index) => ({
      id,
      label: id,
      history: points([1, 2, 4, 7].map(value => value * (index + 1))),
    }));
    const matrix = environmentRelationMatrix(series, 90, 3);
    expect(matrix).toHaveLength(6);
    expect(
      new Set(matrix.map(cell => [cell.leftId, cell.rightId].sort().join("|")))
        .size
    ).toBe(6);
    expect(matrix.every(cell => cell.leftId !== cell.rightId)).toBe(true);
    expect(matrix.every(cell => Math.abs(cell.correlation! - 1) < 1e-12)).toBe(
      true
    );
  });
  it("distinguishes insufficient samples from a sufficient constant-change series", () => {
    const matrix = environmentRelationMatrix(
      [
        { id: "A", label: "A", history: points([1, 2, 4, 7]) },
        { id: "B", label: "B", history: points([2, 4, 6, 8]) },
      ],
      90,
      3
    );
    expect(matrix[0].state).toBe("constant");
    expect(matrix[0].correlation).toBeNull();
    expect(matrix[0].count).toBe(3);
    const insufficient = environmentRelationMatrix(
      [
        { id: "A", label: "A", history: points([1, 2, 4, 7]) },
        { id: "B", label: "B", history: points([2, 4, 8, 14]) },
      ],
      90,
      20
    );
    expect(insufficient[0].state).toBe("insufficient");
    expect(insufficient[0].correlation).toBeNull();
    expect(insufficient[0].pairs).toHaveLength(3);
  });
  it("uses common start/end dates, never forward filling a missing day", () => {
    const matrix = environmentRelationMatrix(
      [
        { id: "A", label: "A", history: points([1, 2, 4, 7]) },
        {
          id: "B",
          label: "B",
          history: [
            { date: "2026-09-01", value: 1 },
            { date: "2026-09-03", value: 4 },
            { date: "2026-09-04", value: 7 },
          ],
        },
      ],
      90,
      3
    );
    expect(matrix[0].count).toBe(1);
    expect(matrix[0].pairs[0].period).toBe("2026-09-03/2026-09-04");
  });
  it("anchors every source to one common latest-observation calendar window", () => {
    const series = [
      { id: "fresh", label: "fresh", history: points([1, 2, 4, 7]) },
      {
        id: "old",
        label: "old",
        history: [
          { date: "2025-01-01", value: 1 },
          { date: "2025-01-02", value: 2 },
          { date: "2025-01-03", value: 4 },
          { date: "2025-01-04", value: 7 },
        ],
      },
    ];
    const cell = environmentRelationMatrix(series, 90, 3)[0];
    expect(cell.count).toBe(0);
    expect(cell.state).toBe("insufficient");
  });
  it("computes signed correlation of changes rather than absolute levels", () => {
    const cell = environmentRelationMatrix(
      [
        { id: "up", label: "up", history: points([10, 11, 13, 16]) },
        { id: "down", label: "down", history: points([1000, 999, 997, 994]) },
      ],
      90,
      3
    )[0];
    expect(cell.correlation).toBeCloseTo(-1);
    expect(cell.pairs[2]).toEqual({
      x: 3,
      y: -3,
      period: "2026-09-03/2026-09-04",
    });
  });
});
