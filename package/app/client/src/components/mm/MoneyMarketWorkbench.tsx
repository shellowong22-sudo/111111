import React, { createContext, useContext, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

type Tone = "pos" | "neg" | "warn" | "info" | "neutral" | "crit" | undefined;

type SnapshotShape = {
  rates?: Array<{ status?: string; history?: Array<unknown> }>;
  sources?: Array<unknown>;
  treasuryAuctions?: Array<unknown>;
  fundingTape?: Array<unknown>;
};

const MODULE_PATHS: Record<string, string> = {
  "des-mm": "/terminal?open=des-mm&module=money-market",
  pgm: "/terminal?open=pgm&module=money-market",
  mktbeat: "/terminal?open=mktbeat&module=money-market",
  btmm: "/terminal?open=btmm&module=money-market",
  boom: "/terminal?open=boom&module=money-market",
  tcon: "/terminal?open=tcon&module=money-market",
  rv: "/terminal?open=rv&module=money-market",
  ycqsim: "/terminal?open=ycqsim&module=money-market",
  gc: "/terminal?open=gc&module=money-market",
  "crvf-mmkt": "/terminal?open=crvf-mmkt&module=money-market",
  crvf: "/terminal?open=crvf&module=money-market",
  fibc: "/terminal?open=fibc&module=money-market",
  cdie: "/terminal?open=cdie&module=money-market",
  efsf: "/terminal?open=efsf&module=money-market",
  mmidx: "/terminal?open=mmidx&module=money-market",
  etrade: "/terminal?open=etrade&module=money-market",
  edsf: "/terminal?open=edsf&module=money-market",
  wbf: "/terminal?open=wbf&module=money-market",
  pboc: "/terminal?open=pboc&module=money-market",
  twdi: "/terminal?open=twdi&module=money-market",
  cenb: "/terminal?open=cenb&module=money-market",
  "news-mm": "/terminal?open=news-mm&module=money-market",
  "source-mm": "/terminal?open=source-mm&module=money-market",
  mmflow: "/terminal?open=mmflow&module=money-market",
};

const MODULE_MODES: Record<string, string> = {
  "des-mm": "dictionary",
  pgm: "pipeline",
  mktbeat: "pulse",
  btmm: "supply",
  boom: "calendar",
  tcon: "corridor",
  rv: "pair",
  ycqsim: "surface",
  gc: "canvas",
  "crvf-mmkt": "browser",
  crvf: "atlas",
  fibc: "calculator",
  cdie: "compound",
  efsf: "evidence",
  mmidx: "dispersion",
  etrade: "ticket",
  edsf: "lifecycle",
  wbf: "basis",
  pboc: "operations",
  twdi: "fixing",
  cenb: "network",
  "news-mm": "reader",
  "source-mm": "observability",
  mmflow: "delivery",
};

const ModuleContext = createContext({ moduleId: "des-mm", ticker: "DES" });

function cleanBusinessText(value: unknown) {
  return String(value ?? "")
    .replace(
      /(?:后台|管理端|人工定向推送|爬虫|crawler|模块\s*ID|moduleId|映射|targetPath|strategyKey|promptKey)\s*[:：]?[^。；\n]*/gi,
      ""
    )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function MoneyMarketWorkbench({
  moduleId,
  ticker,
  number,
  title,
  subtitle,
  snapshot,
  children,
}: {
  moduleId: string;
  ticker: string;
  number: number;
  title: string;
  subtitle: string;
  snapshot?: SnapshotShape;
  children: React.ReactNode;
}) {
  return (
    <ModuleContext.Provider value={{ moduleId, ticker }}>
      <main
        className="mm-workbench"
        data-mm-module={moduleId}
        data-mm-mode={MODULE_MODES[moduleId] ?? "terminal"}
      >
        <header className="mm-workbench__masthead">
          <div className="mm-workbench__identity">
            <span className="mm-workbench__sequence">
              {String(number).padStart(2, "0")}
            </span>
            <span className="mm-workbench__ticker">{ticker}</span>
            <div className="min-w-0">
              <h2>{title}</h2>
              <p>{subtitle}</p>
            </div>
          </div>
          <div className="mm-workbench__status" aria-label="当前数据连接状态" />
        </header>
        <div className="mm-workbench__content">{children}</div>
      </main>
    </ModuleContext.Provider>
  );
}

export function MoneyMarketSection({
  title,
  children,
  className,
  action,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  const { ticker } = useContext(ModuleContext);
  return (
    <section className={cn("mm-desk-section", className)}>
      {title && (
        <header className="mm-desk-section__header">
          <span aria-hidden="true">{ticker}</span>
          <h3>{title}</h3>
          {action && <div>{action}</div>}
        </header>
      )}
      <div className="mm-desk-section__body">{children}</div>
    </section>
  );
}

const TONE_CLASS: Record<Exclude<Tone, undefined>, string> = {
  pos: "is-positive",
  neg: "is-negative",
  warn: "is-warning",
  info: "is-information",
  neutral: "is-neutral",
  crit: "is-critical",
};

function sparkline(values: number[]) {
  if (values.length < 2) return "";
  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = high - low || 1;
  return values
    .map(
      (value, index) =>
        `${(index / (values.length - 1)) * 100},${24 - ((value - low) / span) * 20}`
    )
    .join(" ");
}

export function MoneyMarketDatum({
  label,
  value,
  unit,
  tone,
  className,
  sub,
  trend,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  tone?: Tone;
  className?: string;
  sub?: React.ReactNode;
  trend?: number[];
}) {
  const [open, setOpen] = useState(false);
  const series = (trend ?? []).filter(Number.isFinite).slice(-60);
  const inspectable = series.length > 1;
  const content = (
    <>
      <span className="mm-datum__label">{label}</span>
      <strong>
        {value}
        {unit && <small>{unit}</small>}
      </strong>
      {inspectable && (
        <svg
          viewBox="0 0 100 28"
          preserveAspectRatio="none"
          aria-label={`${label}历史轨迹`}
        >
          <polyline points={sparkline(series)} />
        </svg>
      )}
      {sub && <span className="mm-datum__sub">{sub}</span>}
      {open && inspectable && (
        <span className="mm-datum__drilldown">
          <i>低 {Math.min(...series).toFixed(3)}</i>
          <i>高 {Math.max(...series).toFixed(3)}</i>
          <i>区间 {series.length} 点</i>
        </span>
      )}
    </>
  );
  const classes = cn(
    "mm-datum",
    tone && TONE_CLASS[tone],
    inspectable && "is-inspectable",
    className
  );
  return inspectable ? (
    <button
      type="button"
      className={classes}
      onClick={() => setOpen(value => !value)}
      aria-expanded={open}
    >
      {content}
    </button>
  ) : (
    <div className={classes}>{content}</div>
  );
}

export function MoneyMarketBadge({
  children,
  tone,
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span className={cn("mm-badge", tone && TONE_CLASS[tone], className)}>
      {children}
    </span>
  );
}
