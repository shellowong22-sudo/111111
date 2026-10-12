import { z } from "zod";

export const AKSHARE_ROUTE_TARGETS = [
  "stock-eqs",
  "index-hub",
  "commodity-market",
  "fund-browse",
  "commodity-futures",
  "moso",
  "forex-hub",
  "bond-market",
  "news-top",
  "economic-ecst",
] as const;

export type AkShareRouteTarget = (typeof AKSHARE_ROUTE_TARGETS)[number];
export type AkShareRouteDecision = {
  operation: string;
  route: AkShareRouteTarget;
  contract: string;
  frontendPath: string;
  decision: "bind";
  confidence: number;
  evaluatedBy: "typesafe" | "deterministic";
  reason: string;
};

const decisionSchema = z.object({
  route: z.enum(AKSHARE_ROUTE_TARGETS),
  confidence: z.number().min(0).max(1),
});

const ROUTES: Record<string, { route: AkShareRouteTarget; frontendPath: string; contract: string; reason: string }> = {
  stock_snapshot: { route: "stock-eqs", frontendPath: "/terminal?open=eqs&module=stocks", contract: "equity.cn.a.snapshot.akshare.v1", reason: "股票快照只进入已有股票筛选/股票数据面板。" },
  stock_directory: { route: "stock-eqs", frontendPath: "/terminal?open=eqs&module=stocks", contract: "equity.cn.directory.akshare.v1", reason: "股票代码与名称目录只进入已有 EQS 标的选择器；不复制到指数或基金。" },
  hk_stock_snapshot: { route: "stock-eqs", frontendPath: "/terminal?open=eqs&module=stocks", contract: "equity.hk.snapshot.akshare.v1", reason: "港股快照只进入已有股票数据面板；不新增港股页面。" },
  us_stock_snapshot: { route: "stock-eqs", frontendPath: "/terminal?open=eqs&module=stocks", contract: "equity.us.snapshot.akshare.v1", reason: "美股快照只进入已有股票数据面板；不复制到指数面板。" },
  cn_index_snapshot: { route: "index-hub", frontendPath: "/index-hub?panel=WEI", contract: "index.cn.snapshot.akshare.v1", reason: "中国指数快照只进入已有指数中心。" },
  global_index_snapshot: { route: "index-hub", frontendPath: "/index-hub?panel=WEI", contract: "index.global.snapshot.akshare.v1", reason: "指数快照只进入已有全球股票指数面板。" },
  etf_snapshot: { route: "fund-browse", frontendPath: "/fund-browse", contract: "fund.etf.snapshot.akshare.v1", reason: "ETF 交易日单位净值只进入已有基金浏览面板，不冒充成交价。" },
  fund_snapshot: { route: "fund-browse", frontendPath: "/fund-browse", contract: "fund.open.snapshot.akshare.v1", reason: "开放式基金净值只进入已有基金浏览面板。" },
  forex_snapshot: { route: "forex-hub", frontendPath: "/forex-hub", contract: "fx.cn.snapshot.akshare.v1", reason: "外汇快照只进入已有外汇中心；不新增外汇页面。" },
  futures_snapshot: { route: "commodity-futures", frontendPath: "/commodity-futures", contract: "derivatives.global.futures.snapshot.akshare.v1", reason: "期货快照只进入已有商品期货面板。" },
  futures_cn_snapshot: { route: "commodity-futures", frontendPath: "/commodity-futures", contract: "derivatives.cn.futures.snapshot.akshare.v1", reason: "中国期货快照只进入已有商品期货面板。" },
  futures_inventory: { route: "commodity-futures", frontendPath: "/commodity-futures", contract: "derivatives.cn.futures.inventory.akshare.v1", reason: "沪铜库存只进入已有期货研究面板；库存序列不复制为行情或 CFTC 持仓。" },
  options_snapshot: { route: "moso", frontendPath: "/moso", contract: "derivatives.cn.options.snapshot.akshare.v1", reason: "期权快照只进入已有活跃期权面板。" },
  bond_curve: { route: "bond-market", frontendPath: "/bond-market", contract: "rates.cn-us.bond-curve.akshare.v1", reason: "公开国债收益率曲线只进入已有债券市场研究面板；不当作实时交易盘口。" },
  news_publication: { route: "news-top", frontendPath: "/news-hub?tab=top", contract: "news.public.publication.akshare.v1", reason: "新闻只进入已有新闻与研究中心的 TOP 标签页；不复制到其他新闻子页。" },
  economic_gdp: { route: "economic-ecst", frontendPath: "/econ-hub?tab=ecst", contract: "macro.cn.gdp.akshare.v1", reason: "宏观 GDP 只进入已有经济数据中心 ECST 指标行。" },
  economic_cpi: { route: "economic-ecst", frontendPath: "/econ-hub?tab=ecst", contract: "macro.cn.cpi.akshare.v1", reason: "宏观 CPI 只进入已有经济数据中心 ECST 指标行。" },
  economic_pmi: { route: "economic-ecst", frontendPath: "/econ-hub?tab=ecst", contract: "macro.cn.pmi.akshare.v1", reason: "宏观 PMI 只进入已有经济数据中心 ECST 指标行。" },
  macro_semiconductor_index: { route: "index-hub", frontendPath: "/index-hub?panel=WEI", contract: "index.global.sox.akshare.v1", reason: "费城半导体指数历史只进入已有全球指数面板；不复制到经济指标。" },
  macro_shipping_bdi: { route: "commodity-market", frontendPath: "/menu-item/COMM", contract: "commodity.global.bdi.akshare.v1", reason: "波罗的海干散货指数只进入已有大宗商品面板；不伪装成现货价格。" },
  macro_japan_bank_rate: { route: "economic-ecst", frontendPath: "/econ-hub?tab=ecst", contract: "rates.jp.bank-policy.akshare.v1", reason: "日本央行政策利率历史只进入已有经济分析指标区，发布周期不标为实时行情。" },
  macro_uk_bank_rate: { route: "economic-ecst", frontendPath: "/econ-hub?tab=ecst", contract: "rates.uk.bank-policy.akshare.v1", reason: "英格兰银行政策利率历史只进入已有经济分析指标区，发布周期不标为实时行情。" },
  news_cctv: { route: "news-top", frontendPath: "/news-hub?tab=top", contract: "news.cn.cctv.akshare.v1", reason: "央视财经公开新闻只进入已有新闻与研究 TOP 标签页，并按文章内容去重。" },
};

export function routeAkShareCapability(operation: string): AkShareRouteDecision | null {
  const selected = ROUTES[operation];
  if (!selected) return null;
  // This is the deterministic fallback for the TypeSafe-shaped judgment. The
  // allow-list remains the final authority, so no model output can create a
  // new module or contract. The existing TypeSafe news router can be enabled
  // independently for semantic dedupe without changing this data contract.
  return { operation, ...selected, decision: "bind", confidence: 1, evaluatedBy: "deterministic" };
}

export function listAkShareRouteDecisions() {
  return Object.keys(ROUTES).map(operation => routeAkShareCapability(operation)).filter(
    (item): item is AkShareRouteDecision => item !== null,
  );
}
