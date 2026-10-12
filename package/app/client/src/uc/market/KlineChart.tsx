/**
 * 佑诚 K 线图（SVG 自绘，轻量、可同时渲染几十个）。
 *  - 主图蜡烛 + 叠加指标（MA / EMA / BOLL / SAR / VWAP / ENE）
 *  - 任意个副图指标（VOL / MACD / KDJ / RSI / WR / CCI / BIAS / OBV / DMI / ATR / ROC / TRIX / PSY / MFI / MTM / DMA / BRAR / CR / VR / EMV）
 *  - 美股盘前 / 盘后时段底色区分
 *  - 鼠标十字线读数；滚轮缩放、拖拽平移；双击回到最新
 *  - 最新价虚线与价签随实时报价跳动
 *  - mini 模式：卡片里的迷你 K 线，无坐标轴
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { DOWN, FLAT, UP, fmtCompact, fmtPrice, type Candle, type Period } from "./live";
import { overlay as calcOverlay, subIndicator, tradeSignals, type IndicatorResult, type OverlayId, type SubId } from "./indicators";

type Props = {
  candles: Candle[];
  period: Period;
  height: number;
  mini?: boolean;
  showVolume?: boolean;
  mas?: number[];
  overlay?: OverlayId;
  subs?: SubId[];
  subHeight?: number;
  prevClose?: number | null;
  live?: boolean;
  onRemoveSub?: (id: SubId) => void;
  signals?: boolean;
};

function timeLabel(t: number, period: Period, full = false) {
  const d = new Date(t + 8 * 3600e3);
  const iso = d.toISOString();
  if (period.endsWith("m") && period !== "1M") return full ? `${iso.slice(5, 10)} ${iso.slice(11, 16)}` : iso.slice(11, 16);
  if (period === "1M") return iso.slice(0, 7);
  return full ? iso.slice(0, 10) : iso.slice(5, 10);
}

const fmtInd = (v: number | null | undefined) => {
  if (v == null || !Number.isFinite(v)) return "—";
  const a = Math.abs(v);
  return a >= 1e4 ? fmtCompact(v) : v.toFixed(a >= 100 ? 1 : a >= 1 ? 2 : 3);
};

export default function KlineChart({ candles, period, height, mini, showVolume = !mini, mas = mini ? [] : [5, 10, 20], overlay, subs, subHeight = 72, prevClose, live, onRemoveSub, signals = false }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [count, setCount] = useState(mini ? 48 : 110);
  const [offset, setOffset] = useState(0); // 距最新一根的偏移
  const [hover, setHover] = useState<number | null>(null);
  const drag = useRef<{ x: number; offset: number } | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  useEffect(() => setOffset(0), [period]);

  const overlayId: OverlayId = overlay ?? (mas.length ? "MA" : "NONE");
  const subIds: SubId[] = mini ? [] : subs ?? (showVolume ? ["VOL"] : []);
  const masKey = mas.join(",");
  const main = useMemo<IndicatorResult>(() => calcOverlay(overlayId, candles, mas), [overlayId, candles, masKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const subData = useMemo(() => subIds.map((id) => ({ id, r: subIndicator(id, candles) })), [subIds.join(","), candles]); // eslint-disable-line react-hooks/exhaustive-deps

  const sigs = useMemo(() => (signals && !mini ? tradeSignals(candles) : []), [signals, mini, candles]);
  const lastSig = sigs[sigs.length - 1];
  const total = candles.length;
  const n = Math.max(10, Math.min(count, total || 10));
  const end = Math.max(0, total - offset);
  const start = Math.max(0, end - n);
  const view = candles.slice(start, end);

  const padR = mini ? 2 : 58;
  const padT = mini ? 2 : 18;
  const padB = mini ? 2 : 16;
  const subGap = 16;
  const subsH = subData.length * (subHeight + subGap);
  const priceH = Math.max(40, height - padT - padB - subsH);
  const plotW = Math.max(10, width - padR - (mini ? 2 : 4));
  const step = plotW / Math.max(n, view.length || 1);
  const body = Math.max(1, Math.min(14, step * 0.68));

  let hi = -Infinity;
  let lo = Infinity;
  for (let i = 0; i < view.length; i++) {
    hi = Math.max(hi, view[i].h);
    lo = Math.min(lo, view[i].l);
    for (const line of main.lines) {
      const v = line.values[start + i];
      if (v != null && Number.isFinite(v)) {
        hi = Math.max(hi, v);
        lo = Math.min(lo, v);
      }
    }
  }
  if (!Number.isFinite(hi)) {
    hi = 1;
    lo = 0;
  }
  const pad = (hi - lo) * 0.06 || hi * 0.01 || 1;
  hi += pad;
  lo -= pad;
  const y = (v: number) => padT + ((hi - v) / (hi - lo)) * priceH;
  const x = (i: number) => (mini ? 1 : 4) + i * step + step / 2;

  const last = view[view.length - 1];
  const lastAll = candles[candles.length - 1];
  const ref = prevClose ?? (candles.length > 1 ? candles[candles.length - 2].c : null);
  const lastColor = lastAll && ref != null ? (lastAll.c > ref ? UP : lastAll.c < ref ? DOWN : FLAT) : FLAT;
  const hIdx = hover ?? view.length - 1;
  const hv = hover != null ? view[hover] : null;
  const digits = hi > 1 ? 2 : 4;

  const onWheel = (e: React.WheelEvent) => {
    if (mini) return;
    e.preventDefault();
    setCount((c) => Math.max(20, Math.min(600, Math.round(c * (e.deltaY > 0 ? 1.15 : 0.87)))));
  };
  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    const px = e.clientX - rect.left;
    if (drag.current && !mini) {
      const dx = px - drag.current.x;
      const shift = Math.round(dx / step);
      setOffset(Math.max(0, Math.min(Math.max(0, total - 20), drag.current.offset + shift)));
      return;
    }
    const i = Math.floor((px - (mini ? 1 : 4)) / step);
    setHover(i >= 0 && i < view.length ? i : null);
  };

  const yTicks = mini ? [] : Array.from({ length: 5 }, (_, i) => lo + ((hi - lo) * (i + 0.5)) / 5);
  const xTicks = mini || view.length < 2 ? [] : [0.12, 0.38, 0.64, 0.9].map((f) => Math.min(view.length - 1, Math.floor(view.length * f)));
  const poly = (vals: Array<number | null>, fy: (v: number) => number) => {
    const segs: string[][] = [[]];
    vals.forEach((v, i) => {
      if (v == null || !Number.isFinite(v)) {
        if (segs[segs.length - 1].length) segs.push([]);
      } else segs[segs.length - 1].push(`${x(i).toFixed(1)},${fy(v).toFixed(1)}`);
    });
    return segs.filter((s) => s.length > 1);
  };

  // 盘前盘后底色
  const sessionBands: Array<{ from: number; to: number; s: "pre" | "post" }> = [];
  view.forEach((c, i) => {
    if (!c.s) return;
    const lastBand = sessionBands[sessionBands.length - 1];
    if (lastBand && lastBand.s === c.s && lastBand.to === i - 1) lastBand.to = i;
    else sessionBands.push({ from: i, to: i, s: c.s });
  });

  return (
    <div ref={wrap} className="relative w-full select-none" style={{ height }} onWheel={onWheel}>
      {!mini && (
        <div className="pointer-events-none absolute left-1 top-0 z-10 flex flex-wrap gap-x-2 font-mono text-[10px] leading-4">
          {(hv ?? last) && (
            <>
              <span className="text-slate-400">{timeLabel((hv ?? last)!.t, period, true)}{(hv ?? last)!.s === "pre" ? " 盘前" : (hv ?? last)!.s === "post" ? " 盘后" : ""}</span>
              <span className="text-slate-500">开<b className="ml-0.5 font-normal text-slate-200">{fmtPrice((hv ?? last)!.o, digits)}</b></span>
              <span className="text-slate-500">高<b className="ml-0.5 font-normal" style={{ color: UP }}>{fmtPrice((hv ?? last)!.h, digits)}</b></span>
              <span className="text-slate-500">低<b className="ml-0.5 font-normal" style={{ color: DOWN }}>{fmtPrice((hv ?? last)!.l, digits)}</b></span>
              <span className="text-slate-500">收<b className="ml-0.5 font-normal text-slate-100">{fmtPrice((hv ?? last)!.c, digits)}</b></span>
              {(hv ?? last)!.v != null && <span className="text-slate-500">量<b className="ml-0.5 font-normal text-slate-300">{fmtCompact((hv ?? last)!.v)}</b></span>}
              {main.lines.map((l) => <span key={l.name} style={{ color: l.color }}>{l.name} {fmtInd(l.values[start + hIdx])}</span>)}
              {signals && (() => {
                const at = sigs.find((x) => x.i === start + hIdx) ?? (hover == null ? lastSig : undefined);
                return at ? <span className="font-semibold" style={{ color: at.side === "B" ? UP : DOWN }}>{at.i === total - 1 ? "● 实时" : `${timeLabel(candles[at.i].t, period, true)}`} {at.side === "B" ? "买入信号" : "卖出信号"}：{at.reasons.join(" + ")}</span> : null;
              })()}
            </>
          )}
        </div>
      )}
      {width > 0 && view.length > 0 && (
        <svg
          width={width}
          height={height}
          className={mini ? "" : "cursor-crosshair"}
          onMouseMove={onMove}
          onMouseLeave={() => {
            setHover(null);
            drag.current = null;
          }}
          onMouseDown={(e) => {
            if (mini) return;
            const rect = e.currentTarget.getBoundingClientRect();
            drag.current = { x: e.clientX - rect.left, offset };
          }}
          onMouseUp={() => (drag.current = null)}
          onDoubleClick={() => {
            setOffset(0);
            setCount(mini ? 48 : 110);
          }}
        >
          {sessionBands.map((b) => (
            <g key={`${b.s}-${b.from}`}>
              <rect x={x(b.from) - step / 2} y={padT} width={(b.to - b.from + 1) * step} height={priceH} fill={b.s === "pre" ? "#1e3a8a" : "#4c1d95"} fillOpacity={0.18} />
              {!mini && <text x={x(b.from) - step / 2 + 3} y={padT + priceH - 4} fontSize={9} fill={b.s === "pre" ? "#93c5fd" : "#c4b5fd"}>{b.s === "pre" ? "盘前" : "盘后"}</text>}
            </g>
          ))}
          {!mini && yTicks.map((v) => (
            <g key={v}>
              <line x1={0} x2={plotW + 4} y1={y(v)} y2={y(v)} stroke="#16283b" strokeDasharray="2 3" />
              <text x={plotW + 8} y={y(v) + 3} fontSize={9} fill="#5f7891" fontFamily="ui-monospace,monospace">{fmtPrice(v, digits)}</text>
            </g>
          ))}
          {!mini && xTicks.map((i) => (
            <text key={i} x={x(i)} y={height - 3} fontSize={9} textAnchor="middle" fill="#5f7891" fontFamily="ui-monospace,monospace">{timeLabel(view[i].t, period)}</text>
          ))}
          {prevClose != null && prevClose > lo && prevClose < hi && (
            <line x1={0} x2={plotW + 4} y1={y(prevClose)} y2={y(prevClose)} stroke="#64748b" strokeOpacity={0.45} strokeDasharray="4 4" />
          )}
          {view.map((c, i) => {
            const up = c.c >= c.o;
            const color = up ? UP : DOWN;
            const top = y(Math.max(c.o, c.c));
            const h = Math.max(1, Math.abs(y(c.o) - y(c.c)));
            return (
              <g key={c.t} opacity={c.s ? 0.75 : 1}>
                <line x1={x(i)} x2={x(i)} y1={y(c.h)} y2={y(c.l)} stroke={color} strokeWidth={1} />
                <rect x={x(i) - body / 2} y={top} width={body} height={h} fill={up && !mini && body > 3 ? "#08131f" : color} stroke={color} strokeWidth={1} />
              </g>
            );
          })}
          {main.lines.map((line) => {
            const vals = view.map((_, i) => line.values[start + i]);
            if (line.kind === "dot") return <g key={line.name}>{vals.map((v, i) => (v == null ? null : <circle key={i} cx={x(i)} cy={y(v)} r={1.6} fill={line.color} />))}</g>;
            return poly(vals, y).map((pts, k) => <polyline key={`${line.name}-${k}`} points={pts.join(" ")} fill="none" stroke={line.color} strokeWidth={1} />);
          })}
          {sigs.filter((g) => g.i >= start && g.i < end).map((g) => {
            const i = g.i - start;
            const c = view[i];
            const isB = g.side === "B";
            const yy = isB ? y(c.l) + 6 : y(c.h) - 6;
            const color = isB ? UP : DOWN;
            return (
              <g key={`sig-${g.i}`} pointerEvents="none">
                <path d={isB ? `M${x(i)},${yy} l-4,7 h8 z` : `M${x(i)},${yy} l-4,-7 h8 z`} fill={color} />
                <text x={x(i)} y={isB ? yy + 17 : yy - 10} fontSize={9} fontWeight={700} textAnchor="middle" fill={color}>{g.side}</text>
              </g>
            );
          })}
          {lastAll && offset === 0 && (
            <g>
              <line x1={0} x2={plotW + 4} y1={y(lastAll.c)} y2={y(lastAll.c)} stroke={lastColor} strokeDasharray="3 3" strokeOpacity={0.9} />
              {!mini && (
                <g>
                  <rect x={plotW + 4} y={y(lastAll.c) - 8} width={padR - 2} height={16} rx={2} fill={lastColor} />
                  <text x={plotW + 7} y={y(lastAll.c) + 3.5} fontSize={10} fill="#fff" fontFamily="ui-monospace,monospace">{fmtPrice(lastAll.c, digits)}</text>
                </g>
              )}
              {live && <circle cx={x(view.length - 1)} cy={y(lastAll.c)} r={mini ? 2 : 3} fill={lastColor} className="animate-ping" style={{ transformOrigin: `${x(view.length - 1)}px ${y(lastAll.c)}px` }} />}
            </g>
          )}

          {/* 副图 */}
          {subData.map(({ id, r }, si) => {
            const top = padT + priceH + subGap + si * (subHeight + subGap);
            const vals = r.lines.map((l) => view.map((_, i) => l.values[start + i]));
            let smax = -Infinity;
            let smin = Infinity;
            vals.forEach((arr) => arr.forEach((v) => {
              if (v != null && Number.isFinite(v)) {
                smax = Math.max(smax, v);
                smin = Math.min(smin, v);
              }
            }));
            if (r.fixed) {
              smin = Math.min(smin, r.fixed[0]);
              smax = Math.max(smax, r.fixed[1]);
            }
            if (r.lines.some((l) => l.kind === "volume")) smin = 0;
            if (!Number.isFinite(smax)) {
              smax = 1;
              smin = 0;
            }
            if (smax === smin) smax = smin + 1;
            const sy = (v: number) => top + ((smax - v) / (smax - smin)) * subHeight;
            return (
              <g key={id}>
                <line x1={0} x2={plotW + 4} y1={top - subGap / 2 + 2} y2={top - subGap / 2 + 2} stroke="#15304a" />
                <text x={4} y={top - 3} fontSize={9} fill="#7dd3fc" fontFamily="ui-monospace,monospace">{id}</text>
                {r.lines.map((l, li) => (
                  <text key={l.name} x={34 + li * 92} y={top - 3} fontSize={9} fill={l.kind === "volume" || l.kind === "bar" ? "#94a3b8" : l.color} fontFamily="ui-monospace,monospace">{l.name} {fmtInd(l.values[start + hIdx])}</text>
                ))}
                {onRemoveSub && <text x={plotW - 6} y={top - 3} fontSize={10} fill="#64748b" className="cursor-pointer" onClick={() => onRemoveSub(id)}>×</text>}
                <text x={plotW + 8} y={top + 8} fontSize={8} fill="#5f7891" fontFamily="ui-monospace,monospace">{fmtInd(smax)}</text>
                <text x={plotW + 8} y={top + subHeight} fontSize={8} fill="#5f7891" fontFamily="ui-monospace,monospace">{fmtInd(smin)}</text>
                {(r.refs ?? []).filter((v) => v > smin && v < smax).map((v) => <line key={v} x1={0} x2={plotW + 4} y1={sy(v)} y2={sy(v)} stroke="#334155" strokeDasharray="2 3" />)}
                {r.lines.map((l, li) => {
                  const arr = vals[li];
                  if (l.kind === "volume") {
                    return <g key={l.name}>{view.map((c, i) => (arr[i] == null ? null : <rect key={i} x={x(i) - body / 2} y={sy(arr[i]!)} width={body} height={Math.max(0.5, top + subHeight - sy(arr[i]!))} fill={c.c >= c.o ? UP : DOWN} fillOpacity={0.55} />))}</g>;
                  }
                  if (l.kind === "bar") {
                    const zero = sy(Math.max(smin, Math.min(smax, 0)));
                    return <g key={l.name}>{arr.map((v, i) => (v == null ? null : <rect key={i} x={x(i) - Math.max(0.5, body / 4)} y={Math.min(zero, sy(v))} width={Math.max(1, body / 2)} height={Math.max(0.5, Math.abs(sy(v) - zero))} fill={v >= 0 ? UP : DOWN} />))}</g>;
                  }
                  return poly(arr, sy).map((pts, k) => <polyline key={`${l.name}-${k}`} points={pts.join(" ")} fill="none" stroke={l.color} strokeWidth={1} />);
                })}
              </g>
            );
          })}

          {hover != null && hv && !mini && (
            <g pointerEvents="none">
              <line x1={x(hover)} x2={x(hover)} y1={padT} y2={height - padB} stroke="#7dd3fc" strokeOpacity={0.5} />
              <line x1={0} x2={plotW + 4} y1={y(hv.c)} y2={y(hv.c)} stroke="#7dd3fc" strokeOpacity={0.35} />
            </g>
          )}
        </svg>
      )}
    </div>
  );
}
