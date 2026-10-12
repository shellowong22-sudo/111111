/**
 * 佑诚（Ucheer）数据模块：前后端共享模型。
 *
 * 管理后台的“zip 工作台”和前端的数据模块挂载点都只认这一份定义：
 * 后台保存前用这里的 zod 校验，前端渲染前同样校验，
 * 因此后台预览看到什么，前端就显示什么（同一个渲染器、同一份配置）。
 */
import { z } from "zod";

/* ------------------------------------------------------------------ 字段 */

export const UC_FIELD_TYPES = ["number", "percent", "date", "string"] as const;
export type UcFieldType = (typeof UC_FIELD_TYPES)[number];

export const UcField = z.object({
  /** 入库后的字段名（清洗后） */
  name: z.string().min(1).max(120),
  /** 原始文件里的列名 */
  source: z.string().max(240),
  type: z.enum(UC_FIELD_TYPES),
  /** 前端显示名 */
  label: z.string().max(120),
});
export type UcField = z.infer<typeof UcField>;

/** 来源类字段：一律不进入前端视图（需求 1）。 */
export const UC_SOURCE_FIELD_PATTERN = /^(source|sources|provider|vendor|origin|sourceurl|source_url|sourcename|source_name|数据来源|来源|出处|url|link|href)$/i;

/* ------------------------------------------------------------------ 管线规则 */

/** 格式转换（在类型识别之后执行，按顺序） */
export const UC_TRANSFORM_OPS = [
  { code: "scale", label: "乘以系数", param: "系数，如 0.0001（元→万元）" },
  { code: "round", label: "保留小数", param: "小数位" },
  { code: "abs", label: "取绝对值", param: "" },
  { code: "clip", label: "限定范围", param: "最小值,最大值" },
  { code: "percent_to_decimal", label: "百分数→小数", param: "" },
  { code: "decimal_to_percent", label: "小数→百分数", param: "" },
  { code: "replace", label: "文本替换", param: "查找|替换为" },
  { code: "regex_extract", label: "正则提取", param: "正则（取第 1 组）" },
  { code: "map", label: "值映射", param: "A=甲;B=乙" },
  { code: "upper", label: "转大写", param: "" },
  { code: "lower", label: "转小写", param: "" },
  { code: "prefix", label: "加前缀", param: "前缀" },
  { code: "suffix", label: "加后缀", param: "后缀" },
  { code: "date_format", label: "日期格式", param: "YYYY-MM-DD / YYYY-MM / YYYY" },
] as const;
export type UcTransformOp = (typeof UC_TRANSFORM_OPS)[number]["code"];
export const UcTransform = z.object({
  field: z.string(),
  op: z.enum(UC_TRANSFORM_OPS.map((o) => o.code) as [UcTransformOp, ...UcTransformOp[]]),
  param: z.string().max(500).default(""),
});
export type UcTransform = z.infer<typeof UcTransform>;

/** 行过滤：不满足条件的行不入库 */
export const UC_FILTER_OPS = [
  { code: "eq", label: "等于" }, { code: "ne", label: "不等于" }, { code: "gt", label: "大于" }, { code: "gte", label: "大于等于" },
  { code: "lt", label: "小于" }, { code: "lte", label: "小于等于" }, { code: "contains", label: "包含" }, { code: "not_contains", label: "不包含" },
  { code: "not_empty", label: "不为空" }, { code: "in", label: "属于（逗号分隔）" },
] as const;
export type UcFilterOp = (typeof UC_FILTER_OPS)[number]["code"];
export const UcFilter = z.object({
  field: z.string(),
  op: z.enum(UC_FILTER_OPS.map((o) => o.code) as [UcFilterOp, ...UcFilterOp[]]),
  value: z.string().max(500).default(""),
});
export type UcFilter = z.infer<typeof UcFilter>;

/** 计算字段：用已有字段做四则运算，例如 [收盘] / [开盘] * 100 - 100 */
export const UcDerived = z.object({
  name: z.string().min(1).max(60),
  label: z.string().max(60).default(""),
  expr: z.string().min(1).max(300),
  type: z.enum(["number", "percent"]).default("number"),
});
export type UcDerived = z.infer<typeof UcDerived>;

/** 人工修正：在后台数据浏览里改过的单元格 / 删除的行（按记录键定位，重跑后仍生效） */
export const UcOverride = z.object({
  key: z.string().max(255),
  field: z.string(),
  value: z.union([z.string(), z.number(), z.null()]),
});
export type UcOverride = z.infer<typeof UcOverride>;

export const UcCleaningRule = z.object({
  /** 原始列 → 字段；未列出的列按自动识别结果保留 */
  fields: z.array(UcField).default([]),
  /** 删除的原始列 */
  dropped: z.array(z.string()).default([]),
  /** 缺失值处理 */
  missing: z.enum(["keep", "drop_row", "fill_zero", "fill_previous"]).default("keep"),
  /** 去掉首尾空格、全角数字转半角、千分位 */
  trim: z.boolean().default(true),
  transforms: z.array(UcTransform).default([]),
  filters: z.array(UcFilter).default([]),
  derived: z.array(UcDerived).default([]),
  overrides: z.array(UcOverride).default([]),
  excludedKeys: z.array(z.string().max(255)).default([]),
});
export type UcCleaningRule = z.infer<typeof UcCleaningRule>;

export const UcDedupRule = z.object({
  keys: z.array(z.string()).default([]),
  strategy: z.enum(["latest", "earliest"]).default("latest"),
});
export type UcDedupRule = z.infer<typeof UcDedupRule>;

export const UC_MASK_METHODS = ["hide", "hash", "partial", "replace", "round"] as const;
export const UcMaskRule = z.object({
  field: z.string(),
  method: z.enum(UC_MASK_METHODS),
  /** replace 的替换值；round 的小数位；partial 保留的首尾字符数 */
  param: z.string().default(""),
  /** 作用范围：frontend 只对前端脱敏（后台可见原值）；everyone 后台也脱敏，只有“可查看原值”的角色能看 */
  scope: z.enum(["frontend", "everyone"]).default("frontend"),
});
export type UcMaskRule = z.infer<typeof UcMaskRule>;

/**
 * 推送方式：
 *  realtime 实时：入库即推送到前端
 *  schedule 定时：新版本先作为候选，按间隔或每天固定时间推送
 *  trigger  触发：新版本先作为候选，外部系统调用触发地址（或后台点“立即推送”）时推送
 */
export const UcPushConfig = z.object({
  mode: z.enum(["realtime", "schedule", "trigger"]).default("realtime"),
  everyMinutes: z.number().int().min(1).max(10080).default(60),
  /** 每天固定时间 HH:MM（北京时间），为空则按间隔 */
  at: z.string().regex(/^(|\d{2}:\d{2})$/).default(""),
  token: z.string().max(64).default(""),
});
export type UcPushConfig = z.infer<typeof UcPushConfig>;

export const UcPipelineConfig = z.object({
  cleaning: UcCleaningRule.default({ fields: [], dropped: [], missing: "keep", trim: true, transforms: [], filters: [], derived: [], overrides: [], excludedKeys: [] }),
  dedup: UcDedupRule.default({ keys: [], strategy: "latest" }),
  masking: z.array(UcMaskRule).default([]),
  /** true：入库为候选版本，需审核后才推送；false：入库即推送 */
  reviewRequired: z.boolean().default(false),
  push: UcPushConfig.default({ mode: "realtime", everyMinutes: 60, at: "", token: "" }),
});
export type UcPipelineConfig = z.infer<typeof UcPipelineConfig>;

/* ------------------------------------------------------------------ 模块 */

export const UC_TEMPLATES = [
  { code: "table", label: "表格", needs: "任意字段" },
  { code: "line", label: "折线 / 面积", needs: "日期 + 数值" },
  { code: "bar", label: "柱状", needs: "分类 + 数值" },
  { code: "kline", label: "K线", needs: "日期 + 开高低收" },
  { code: "yieldCurve", label: "收益率曲线", needs: "期限 + 收益率" },
  { code: "heatmap", label: "热力图", needs: "分类 + 数值（涨跌）" },
  { code: "statCard", label: "指标卡", needs: "名称 + 数值" },
  { code: "newsList", label: "新闻列表", needs: "标题 + 时间" },
  { code: "calendar", label: "日历", needs: "日期 + 事件" },
  { code: "liveBoard", label: "实时行情K线", needs: "代码（实时跳动）" },
] as const;
export type UcTemplateCode = (typeof UC_TEMPLATES)[number]["code"];
export const UcTemplateCodeSchema = z.enum(UC_TEMPLATES.map((t) => t.code) as [UcTemplateCode, ...UcTemplateCode[]]);

/** 模板槽位 → 字段名。不同模板用到不同的槽位。 */
export const UcBindings = z.object({
  x: z.string().optional(), // 日期 / 分类 / 期限 / 名称
  series: z.array(z.string()).default([]), // 一个或多个数值字段
  open: z.string().optional(),
  high: z.string().optional(),
  low: z.string().optional(),
  close: z.string().optional(),
  volume: z.string().optional(),
  title: z.string().optional(), // 新闻标题、日历事件
  time: z.string().optional(),
  summary: z.string().optional(),
  columns: z.array(z.string()).default([]), // 表格列；空 = 全部
  symbol: z.string().optional(), // 实时行情：代码字段
});
export type UcBindings = z.infer<typeof UcBindings>;

export const UcModuleParams = z.object({
  title: z.string().max(120).default(""),
  subtitle: z.string().max(240).default(""),
  /** 只取最近 N 条（0 = 全部） */
  limit: z.number().int().min(0).max(100000).default(0),
  sortBy: z.string().optional(),
  sortDir: z.enum(["asc", "desc"]).default("asc"),
  area: z.boolean().default(false),
  stacked: z.boolean().default(false),
  decimals: z.number().int().min(0).max(8).default(2),
  unit: z.string().max(20).default(""),
  height: z.number().int().min(160).max(900).default(320),
  /** 前端可用的交互 */
  allowExport: z.boolean().default(true),
  allowSearch: z.boolean().default(true),
  allowRange: z.boolean().default(true),
  /** 实时行情 K 线周期 */
  period: z.enum(["1m", "5m", "15m", "60m", "1d", "1w", "1M"]).default("5m"),
});
export type UcModuleParams = z.infer<typeof UcModuleParams>;

export const UcModuleDefinition = z.object({
  code: z.string().regex(/^[a-z0-9][a-z0-9_-]{1,63}$/),
  name: z.string().min(1).max(120),
  datasetId: z.number().int().positive(),
  template: UcTemplateCodeSchema,
  bindings: UcBindings,
  params: UcModuleParams,
  slotId: z.string(),
  /** 多数据源组合：union 追加行；join 按字段把其他数据集的列拼到主数据集 */
  combine: z.array(z.object({
    datasetId: z.number().int().positive(),
    mode: z.enum(["union", "join"]).default("union"),
    on: z.string().default(""),
    prefix: z.string().max(20).default(""),
  })).default([]),
});
export type UcModuleDefinition = z.infer<typeof UcModuleDefinition>;

/* ------------------------------------------------------------------ 前端挂载位置 */

/**
 * 22 个核心功能（见方案“需求 2”）。每个功能对应前端一个或多个现有页面路径；
 * 已发布的模块会出现在这些页面的“佑诚数据”面板里。/terminal 为“我的看板”。
 */
export const UC_SLOTS = [
  { id: "fi.rates", group: "固定收益", label: "利率与收益率曲线", paths: ["/yield-curve", "/interest-rates", "/curves-list"] },
  { id: "fi.credit", group: "固定收益", label: "信用与利差", paths: ["/credit-analysis", "/credit-ratings", "/credit-monitor"] },
  { id: "fi.mortgage", group: "固定收益", label: "抵押与结构化", paths: ["/fixed-income"] },
  { id: "fi.money", group: "固定收益", label: "货币市场与回购", paths: ["/rate-trader"] },
  { id: "fi.muni", group: "固定收益", label: "地方债", paths: ["/bond-market"] },
  { id: "fi.preferred", group: "固定收益", label: "优先股与混合资本", paths: ["/secondary-markets"] },
  { id: "eq.stocks", group: "权益与衍生品", label: "股票与行业", paths: ["/equity-market", "/sector-analysis", "/industry-group"] },
  { id: "eq.index", group: "权益与衍生品", label: "指数与 ETF", paths: ["/index-hub", "/fund-browse"] },
  { id: "eq.commodity", group: "权益与衍生品", label: "大宗商品", paths: ["/commodity-market", "/commodity-prices", "/energy-market", "/precious-metals"] },
  { id: "eq.fx", group: "权益与衍生品", label: "外汇", paths: ["/forex-hub", "/forex-curves"] },
  { id: "eq.derivatives", group: "权益与衍生品", label: "衍生品与波动率", paths: ["/derivatives-trader", "/wvol", "/ovml"] },
  { id: "macro.data", group: "宏观与资讯", label: "宏观数据", paths: ["/econ-hub", "/macro-dashboard"] },
  { id: "macro.calendar", group: "宏观与资讯", label: "财经日历", paths: ["/econ-hub"] },
  { id: "macro.news", group: "宏观与资讯", label: "新闻与研究协作", paths: ["/news-hub", "/comms-hub"] },
  { id: "pr.portfolio", group: "组合与风险", label: "组合分析与回测", paths: ["/portfolio-optimizer", "/asset-allocation"] },
  { id: "pr.risk", group: "组合与风险", label: "定价与风险", paths: ["/pricing-risk", "/risk-management"] },
  { id: "pr.scenario", group: "组合与风险", label: "情景与压力测试", paths: ["/pricing-risk"] },
  { id: "tr.orders", group: "交易工作台", label: "订单与执行", paths: ["/order-management", "/electronic-trading"] },
  { id: "tr.settlement", group: "交易工作台", label: "清算结算与账簿", paths: ["/stp-processing", "/trade-book"] },
  { id: "tool.ai", group: "智能与工具", label: "Ucheer AI", paths: ["/ucheer-ai"] },
  { id: "tool.board", group: "智能与工具", label: "我的看板", paths: ["/terminal", "/", "/home"] },
  { id: "tool.alerts", group: "智能与工具", label: "预警与导出", paths: ["/settings"] },
] as const;
export type UcSlotId = (typeof UC_SLOTS)[number]["id"];

export function ucSlotsForPath(pathname: string): string[] {
  const path = pathname.split("?")[0].replace(/\/+$/, "") || "/";
  return UC_SLOTS.filter((slot) => (slot.paths as readonly string[]).includes(path)).map((slot) => slot.id);
}

/* ------------------------------------------------------------------ 前端响应 */

/** 前端拿到的模块（不含任何来源信息）。 */
export type UcPublishedModule = {
  code: string;
  name: string;
  version: number;
  slotId: string;
  template: UcTemplateCode;
  bindings: UcBindings;
  params: UcModuleParams;
  fields: Array<Pick<UcField, "name" | "type" | "label">>;
  rows: Array<Record<string, string | number | null>>;
  updatedAt: string;
};

/** 自动推荐模板与字段绑定（后台“一键生成”使用，前端不调用）。 */
export function suggestTemplate(fields: Array<Pick<UcField, "name" | "type" | "label">>): {
  template: UcTemplateCode;
  bindings: UcBindings;
} {
  const lower = (f: { name: string; label: string }) => `${f.name} ${f.label}`.toLowerCase();
  const find = (re: RegExp) => fields.find((f) => re.test(lower(f)))?.name;
  const date = fields.find((f) => f.type === "date")?.name;
  const numbers = fields.filter((f) => f.type === "number" || f.type === "percent").map((f) => f.name);
  const strings = fields.filter((f) => f.type === "string").map((f) => f.name);
  const open = find(/(^|[^a-z])open|开盘/);
  const high = find(/(^|[^a-z])high|最高/);
  const low = find(/(^|[^a-z])low|最低/);
  const close = find(/(^|[^a-z])close|收盘|price|最新价/);
  const volume = find(/volume|vol\b|成交量/);
  const empty: UcBindings = { series: [], columns: [] };
  // 行情代码表（代码 + 最新价）：用实时行情 K 线模板，前端价格与 K 线实时跳动
  const symbol = find(/^代码|^symbol|^ticker|证券代码|股票代码/);
  const last = find(/最新价|last|price|现价/);
  if (symbol && last && !(date && open && high && low && close)) {
    return { template: "liveBoard", bindings: { ...empty, symbol, x: symbol, title: find(/名称|name/) } };
  }
  if (date && open && high && low && close) {
    return { template: "kline", bindings: { ...empty, x: date, open, high, low, close, volume } };
  }
  const title = find(/title|headline|标题|新闻|事件|event/);
  const summaryField = find(/summary|abstract|content|摘要|正文/);
  if (title && (date || find(/time|时间/) || summaryField)) {
    const time = date ?? find(/time|时间/);
    const summary = summaryField;
    return { template: "newsList", bindings: { ...empty, title, time, summary } };
  }
  const tenor = find(/tenor|maturity|term|期限/);
  const yieldField = find(/yield|rate|收益率|利率/);
  if (tenor && yieldField && !date) {
    return { template: "yieldCurve", bindings: { ...empty, x: tenor, series: [yieldField] } };
  }
  if (date && numbers.length) {
    return { template: "line", bindings: { ...empty, x: date, series: numbers.slice(0, 4) } };
  }
  if (strings.length && numbers.length && fields.length <= 6) {
    return { template: "bar", bindings: { ...empty, x: strings[0], series: numbers.slice(0, 3) } };
  }
  return { template: "table", bindings: empty };
}
