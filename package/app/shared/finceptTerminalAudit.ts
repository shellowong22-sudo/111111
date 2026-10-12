/**
 * FinceptTerminal archive audit.
 *
 * The attached archive is a Qt/C++ application with Python data connectors,
 * not a React page bundle.  Keep the archive facts separate from the runtime
 * bindings so the admin console never presents an inspected script as a
 * verified backend API.
 */
export type FinceptArchiveCategory = {
  id: string;
  label: string;
  scriptCount: number;
  functionCount: number;
  frontendOwner: string;
  frontendPath: string;
  boundary: "existing_route_only";
};

export type FinceptFrontendSurface = {
  id: string;
  label: string;
  screenFileCount: number;
  serviceFileCount: number;
  frontendPath: string | null;
  integration:
    | "existing_route_verified"
    | "existing_route_partial"
    | "inventory_only";
  note: string;
};

export const FINCEPT_TERMINAL_ARCHIVE_AUDIT = {
  archiveName: "FinceptTerminal-main (1).zip",
  archiveSha256:
    "176CBDF8383017059704D0346D46D53E3770B77BAC28D8E0B2D5E8A4DB1428A6",
  auditedAt: "2026-09-28T00:00:00.000Z",
  archiveEntryCount: 3969,
  /**
   * `pythonScriptCount` deliberately means root-level connector scripts.  The
   * archive also contains strategy, analytics and agent scripts; keeping those
   * counts separate prevents an admin user from reading a script inventory as
   * a number of live API integrations.
   */
  pythonScriptCount: 320,
  pythonScriptTotalCount: 1371,
  pythonFunctionCount: 4456,
  httpReferenceCount: 1056,
  scriptsWithCredentialHints: 177,
  qtScreenFileCount: 850,
  qtScreenDirectoryCount: 57,
  qtServiceFileCount: 360,
  qtServiceDirectoryCount: 43,
  strategyScriptCount: 448,
  analyticsScriptCount: 345,
  agentScriptCount: 178,
  note:
    "压缩包能力清单仅代表已检查代码；只有下方运行时绑定中的适配器才可由本系统执行。Qt 页面和服务源文件需要按现有 React 数据合同重新落地，不能直接当作浏览器页面。",
} as const;

/**
 * Counts are derived from the extracted fincept-qt/scripts directory.  They
 * describe the inspected script surface and are intentionally not treated as
 * live API success counts.
 */
export const FINCEPT_TERMINAL_ARCHIVE_CATEGORIES: readonly FinceptArchiveCategory[] =
  [
    {
      id: "equities",
      label: "股票/公司",
      scriptCount: 33,
      functionCount: 966,
      frontendOwner: "stock-eqs",
      frontendPath: "/terminal?open=eqs&module=stocks",
      boundary: "existing_route_only",
    },
    {
      id: "indices",
      label: "指数",
      scriptCount: 3,
      functionCount: 96,
      frontendOwner: "index-hub",
      frontendPath: "/index-hub?panel=WEI",
      boundary: "existing_route_only",
    },
    {
      id: "commodities",
      label: "大宗商品/能源",
      scriptCount: 16,
      functionCount: 127,
      frontendOwner: "commodity-market",
      frontendPath: "/menu-item/COMM",
      boundary: "existing_route_only",
    },
    {
      id: "futures",
      label: "期货/衍生品",
      scriptCount: 7,
      functionCount: 117,
      frontendOwner: "deri",
      frontendPath: "/deri",
      boundary: "existing_route_only",
    },
    {
      id: "options",
      label: "期权",
      scriptCount: 6,
      functionCount: 106,
      frontendOwner: "moso",
      frontendPath: "/moso",
      boundary: "existing_route_only",
    },
    {
      id: "funds-etf",
      label: "基金/ETF",
      scriptCount: 4,
      functionCount: 173,
      frontendOwner: "fund-browse",
      frontendPath: "/fund-browse",
      boundary: "existing_route_only",
    },
    {
      id: "forex",
      label: "外汇/央行汇率",
      scriptCount: 17,
      functionCount: 247,
      frontendOwner: "forex-hub",
      frontendPath: "/terminal?open=fxc&module=forex",
      boundary: "existing_route_only",
    },
    {
      id: "crypto",
      label: "加密货币",
      scriptCount: 12,
      functionCount: 138,
      frontendOwner: "crypto-market",
      frontendPath: "/crypto-market",
      boundary: "existing_route_only",
    },
    {
      id: "news",
      label: "新闻/研究",
      scriptCount: 10,
      functionCount: 80,
      frontendOwner: "news-hub",
      frontendPath: "/news-hub?tab=top",
      boundary: "existing_route_only",
    },
    {
      id: "macro",
      label: "宏观/经济",
      scriptCount: 49,
      functionCount: 714,
      frontendOwner: "econ-hub",
      frontendPath: "/econ-hub?tab=ecst",
      boundary: "existing_route_only",
    },
  ] as const;

/**
 * Major Qt screen domains found in the archive.  These are an inventory of
 * concrete frontend/service code, not a promise that the same Qt screen has
 * been copied into this React terminal.  `frontendPath` is only populated
 * where this application already has a matching route.
 */
export const FINCEPT_TERMINAL_FRONTEND_SURFACES: readonly FinceptFrontendSurface[] =
  [
    {
      id: "dashboard",
      label: "终端仪表盘",
      screenFileCount: 97,
      serviceFileCount: 0,
      frontendPath: "/",
      integration: "existing_route_partial",
      note: "已有终端首页；压缩包仪表盘组件未直接复制，数据仍按本平台唯一合同读取。",
    },
    {
      id: "economics",
      label: "经济与宏观",
      screenFileCount: 69,
      serviceFileCount: 4,
      frontendPath: "/econ-hub?tab=ecst",
      integration: "existing_route_verified",
      note: "已有经济数据中心，公开宏观观察按发布周期归档；不把月度/季度数据冒充实时行情。",
    },
    {
      id: "portfolio",
      label: "组合管理",
      screenFileCount: 52,
      serviceFileCount: 7,
      frontendPath: "/portfolio-optimizer",
      integration: "existing_route_partial",
      note: "已有组合与风险页面；压缩包的组合工作流仅作为能力参考，账户数据仍需用户授权。",
    },
    {
      id: "fno",
      label: "期货与期权",
      screenFileCount: 46,
      serviceFileCount: 0,
      frontendPath: "/deri",
      integration: "existing_route_verified",
      note: "FinMind 台湾期货进入 DERI，全球/中国商品期货仍进入商品期货，期权进入 MOSO；同一合约不会跨资产类别复制。",
    },
    {
      id: "crypto_center",
      label: "加密资产中心",
      screenFileCount: 43,
      serviceFileCount: 0,
      frontendPath: "/crypto-market",
      integration: "existing_route_partial",
      note: "已有加密资产页面；仅显示已验证的公开观察，授权交易和钱包功能不在此绑定。",
    },
    {
      id: "settings",
      label: "设置与账户",
      screenFileCount: 38,
      serviceFileCount: 0,
      frontendPath: "/settings",
      integration: "existing_route_partial",
      note: "已有设置入口；压缩包账户/订阅逻辑不写入行情数据合同。",
    },
    {
      id: "node_editor",
      label: "节点与工作流编辑器",
      screenFileCount: 30,
      serviceFileCount: 0,
      frontendPath: null,
      integration: "inventory_only",
      note: "压缩包确有前端源文件，但当前终端没有同等 React 数据合同，不新增页面。",
    },
    {
      id: "ai_quant_lab",
      label: "AI 量化实验室",
      screenFileCount: 28,
      serviceFileCount: 3,
      frontendPath: "/ucheer-ai",
      integration: "existing_route_partial",
      note: "现有 Ucheer AI 仅接入已配置模型与真实数据；量化实验室脚本不会自动变成可执行策略。",
    },
    {
      id: "data_sources",
      label: "数据源与连接器",
      screenFileCount: 27,
      serviceFileCount: 0,
      frontendPath: "/admin/openbb",
      integration: "existing_route_verified",
      note: "能力、密钥边界、运行成功和归档状态统一在 API 管理后台显示。",
    },
    {
      id: "polymarket",
      label: "预测市场",
      screenFileCount: 26,
      serviceFileCount: 5,
      frontendPath: null,
      integration: "inventory_only",
      note: "压缩包存在完整 Qt 预测市场代码；当前没有唯一的既有 React 功能合同，不伪造入口。",
    },
    {
      id: "crypto_trading",
      label: "加密交易",
      screenFileCount: 24,
      serviceFileCount: 0,
      frontendPath: "/crypto-market",
      integration: "existing_route_partial",
      note: "现有页面只承载公开行情观察；交易执行需要账户与授权，不以压缩包代码替代。",
    },
    {
      id: "surface_analytics",
      label: "波动率与曲面分析",
      screenFileCount: 23,
      serviceFileCount: 0,
      frontendPath: "/_derivatives-enhanced",
      integration: "existing_route_partial",
      note: "已有衍生品增强分析入口；缺少真实链数据时保留空状态，不生成曲面。",
    },
    {
      id: "agent_config",
      label: "代理与任务编排",
      screenFileCount: 22,
      serviceFileCount: 0,
      frontendPath: "/admin/ai-management",
      integration: "existing_route_partial",
      note: "后台已有模型/任务管理；压缩包代理定义不会绕过服务器权限或自动获得密钥。",
    },
    {
      id: "equity_research",
      label: "股票研究",
      screenFileCount: 21,
      serviceFileCount: 0,
      frontendPath: "/terminal?open=eqs&module=stocks",
      integration: "existing_route_verified",
      note: "股票基础资料和已验证快照进入 EQS；公司研究字段不复制到指数或新闻。",
    },
    {
      id: "news",
      label: "新闻与研究",
      screenFileCount: 20,
      serviceFileCount: 14,
      frontendPath: "/news-hub?tab=top",
      integration: "existing_route_partial",
      note: "文章进入既有新闻标签页，经清洗、分类和内容指纹去重；未验证连接器不投递。",
    },
    {
      id: "equity_trading",
      label: "股票交易",
      screenFileCount: 31,
      serviceFileCount: 0,
      frontendPath: "/terminal?open=eqs&module=stocks",
      integration: "existing_route_partial",
      note: "已有股票功能入口；压缩包交易执行代码不作为行情或成交事实来源。",
    },
    {
      id: "gov_data",
      label: "政府与官方数据",
      screenFileCount: 16,
      serviceFileCount: 2,
      frontendPath: "/econ-hub?tab=ecst",
      integration: "existing_route_partial",
      note: "官方统计按唯一宏观合同归档；数据发布频率和修订状态保留在后台。",
    },
    {
      id: "markets",
      label: "市场总览",
      screenFileCount: 9,
      serviceFileCount: 4,
      frontendPath: "/menu-item/COMM",
      integration: "existing_route_partial",
      note: "已有市场/商品总览；具体资产仍按股票、指数、商品、外汇等唯一归属分流。",
    },
    {
      id: "screener",
      label: "筛选器",
      screenFileCount: 2,
      serviceFileCount: 0,
      frontendPath: "/terminal?open=eqs&module=stocks",
      integration: "existing_route_verified",
      note: "筛选能力进入 EQS 既有面板，不新增独立页面。",
    },
    {
      id: "backtesting",
      label: "回测",
      screenFileCount: 7,
      serviceFileCount: 5,
      frontendPath: "/bquant",
      integration: "existing_route_partial",
      note: "已有量化/回测入口；没有历史数据合同时不生成回测曲线或收益。",
    },
    {
      id: "alpha_arena",
      label: "策略评估与竞赛",
      screenFileCount: 13,
      serviceFileCount: 28,
      frontendPath: null,
      integration: "inventory_only",
      note: "压缩包含策略评估与竞赛服务，但当前无对应既有 React 数据槽，不新增模块。",
    },
    {
      id: "chat_mode",
      label: "对话模式",
      screenFileCount: 13,
      serviceFileCount: 0,
      frontendPath: "/ucheer-ai",
      integration: "existing_route_partial",
      note: "对话能力统一走 Ucheer AI 后端模型配置，不复制 Qt 聊天界面。",
    },
  ] as const;

export const FINCEPT_TERMINAL_AUDIT_TOTALS = {
  ...FINCEPT_TERMINAL_ARCHIVE_AUDIT,
  categoryCount: FINCEPT_TERMINAL_ARCHIVE_CATEGORIES.length,
  frontendSurfaceCount: FINCEPT_TERMINAL_FRONTEND_SURFACES.length,
} as const;

export function assertFinceptTerminalAuditIntegrity() {
  if (
    FINCEPT_TERMINAL_ARCHIVE_AUDIT.archiveSha256.length !== 64 ||
    FINCEPT_TERMINAL_ARCHIVE_AUDIT.pythonScriptCount <= 0 ||
    FINCEPT_TERMINAL_ARCHIVE_AUDIT.pythonScriptTotalCount <
      FINCEPT_TERMINAL_ARCHIVE_AUDIT.pythonScriptCount ||
    FINCEPT_TERMINAL_ARCHIVE_AUDIT.qtScreenFileCount <= 0 ||
    FINCEPT_TERMINAL_ARCHIVE_AUDIT.qtServiceFileCount <= 0 ||
    FINCEPT_TERMINAL_ARCHIVE_AUDIT.pythonFunctionCount <= 0
  ) {
    throw new Error("FINCEPT_TERMINAL_AUDIT_INVALID");
  }
  const owners = FINCEPT_TERMINAL_ARCHIVE_CATEGORIES.map(
    category => category.frontendOwner
  );
  if (new Set(owners).size !== owners.length) {
    throw new Error("FINCEPT_TERMINAL_AUDIT_DUPLICATE_FRONTEND_OWNER");
  }
  const surfaceIds = FINCEPT_TERMINAL_FRONTEND_SURFACES.map(surface => surface.id);
  if (new Set(surfaceIds).size !== surfaceIds.length) {
    throw new Error("FINCEPT_TERMINAL_AUDIT_DUPLICATE_FRONTEND_SURFACE");
  }
  if (
    FINCEPT_TERMINAL_FRONTEND_SURFACES.some(
      surface =>
        surface.integration !== "inventory_only" && !surface.frontendPath
    )
  ) {
    throw new Error("FINCEPT_TERMINAL_AUDIT_MISSING_FRONTEND_PATH");
  }
  return true;
}

assertFinceptTerminalAuditIntegrity();
