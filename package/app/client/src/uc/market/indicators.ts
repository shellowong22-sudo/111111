/**
 * 佑诚技术指标库：主图叠加 + 副图指标，全部在浏览器端按 K 线实时计算（K 线随行情跳动，指标同步跳动）。
 *
 * 主图：MA · EMA · BOLL · SAR · VWAP · ENE
 * 副图：VOL · MACD · KDJ · RSI · WR · CCI · BIAS · OBV · DMI · ATR · ROC · TRIX · PSY · MFI · MTM · DMA · BRAR · CR · VR · EMV
 */
import type { Candle } from "./live";

export type Series = Array<number | null>;
export type IndicatorLine = { name: string; color: string; values: Series; kind?: "line" | "bar" | "dot" | "volume" };
export type IndicatorResult = { lines: IndicatorLine[]; refs?: number[]; fixed?: [number, number] };

export const OVERLAYS = ["MA", "EMA", "BOLL", "SAR", "VWAP", "ENE", "NONE"] as const;
export type OverlayId = (typeof OVERLAYS)[number];
export const SUBS = ["VOL", "MACD", "KDJ", "RSI", "WR", "CCI", "BIAS", "OBV", "DMI", "ATR", "ROC", "TRIX", "PSY", "MFI", "MTM", "DMA", "BRAR", "CR", "VR", "EMV"] as const;
export type SubId = (typeof SUBS)[number];

export const INDICATOR_LABELS: Record<string, string> = {
  MA: "均线", EMA: "指数均线", BOLL: "布林带", SAR: "抛物线转向", VWAP: "成交量加权均价", ENE: "轨道线", NONE: "无叠加",
  VOL: "成交量", MACD: "平滑异同移动平均", KDJ: "随机指标", RSI: "相对强弱", WR: "威廉指标", CCI: "顺势指标", BIAS: "乖离率",
  OBV: "能量潮", DMI: "趋向指标", ATR: "真实波幅", ROC: "变动率", TRIX: "三重指数平滑", PSY: "心理线", MFI: "资金流量",
  MTM: "动量", DMA: "平行线差", BRAR: "人气意愿", CR: "带状能量", VR: "成交量变异率", EMV: "简易波动",
};

const C = ["#f5c451", "#5fb4ff", "#d68cff", "#6ee7b7", "#fb923c"];

/* ---------------------------------------------------------------- 基础函数 */
export function sma(src: Series, n: number): Series {
  const out: Series = [];
  let sum = 0;
  let cnt = 0;
  const q: number[] = [];
  for (const v of src) {
    if (v == null) {
      out.push(null);
      continue;
    }
    q.push(v);
    sum += v;
    cnt += 1;
    if (q.length > n) sum -= q.shift()!;
    out.push(cnt >= n ? sum / n : null);
  }
  return out;
}
export function ema(src: Series, n: number): Series {
  const out: Series = [];
  const k = 2 / (n + 1);
  let prev: number | null = null;
  for (const v of src) {
    if (v == null) {
      out.push(prev);
      continue;
    }
    prev = prev == null ? v : v * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}
/** 中国式 SMA(X,N,M)：Y = (M*X + (N-M)*Y') / N */
function cnSma(src: Series, n: number, m: number): Series {
  const out: Series = [];
  let prev: number | null = null;
  for (const v of src) {
    if (v == null) {
      out.push(prev);
      continue;
    }
    prev = prev == null ? v : (m * v + (n - m) * prev) / n;
    out.push(prev);
  }
  return out;
}
const highest = (src: number[], i: number, n: number) => {
  let m = -Infinity;
  for (let j = Math.max(0, i - n + 1); j <= i; j++) m = Math.max(m, src[j]);
  return m;
};
const lowest = (src: number[], i: number, n: number) => {
  let m = Infinity;
  for (let j = Math.max(0, i - n + 1); j <= i; j++) m = Math.min(m, src[j]);
  return m;
};
const sumN = (src: Series, i: number, n: number) => {
  if (i < n - 1) return null;
  let s = 0;
  for (let j = i - n + 1; j <= i; j++) {
    const v = src[j];
    if (v == null) return null;
    s += v;
  }
  return s;
};
const stdev = (src: number[], i: number, n: number, mean: number) => {
  let s = 0;
  for (let j = i - n + 1; j <= i; j++) s += (src[j] - mean) ** 2;
  return Math.sqrt(s / n);
};
const sub = (a: Series, b: Series): Series => a.map((v, i) => (v == null || b[i] == null ? null : v - b[i]!));

/* ---------------------------------------------------------------- 主图叠加 */
export function overlay(id: OverlayId, k: Candle[], mas: number[] = [5, 10, 20, 60]): IndicatorResult {
  const close = k.map((c) => c.c);
  switch (id) {
    case "MA": return { lines: mas.map((n, i) => ({ name: `MA${n}`, color: C[i % C.length], values: sma(close, n) })) };
    case "EMA": return { lines: [12, 26, 50].map((n, i) => ({ name: `EMA${n}`, color: C[i], values: ema(close, n) })) };
    case "BOLL": {
      const mid = sma(close, 20);
      const up: Series = [];
      const dn: Series = [];
      mid.forEach((m, i) => {
        if (m == null) {
          up.push(null);
          dn.push(null);
          return;
        }
        const sd = stdev(close, i, 20, m);
        up.push(m + 2 * sd);
        dn.push(m - 2 * sd);
      });
      return { lines: [{ name: "MID", color: C[0], values: mid }, { name: "UPPER", color: C[1], values: up }, { name: "LOWER", color: C[2], values: dn }] };
    }
    case "ENE": {
      const m = sma(close, 10);
      return { lines: [{ name: "ENE", color: C[0], values: m }, { name: "UPPER", color: C[1], values: m.map((v) => (v == null ? null : v * 1.11)) }, { name: "LOWER", color: C[2], values: m.map((v) => (v == null ? null : v * 0.91)) }] };
    }
    case "VWAP": {
      // 日内周期：按自然日重置；日线及以上：滚动 20 根
      const out: Series = [];
      let pv = 0;
      let vv = 0;
      let day = "";
      const intraday = k.length > 1 && k[k.length - 1].t - k[k.length - 2].t < 86400e3 / 2;
      k.forEach((c, i) => {
        const tp = (c.h + c.l + c.c) / 3;
        const v = c.v ?? 0;
        if (intraday) {
          const d = new Date(c.t).toISOString().slice(0, 10);
          if (d !== day) {
            day = d;
            pv = 0;
            vv = 0;
          }
          pv += tp * v;
          vv += v;
          out.push(vv ? pv / vv : tp);
        } else {
          let a = 0;
          let b = 0;
          for (let j = Math.max(0, i - 19); j <= i; j++) {
            const vj = k[j].v ?? 0;
            a += ((k[j].h + k[j].l + k[j].c) / 3) * vj;
            b += vj;
          }
          out.push(b ? a / b : tp);
        }
      });
      return { lines: [{ name: "VWAP", color: C[0], values: out }] };
    }
    case "SAR": {
      const out: Series = [];
      if (k.length < 2) return { lines: [{ name: "SAR", color: C[1], values: k.map(() => null), kind: "dot" }] };
      let up = k[1].c >= k[0].c;
      let af = 0.02;
      let ep = up ? k[0].h : k[0].l;
      let sar = up ? k[0].l : k[0].h;
      out.push(null);
      for (let i = 1; i < k.length; i++) {
        sar = sar + af * (ep - sar);
        if (up) {
          sar = Math.min(sar, k[i - 1].l, k[Math.max(0, i - 2)].l);
          if (k[i].l < sar) {
            up = false;
            sar = ep;
            ep = k[i].l;
            af = 0.02;
          } else if (k[i].h > ep) {
            ep = k[i].h;
            af = Math.min(0.2, af + 0.02);
          }
        } else {
          sar = Math.max(sar, k[i - 1].h, k[Math.max(0, i - 2)].h);
          if (k[i].h > sar) {
            up = true;
            sar = ep;
            ep = k[i].h;
            af = 0.02;
          } else if (k[i].l < ep) {
            ep = k[i].l;
            af = Math.min(0.2, af + 0.02);
          }
        }
        out.push(sar);
      }
      return { lines: [{ name: "SAR", color: C[1], values: out, kind: "dot" }] };
    }
    default: return { lines: [] };
  }
}

/* ---------------------------------------------------------------- 副图 */
export function subIndicator(id: SubId, k: Candle[]): IndicatorResult {
  const close = k.map((c) => c.c);
  const high = k.map((c) => c.h);
  const low = k.map((c) => c.l);
  const vol = k.map((c) => c.v ?? 0);
  const n = k.length;
  switch (id) {
    case "VOL": return { lines: [{ name: "VOL", color: "#94a3b8", values: vol, kind: "volume" }, { name: "MA5", color: C[0], values: sma(vol, 5) }, { name: "MA10", color: C[1], values: sma(vol, 10) }] };
    case "MACD": {
      const dif = sub(ema(close, 12), ema(close, 26));
      const dea = ema(dif, 9);
      const hist = dif.map((v, i) => (v == null || dea[i] == null ? null : 2 * (v - dea[i]!)));
      return { lines: [{ name: "MACD", color: "#94a3b8", values: hist, kind: "bar" }, { name: "DIF", color: C[0], values: dif }, { name: "DEA", color: C[1], values: dea }], refs: [0] };
    }
    case "KDJ": {
      const rsv: Series = close.map((c, i) => {
        const h = highest(high, i, 9);
        const l = lowest(low, i, 9);
        return h === l ? 50 : ((c - l) / (h - l)) * 100;
      });
      const kk = cnSma(rsv, 3, 1);
      const d = cnSma(kk, 3, 1);
      const j = kk.map((v, i) => (v == null || d[i] == null ? null : 3 * v - 2 * d[i]!));
      return { lines: [{ name: "K", color: C[0], values: kk }, { name: "D", color: C[1], values: d }, { name: "J", color: C[2], values: j }], refs: [20, 80] };
    }
    case "RSI": {
      const lines = [6, 12, 24].map((p, idx) => {
        const up: Series = [null];
        const all: Series = [null];
        for (let i = 1; i < n; i++) {
          const d = close[i] - close[i - 1];
          up.push(Math.max(d, 0));
          all.push(Math.abs(d));
        }
        const a = cnSma(up, p, 1);
        const b = cnSma(all, p, 1);
        return { name: `RSI${p}`, color: C[idx], values: a.map((v, i) => (v == null || !b[i] ? null : (v / b[i]!) * 100)) };
      });
      return { lines, refs: [30, 70], fixed: [0, 100] };
    }
    case "WR": {
      const wr = (p: number) => close.map((c, i) => {
        const h = highest(high, i, p);
        const l = lowest(low, i, p);
        return h === l ? 50 : ((h - c) / (h - l)) * 100;
      });
      return { lines: [{ name: "WR10", color: C[0], values: wr(10) }, { name: "WR6", color: C[1], values: wr(6) }], refs: [20, 80], fixed: [0, 100] };
    }
    case "CCI": {
      const tp = k.map((c) => (c.h + c.l + c.c) / 3);
      const ma = sma(tp, 14);
      const out: Series = tp.map((v, i) => {
        const m = ma[i];
        if (m == null) return null;
        let md = 0;
        for (let j = i - 13; j <= i; j++) md += Math.abs(tp[j] - m);
        md /= 14;
        return md ? (v - m) / (0.015 * md) : 0;
      });
      return { lines: [{ name: "CCI", color: C[0], values: out }], refs: [-100, 100] };
    }
    case "BIAS": return {
      lines: [6, 12, 24].map((p, idx) => {
        const m = sma(close, p);
        return { name: `BIAS${p}`, color: C[idx], values: close.map((c, i) => (m[i] == null ? null : ((c - m[i]!) / m[i]!) * 100)) };
      }),
      refs: [0],
    };
    case "OBV": {
      const out: Series = [];
      let acc = 0;
      k.forEach((c, i) => {
        if (i) acc += c.c > k[i - 1].c ? vol[i] : c.c < k[i - 1].c ? -vol[i] : 0;
        out.push(acc);
      });
      return { lines: [{ name: "OBV", color: C[0], values: out }, { name: "MAOBV", color: C[1], values: sma(out, 30) }] };
    }
    case "ATR":
    case "DMI": {
      const tr: Series = k.map((c, i) => (i ? Math.max(c.h - c.l, Math.abs(c.h - k[i - 1].c), Math.abs(c.l - k[i - 1].c)) : c.h - c.l));
      if (id === "ATR") return { lines: [{ name: "TR", color: "#64748b", values: tr }, { name: "ATR", color: C[0], values: sma(tr, 14) }] };
      const pdm: Series = k.map((c, i) => {
        if (!i) return 0;
        const u = c.h - k[i - 1].h;
        const d = k[i - 1].l - c.l;
        return u > d && u > 0 ? u : 0;
      });
      const mdm: Series = k.map((c, i) => {
        if (!i) return 0;
        const u = c.h - k[i - 1].h;
        const d = k[i - 1].l - c.l;
        return d > u && d > 0 ? d : 0;
      });
      const trs = tr.map((_, i) => sumN(tr, i, 14));
      const pdi = pdm.map((_, i) => {
        const s = sumN(pdm, i, 14);
        return s == null || !trs[i] ? null : (s / trs[i]!) * 100;
      });
      const mdi = mdm.map((_, i) => {
        const s = sumN(mdm, i, 14);
        return s == null || !trs[i] ? null : (s / trs[i]!) * 100;
      });
      const dx: Series = pdi.map((p, i) => (p == null || mdi[i] == null || p + mdi[i]! === 0 ? null : (Math.abs(mdi[i]! - p) / (mdi[i]! + p)) * 100));
      const adx = sma(dx, 6);
      const adxr = adx.map((v, i) => (v == null || i < 6 || adx[i - 6] == null ? null : (v + adx[i - 6]!) / 2));
      return { lines: [{ name: "PDI", color: C[0], values: pdi }, { name: "MDI", color: C[1], values: mdi }, { name: "ADX", color: C[2], values: adx }, { name: "ADXR", color: C[3], values: adxr }] };
    }
    case "ROC": {
      const roc: Series = close.map((c, i) => (i >= 12 && close[i - 12] ? ((c - close[i - 12]) / close[i - 12]) * 100 : null));
      return { lines: [{ name: "ROC", color: C[0], values: roc }, { name: "MAROC", color: C[1], values: sma(roc, 6) }], refs: [0] };
    }
    case "TRIX": {
      const tr = ema(ema(ema(close, 12), 12), 12);
      const trix: Series = tr.map((v, i) => (i && v != null && tr[i - 1] ? ((v - tr[i - 1]!) / tr[i - 1]!) * 100 : null));
      return { lines: [{ name: "TRIX", color: C[0], values: trix }, { name: "MATRIX", color: C[1], values: sma(trix, 9) }], refs: [0] };
    }
    case "PSY": {
      const upDays: Series = close.map((c, i) => (i && c > close[i - 1] ? 1 : 0));
      const psy = upDays.map((_, i) => {
        const s = sumN(upDays, i, 12);
        return s == null ? null : (s / 12) * 100;
      });
      return { lines: [{ name: "PSY", color: C[0], values: psy }, { name: "PSYMA", color: C[1], values: sma(psy, 6) }], refs: [25, 75], fixed: [0, 100] };
    }
    case "MFI": {
      const tp = k.map((c) => (c.h + c.l + c.c) / 3);
      const pos: Series = tp.map((v, i) => (i && v > tp[i - 1] ? v * vol[i] : 0));
      const neg: Series = tp.map((v, i) => (i && v < tp[i - 1] ? v * vol[i] : 0));
      const mfi = tp.map((_, i) => {
        const p = sumN(pos, i, 14);
        const q = sumN(neg, i, 14);
        if (p == null || q == null) return null;
        return q === 0 ? 100 : 100 - 100 / (1 + p / q);
      });
      return { lines: [{ name: "MFI", color: C[0], values: mfi }], refs: [20, 80], fixed: [0, 100] };
    }
    case "MTM": {
      const mtm: Series = close.map((c, i) => (i >= 12 ? c - close[i - 12] : null));
      return { lines: [{ name: "MTM", color: C[0], values: mtm }, { name: "MAMTM", color: C[1], values: sma(mtm, 6) }], refs: [0] };
    }
    case "DMA": {
      const dif = sub(sma(close, 10), sma(close, 50));
      return { lines: [{ name: "DIF", color: C[0], values: dif }, { name: "DIFMA", color: C[1], values: sma(dif, 10) }], refs: [0] };
    }
    case "BRAR": {
      const ar: Series = [];
      const br: Series = [];
      for (let i = 0; i < n; i++) {
        if (i < 26) {
          ar.push(null);
          br.push(null);
          continue;
        }
        let a1 = 0, a2 = 0, b1 = 0, b2 = 0;
        for (let j = i - 25; j <= i; j++) {
          a1 += k[j].h - k[j].o;
          a2 += k[j].o - k[j].l;
          b1 += Math.max(0, k[j].h - k[j - 1].c);
          b2 += Math.max(0, k[j - 1].c - k[j].l);
        }
        ar.push(a2 ? (a1 / a2) * 100 : null);
        br.push(b2 ? (b1 / b2) * 100 : null);
      }
      return { lines: [{ name: "BR", color: C[0], values: br }, { name: "AR", color: C[1], values: ar }], refs: [100] };
    }
    case "CR": {
      const cr: Series = [];
      for (let i = 0; i < n; i++) {
        if (i < 26) {
          cr.push(null);
          continue;
        }
        let a = 0, b = 0;
        for (let j = i - 25; j <= i; j++) {
          const mid = (k[j - 1].h + k[j - 1].l + k[j - 1].c) / 3;
          a += Math.max(0, k[j].h - mid);
          b += Math.max(0, mid - k[j].l);
        }
        cr.push(b ? (a / b) * 100 : null);
      }
      return { lines: [{ name: "CR", color: C[0], values: cr }, { name: "MA10", color: C[1], values: sma(cr, 10) }, { name: "MA20", color: C[2], values: sma(cr, 20) }], refs: [100] };
    }
    case "VR": {
      const vr: Series = [];
      for (let i = 0; i < n; i++) {
        if (i < 26) {
          vr.push(null);
          continue;
        }
        let u = 0, d = 0, f = 0;
        for (let j = i - 25; j <= i; j++) {
          if (k[j].c > k[j - 1].c) u += vol[j];
          else if (k[j].c < k[j - 1].c) d += vol[j];
          else f += vol[j];
        }
        vr.push(d + f / 2 ? ((u + f / 2) / (d + f / 2)) * 100 : null);
      }
      return { lines: [{ name: "VR", color: C[0], values: vr }, { name: "MAVR", color: C[1], values: sma(vr, 6) }], refs: [100] };
    }
    case "EMV": {
      const vm = sma(vol, 14);
      const raw: Series = k.map((c, i) => {
        if (!i) return null;
        const mid = (c.h + c.l) / 2 - (k[i - 1].h + k[i - 1].l) / 2;
        const ratio = vol[i] && vm[i] ? vm[i]! / vol[i] : 1;
        const base = (c.h + c.l) / 2 || 1;
        return ((mid * (c.h - c.l) * ratio) / base / base) * 10000;
      });
      const emv = sma(raw, 14);
      return { lines: [{ name: "EMV", color: C[0], values: emv }, { name: "MAEMV", color: C[1], values: sma(emv, 9) }], refs: [0] };
    }
    default: return { lines: [] };
  }
}

/* ---------------------------------------------------------------- 技术面综合评分 */
export type Signal = { name: string; value: string; verdict: 1 | 0 | -1; note: string };

export function technicalSummary(k: Candle[]): { score: number; label: string; signals: Signal[] } {
  const signals: Signal[] = [];
  if (k.length < 30) return { score: 0, label: "数据不足", signals };
  const i = k.length - 1;
  const close = k.map((c) => c.c);
  const last = close[i];
  const fmt = (v: number | null | undefined, d = 2) => (v == null || !Number.isFinite(v) ? "—" : v.toFixed(d));

  for (const p of [5, 10, 20, 60]) {
    const m = sma(close, p)[i];
    if (m == null) continue;
    signals.push({ name: `MA${p}`, value: fmt(m), verdict: last > m ? 1 : last < m ? -1 : 0, note: last > m ? "价格在均线上方" : "价格在均线下方" });
  }
  const macd = subIndicator("MACD", k);
  const dif = macd.lines[1].values;
  const dea = macd.lines[2].values;
  if (dif[i] != null && dea[i] != null && dif[i - 1] != null && dea[i - 1] != null) {
    const cross = dif[i - 1]! <= dea[i - 1]! && dif[i]! > dea[i]! ? "金叉" : dif[i - 1]! >= dea[i - 1]! && dif[i]! < dea[i]! ? "死叉" : dif[i]! > dea[i]! ? "多头" : "空头";
    signals.push({ name: "MACD", value: `${fmt(dif[i])}/${fmt(dea[i])}`, verdict: dif[i]! > dea[i]! ? 1 : -1, note: cross + (dif[i]! > 0 ? "，零轴上方" : "，零轴下方") });
  }
  const kdj = subIndicator("KDJ", k);
  const kv = kdj.lines[0].values[i];
  const dv = kdj.lines[1].values[i];
  if (kv != null && dv != null) signals.push({ name: "KDJ", value: `${fmt(kv, 1)}/${fmt(dv, 1)}`, verdict: kv > 80 ? -1 : kv < 20 ? 1 : kv > dv ? 1 : -1, note: kv > 80 ? "超买区" : kv < 20 ? "超卖区" : kv > dv ? "K 上穿 D" : "K 低于 D" });
  const rsi = subIndicator("RSI", k).lines[0].values[i];
  if (rsi != null) signals.push({ name: "RSI6", value: fmt(rsi, 1), verdict: rsi > 70 ? -1 : rsi < 30 ? 1 : rsi >= 50 ? 1 : -1, note: rsi > 70 ? "超买" : rsi < 30 ? "超卖" : rsi >= 50 ? "强势区" : "弱势区" });
  const boll = overlay("BOLL", k);
  const up = boll.lines[1].values[i];
  const dn = boll.lines[2].values[i];
  if (up != null && dn != null) signals.push({ name: "BOLL", value: `${fmt(dn)}~${fmt(up)}`, verdict: last > up ? -1 : last < dn ? 1 : 0, note: last > up ? "突破上轨" : last < dn ? "跌破下轨" : "通道内运行" });
  const cci = subIndicator("CCI", k).lines[0].values[i];
  if (cci != null) signals.push({ name: "CCI", value: fmt(cci, 0), verdict: cci > 100 ? 1 : cci < -100 ? -1 : 0, note: cci > 100 ? "强势" : cci < -100 ? "弱势" : "常态区间" });
  const wr = subIndicator("WR", k).lines[0].values[i];
  if (wr != null) signals.push({ name: "WR10", value: fmt(wr, 1), verdict: wr > 80 ? 1 : wr < 20 ? -1 : 0, note: wr > 80 ? "超卖" : wr < 20 ? "超买" : "中性" });
  const dmi = subIndicator("DMI", k);
  const pdi = dmi.lines[0].values[i];
  const mdi = dmi.lines[1].values[i];
  const adx = dmi.lines[2].values[i];
  if (pdi != null && mdi != null) signals.push({ name: "DMI", value: `${fmt(pdi, 1)}/${fmt(mdi, 1)}`, verdict: pdi > mdi ? 1 : -1, note: `${pdi > mdi ? "多方占优" : "空方占优"}${adx != null ? `，ADX ${fmt(adx, 1)}${adx > 25 ? " 趋势明显" : " 趋势较弱"}` : ""}` });
  const sar = overlay("SAR", k).lines[0].values[i];
  if (sar != null) signals.push({ name: "SAR", value: fmt(sar), verdict: last > sar ? 1 : -1, note: last > sar ? "多头支撑" : "空头压制" });

  const total = signals.reduce((s, x) => s + x.verdict, 0);
  const score = signals.length ? total / signals.length : 0;
  const label = score >= 0.5 ? "强烈买入" : score >= 0.15 ? "买入" : score <= -0.5 ? "强烈卖出" : score <= -0.15 ? "卖出" : "中性";
  return { score, label, signals };
}

/* ---------------------------------------------------------------- 买卖点信号（随实时 K 线同步计算） */
export type TradeSignal = { i: number; side: "B" | "S"; reasons: string[] };

export function tradeSignals(k: Candle[]): TradeSignal[] {
  if (k.length < 35) return [];
  const close = k.map((c) => c.c);
  const macd = subIndicator("MACD", k);
  const dif = macd.lines[1].values;
  const dea = macd.lines[2].values;
  const kdj = subIndicator("KDJ", k);
  const K = kdj.lines[0].values;
  const D = kdj.lines[1].values;
  const ma5 = sma(close, 5);
  const ma20 = sma(close, 20);
  const sar = overlay("SAR", k).lines[0].values;
  const boll = overlay("BOLL", k);
  const up = boll.lines[1].values;
  const dn = boll.lines[2].values;
  const rsi = subIndicator("RSI", k).lines[0].values;
  const crossUp = (a: Series, b: Series, i: number) => a[i] != null && b[i] != null && a[i - 1] != null && b[i - 1] != null && a[i - 1]! <= b[i - 1]! && a[i]! > b[i]!;
  const crossDn = (a: Series, b: Series, i: number) => a[i] != null && b[i] != null && a[i - 1] != null && b[i - 1] != null && a[i - 1]! >= b[i - 1]! && a[i]! < b[i]!;
  const out: TradeSignal[] = [];
  const buyEv: string[][] = k.map(() => []);
  const sellEv: string[][] = k.map(() => []);
  for (let i = 26; i < k.length; i++) {
    const buy = buyEv[i];
    const sell = sellEv[i];
    if (crossUp(dif, dea, i)) buy.push(dif[i]! < 0 ? "MACD零轴下金叉" : "MACD金叉");
    if (crossDn(dif, dea, i)) sell.push(dif[i]! > 0 ? "MACD零轴上死叉" : "MACD死叉");
    if (crossUp(K, D, i) && (K[i] ?? 50) < 40) buy.push("KDJ低位金叉");
    if (crossDn(K, D, i) && (K[i] ?? 50) > 60) sell.push("KDJ高位死叉");
    if (crossUp(ma5, ma20, i)) buy.push("MA5上穿MA20");
    if (crossDn(ma5, ma20, i)) sell.push("MA5下穿MA20");
    if (sar[i] != null && sar[i - 1] != null) {
      if (close[i - 1] <= sar[i - 1]! && close[i] > sar[i]!) buy.push("SAR翻多");
      if (close[i - 1] >= sar[i - 1]! && close[i] < sar[i]!) sell.push("SAR翻空");
    }
    if (dn[i] != null && dn[i - 1] != null && close[i - 1] < dn[i - 1]! && close[i] > dn[i]!) buy.push("BOLL下轨回升");
    if (up[i] != null && up[i - 1] != null && close[i - 1] > up[i - 1]! && close[i] < up[i]!) sell.push("BOLL上轨回落");
    if (rsi[i] != null && rsi[i - 1] != null && rsi[i - 1]! < 25 && rsi[i]! >= 25) buy.push("RSI超卖回升");
    if (rsi[i] != null && rsi[i - 1] != null && rsi[i - 1]! > 75 && rsi[i]! <= 75) sell.push("RSI超买回落");
  }
  // 3 根 K 线内至少两个条件共振（或一个强信号）才标记，避免噪音
  let lastB = -99;
  let lastS = -99;
  for (let i = 26; i < k.length; i++) {
    if (!buyEv[i].length && !sellEv[i].length) continue;
    const wb = [...new Set([...buyEv[i - 2], ...buyEv[i - 1], ...buyEv[i]])];
    const ws = [...new Set([...sellEv[i - 2], ...sellEv[i - 1], ...sellEv[i]])];
    const strongB = buyEv[i].some((r) => r.includes("零轴下金叉"));
    const strongS = sellEv[i].some((r) => r.includes("零轴上死叉"));
    if (buyEv[i].length && (wb.length >= 2 || strongB) && wb.length > ws.length && i - lastB >= 5) {
      out.push({ i, side: "B", reasons: wb });
      lastB = i;
    } else if (sellEv[i].length && (ws.length >= 2 || strongS) && ws.length > wb.length && i - lastS >= 5) {
      out.push({ i, side: "S", reasons: ws });
      lastS = i;
    }
  }
  return out;
}
