/**
 * 终端功能合并注册表
 *
 * 目标：
 * 1. 为重复入口提供一个 canonical 工作台，不复制数据请求。
 * 2. 保留旧 module/open 深链，旧链接只做归一化，不删除原功能。
 * 3. 只有已有真实页面/数据契约的入口才允许路由跳转；未知项继续留在
 *    原模块的专用分发逻辑中，不生成新的静态占位页。
 */

export type TerminalWorkspaceGroup =
  | "market"
  | "equity"
  | "commodity"
  | "index"
  | "forex"
  | "derivatives"
  | "news"
  | "economics"
  | "fund"
  | "crypto"
  | "professional";

export interface TerminalFeatureRegistration {
  /** 稳定的合并键；不是菜单编号，也不随显示名称变化。 */
  id: string;
  label: string;
  group: TerminalWorkspaceGroup;
  /** 终端内部的 canonical module。 */
  moduleId: string;
  /** 已有页面/工作台的 canonical URL。 */
  canonicalPath: string;
  /** 旧代码、旧中文入口或历史深链中的别名。 */
  aliases: readonly string[];
  /**
   * true 表示这个入口只做页面归一化，数据仍由已有页面自己的
   * live-feed/API 读取；false 表示交给 Terminal 的原有专用面板分发。
   */
  routeOnly?: boolean;
}

export const TERMINAL_FEATURE_REGISTRY: readonly TerminalFeatureRegistration[] = [
  {
    id: "market-data",
    label: "市场数据工作台",
    group: "market",
    moduleId: "market",
    canonicalPath: "/market",
    aliases: ["market", "market-center", "market-watch", "public-market", "quotes"],
    routeOnly: true,
  },
  {
    id: "equity-market",
    label: "股票/权益市场",
    group: "equity",
    moduleId: "stocks",
    canonicalPath: "/equity-market",
    aliases: ["equity", "equities", "equity-market", "stock-market", "stocks"],
    routeOnly: true,
  },
  {
    id: "commodity-market",
    label: "大宗商品市场",
    group: "commodity",
    moduleId: "commodities",
    canonicalPath: "/commodity-market",
    aliases: ["commodity", "commodities", "commodity-market", "commodity-futures", "fdm"],
    routeOnly: true,
  },
  {
    id: "index-market",
    label: "指数中心",
    group: "index",
    moduleId: "indices",
    canonicalPath: "/terminal?module=stocks&open=wei",
    aliases: ["index", "indices", "index-market", "index-hub", "global-index"],
    routeOnly: true,
  },
  {
    id: "forex-market",
    label: "外汇市场",
    group: "forex",
    moduleId: "forex",
    canonicalPath: "/forex-hub",
    aliases: ["fx", "forex", "forex-market", "forex-hub"],
    routeOnly: true,
  },
  {
    id: "derivatives-market",
    label: "衍生品市场",
    group: "derivatives",
    moduleId: "derivatives",
    canonicalPath: "/terminal?module=derivatives&open=fom",
    aliases: ["derivative", "derivatives", "options", "futures-options"],
    routeOnly: true,
  },
  {
    id: "news-research",
    label: "新闻与研究",
    group: "news",
    moduleId: "news",
    canonicalPath: "/news-hub?tab=top",
    aliases: ["news", "news-center", "news-hub", "news-research", "research"],
    routeOnly: true,
  },
  {
    id: "economic-analysis",
    label: "经济分析",
    group: "economics",
    moduleId: "economics",
    canonicalPath: "/econ-hub?tab=ecst",
    aliases: ["macro", "macro-analysis", "economic-analysis", "economics", "economy"],
    routeOnly: true,
  },
  {
    id: "fund-market",
    label: "基金",
    group: "fund",
    moduleId: "stocks",
    canonicalPath: "/fund-browse",
    // FSRC（基金筛选）在股市菜单中有自己的专属面板，不作为基金浏览页的别名。
    aliases: ["fund", "funds", "fund-browse"],
    routeOnly: true,
  },
  {
    id: "crypto-market",
    label: "加密货币",
    group: "crypto",
    moduleId: "stocks",
    canonicalPath: "/crypto-market",
    aliases: ["crypto", "cryptocurrency", "crypto-market", "digital-assets"],
    routeOnly: true,
  },
  {
    id: "portfolio-risk",
    label: "投资组合与风险",
    group: "professional",
    moduleId: "portfolio-management",
    canonicalPath: "/portfolio-optimizer",
    aliases: ["portfolio", "portfolio-management", "portfolio-risk", "risk-management"],
    routeOnly: true,
  },
];

const normalizedAliasMap = new Map<string, TerminalFeatureRegistration>();
for (const registration of TERMINAL_FEATURE_REGISTRY) {
  for (const alias of registration.aliases) {
    normalizedAliasMap.set(alias.trim().toLowerCase(), registration);
  }
}

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function findTerminalFeature(
  value: string | null | undefined
): TerminalFeatureRegistration | undefined {
  return normalizedAliasMap.get(normalize(value));
}

/**
 * 只归一化 module。具体 open 项仍交由原有专用分发器处理。
 */
export function canonicalizeTerminalModule(moduleId: string | null | undefined): string {
  return findTerminalFeature(moduleId)?.moduleId ?? (moduleId ?? "");
}

export interface CanonicalTerminalRoute {
  moduleId: string;
  itemId: string;
  canonicalPath?: string;
  registration?: TerminalFeatureRegistration;
}

/**
 * 给旧深链一个稳定入口。只有明确注册的顶层别名才会被改写；
 * 诸如 EQS、WEI、CFTC、OILS 等具体功能码不会被这里吞掉。
 */
export function resolveTerminalRoute(
  moduleId: string | null | undefined,
  open: string | null | undefined
): CanonicalTerminalRoute {
  const registration = findTerminalFeature(moduleId);
  if (!registration) {
    return { moduleId: moduleId || "sovereign-bonds", itemId: open || "" };
  }
  return {
    moduleId: registration.moduleId,
    itemId: open || "",
    canonicalPath: registration.canonicalPath,
    registration,
  };
}

/**
 * 对 Terminal 内“没有专用面板、但已有正式页面”的入口返回真实页面。
 * /menu-item/* 被刻意排除，避免把未知功能伪装成已接入。
 */
export function getCanonicalPathForTerminalItem(
  moduleId: string,
  itemId: string
): string | undefined {
  const normalizedModule = normalize(moduleId);
  const normalizedItem = normalize(itemId);

  // 跨菜单重复功能只允许进入一个真实工作台。这里必须在各模块
  // 的专用分发器之前执行，否则同一份数据会被复制成第二个面板。
  // 股市菜单的每个条目在 Terminal 的 stockPanelMap 中都有自己的专属面板
  // （IN 指数浏览器、ETF、FSRC 基金筛选、PORT、MOSO、TREN、基金、投资组合
  // 管理与风险等）。这里不能再把它们改写到共享页面，否则菜单名与打开的
  // 功能不一致。WEI 由 stockPanelMap 自己处理。
  const stockRoutes: Record<string, string> = {};
  if (normalizedModule === "stocks" || normalizedModule === "equity-market") {
    const path = stockRoutes[normalizedItem];
    if (path) return path;
  }

  const indexRoutes: Record<string, string> = {
    wei: "/terminal?module=stocks&open=wei",
    weif: "/index-hub?panel=WEIF",
    wbix: "/index-hub?panel=WBIX",
    gmm: "/index-hub?panel=GMM",
    in: "/index-hub?panel=IN",
    inp: "/index-hub?panel=INP",
    cix: "/index-hub?panel=CIX",
    cixb: "/index-hub?panel=CIXB",
    cixn: "/index-hub?panel=CIXN",
    cixs: "/index-hub?panel=CIXS",
    cixr: "/index-hub?panel=CIXR",
    cixc: "/index-hub?panel=CIXC",
    cixx: "/index-hub?panel=CIXX",
    cixi: "/index-hub?panel=CIXI",
    rrg: "/index-hub?panel=RRG",
  };
  if (normalizedModule === "indices" || normalizedModule === "index-market") {
    const path = indexRoutes[normalizedItem];
    if (path) return path;
  }

  // 外汇菜单的 FXC、WCR、WVOL、XCCY、FXSW、FXFC、FXCORR 等条目由
  // Terminal 的外汇分发器打开各自的专属面板；/forex-hub 不渲染这些面板，
  // 改写过去只会落到外汇中心总览，因此这里不做拦截。
  const forexRoutes: Record<string, string> = {};
  if (normalizedModule === "forex" || normalizedModule === "forex-market") {
    const path = forexRoutes[normalizedItem];
    if (path) return path;
  }

  const commodityRoutes: Record<string, string> = {
    // 商品行情主表只有一个 canonical 数据层；研究入口仍由商品模块自身
    // 处理 CFTC/OILS 等独立功能，不在这里复制一份行情表。
    market: "/commodity-market",
    futures: "/commodity-futures",
    derivatives: "/commodity-derivatives",
  };
  if (
    normalizedModule === "commodities" ||
    normalizedModule === "commodity-market"
  ) {
    const path = commodityRoutes[normalizedItem];
    if (path) return path;
  }

  // 这些菜单本身已经有正式工作台和 live-feed；Terminal 深链只需要
  // 选择对应的工作台标签，不应再创建一个 DynamicFunctionPanel。
  const newsTabs: Record<string, string> = {
    top: "top",
    btdy: "btdy",
    frnt: "frnt",
    cn: "cn",
    read: "read",
    ni: "ni",
    nh: "nh",
    firs: "firs",
    bi: "bi",
    beco: "beco",
    dayb: "dayb",
    mag: "mag",
    mdia: "media",
    medi: "medi",
    "3rd": "third",
    intl: "intl",
    cmnt: "commentary",
    opin: "opin",
    bnef: "bnef",
    pers: "personal",
    myn: "myn",
    nlrt: "nlrt",
    nsub: "nsub",
    mrep: "mrep",
    nzpd: "nzpd",
    socl: "social",
    soci: "soci",
    tren: "tren",
    docs: "docs",
  };
  if (
    normalizedModule === "news" ||
    normalizedModule === "news-research" ||
    normalizedModule === "news-center" ||
    normalizedModule === "news-hub"
  ) {
    const tab = newsTabs[normalizedItem];
    if (tab) return `/news-hub?tab=${encodeURIComponent(tab)}`;
    if (!normalizedItem) return "/news-hub?tab=top";
  }

  const economicTabs: Record<string, string> = {
    ecst: "ecst",
    eco: "eco",
    ectr: "ectr",
    wfii: "wfii",
    ecwb: "ecwb",
    rsan: "rsan",
    ecob: "ecob",
    ecfc: "ecfc",
    shok: "shok",
    wirp: "wirp",
    fcon: "fcon",
    ecsu: "ecsu",
    tayl: "tayl",
    ecan: "ecan",
    mosp: "mosp",
    cenb: "cenb",
    cbrt: "cbrt",
    fomc: "fomc",
    foms: "foms",
    fdsp: "fdsp",
    be: "be",
    beco: "beco",
    bie: "bie",
    pmi: "pmi",
  };
  if (
    normalizedModule === "economics" ||
    normalizedModule === "economic-analysis" ||
    normalizedModule === "macro" ||
    normalizedModule === "econ-hub"
  ) {
    const tab = economicTabs[normalizedItem];
    if (tab) return `/econ-hub?tab=${encodeURIComponent(tab)}`;
    if (!normalizedItem) return "/econ-hub?tab=ecst";
  }

  const registration = findTerminalFeature(normalizedItem);

  if (
    registration?.routeOnly &&
    (registration.moduleId === normalizedModule ||
      registration.group === normalizedModule ||
      registration.aliases.some(alias => normalize(alias) === normalizedModule))
  ) {
    return registration.canonicalPath;
  }
  return undefined;
}

