import { useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { PREFERRED_STOCK_CAPABILITIES } from "@shared/threeModuleCapabilityCatalog";

type ModuleId = (typeof PREFERRED_STOCK_CAPABILITIES)[number]["id"];
type InputDefinition = { key: string; label: string; unit: string; source: string };
type Definition = {
  method: string;
  result: string;
  required: Array<[string, string, string]>;
  inputs?: InputDefinition[];
  calculate?: (values: Record<string, number>) => { value: number; unit: string; formula: string } | null;
};

export function solvePreferredAnnualYield(
  currentPrice: number,
  annualDistribution: number,
  redemptionValue: number,
  years: number,
) {
  if (
    !Number.isFinite(currentPrice) || currentPrice <= 0 ||
    !Number.isFinite(annualDistribution) || annualDistribution < 0 ||
    !Number.isFinite(redemptionValue) || redemptionValue < 0 ||
    !Number.isInteger(years) || years < 1 || years > 100 ||
    annualDistribution + redemptionValue <= 0
  ) return null;

  const difference = (rate: number) => {
    let presentValue = 0;
    for (let period = 1; period <= years; period += 1) {
      presentValue += annualDistribution / ((1 + rate) ** period);
    }
    presentValue += redemptionValue / ((1 + rate) ** years);
    return presentValue - currentPrice;
  };

  let low = -0.9999;
  let high = 1;
  while (difference(high) > 0 && high < 128) high *= 2;
  if (difference(low) < 0 || difference(high) > 0) return null;
  for (let iteration = 0; iteration < 160; iteration += 1) {
    const midpoint = (low + high) / 2;
    if (difference(midpoint) > 0) low = midpoint;
    else high = midpoint;
  }
  return ((low + high) / 2) * 100;
}

const DEFINITIONS: Record<ModuleId, Definition> = {
  secf: { method: "账户条款规则筛选", result: "覆盖、缺口及规则判定", required: [["securityIdentifier", "账户条款", "证券唯一标识"], ["sourceReference", "条款证据", "可追溯原文定位"]] },
  dat: { method: "同一时点报价一致性校验", result: "买卖价差、场所与时效状态", required: [["bid/ask/last", "授权行情源", "价格、币种和市场时间"], ["receivedTimestamp", "行情接入层", "接收时间和延迟"]] },
  inf: { method: "逐档订单簿累积与缺口检查", result: "价差、累计深度与不平衡", required: [["bidLevels/askLevels", "授权订单簿", "档位价格和数量"], ["sequence", "订单簿事件流", "去重和乱序校验"]] },
  fit: { method: "用户成交相对决策基准复核", result: "有向价格差额、费用与累计成本", required: [["fills", "用户载入成交", "订单、成交、方向、数量、价格"], ["benchmark", "用户决策记录", "同币种决策基准"]] },
  psch: { method: "权威文件条款抽取与逐字段复核", result: "结构化条款与原文证据", required: [["sourceReference", "SEC/发行人文件", "文件、版本和原文定位"], ["asOfDate", "条款版本", "有效时点"]] },
  wb: { method: "票面分配规则标准化", result: "固定、浮动与重置现金流规则", required: [["couponRatePct", "核验发行条款", "固定分配率"], ["referenceIndex/spreadBps", "核验发行条款", "浮动基准与加点"]] },
  eds: { method: "登记日、除息日与支付日事件对账", result: "已付、递延与拖欠记录", required: [["recordDate/payableDate", "发行人或交易所公告", "关键日期"], ["amount/status", "实际支付记录", "金额、币种和状态"]] },
  app: { method: "未付股息权利滚存", result: "累积余额及清偿条件", required: [["cumulativeFlag", "核验发行条款", "累积/非累积"], ["arrearsAmount", "发行人披露", "拖欠金额和时点"]] },
  sop: { method: "参与分配瀑布复算", result: "基础分配与超额参与", required: [["participationFlag", "核验发行条款", "参与属性"], ["participationFormula", "核验发行条款", "门槛、比例与上限"]] },
  case: { method: "转换窗口与触发条件校验", result: "可转换状态及调整后比率", required: [["conversionRatio", "核验发行条款", "转换比率"], ["conversionWindow/trigger", "核验发行条款", "窗口和触发事件"]] },
  pord: {
    method: "首赎窗口现金流复算", result: "持有至赎回的简化年化回报", required: [["firstCallDate", "核验发行条款", "首赎日"], ["callPrice", "核验发行条款", "赎回价和币种"], ["currentPrice", "授权行情源", "当前净价和市场时间"]],
    inputs: [["currentPrice", "当前净价", "价格", "授权行情或用户情景"], ["callPrice", "赎回价", "价格", "核验发行条款"], ["annualDistribution", "年化现金分配", "金额", "核验现金流"], ["years", "距赎回年数", "年", "首赎日与估值日"]].map(([key, label, unit, source]) => ({ key, label, unit, source })),
    calculate: v => v.currentPrice > 0 && v.years > 0 ? { value: ((v.annualDistribution * v.years + v.callPrice - v.currentPrice) / v.currentPrice / v.years) * 100, unit: "%/年", formula: "(期间分配 + 赎回价 - 当前净价) / 当前净价 / 年数" } : null,
  },
  aid: { method: "回售日期、价格和触发事件复核", result: "投资者回售选择权状态", required: [["putDate/putPrice", "核验发行条款", "回售日与价格"], ["putTrigger", "核验发行条款", "触发条件"]] },
  cma: {
    method: "标的价格乘转换比率", result: "转股内在价值", required: [["underlyingPrice", "授权标的行情", "标的价格、币种和市场时间"], ["conversionRatio", "核验发行条款", "有效转换比率"]],
    inputs: [["underlyingPrice", "标的价格", "价格", "授权行情或用户情景"], ["conversionRatio", "转换比率", "股/优先股", "核验发行条款"]].map(([key, label, unit, source]) => ({ key, label, unit, source })),
    calculate: v => v.underlyingPrice >= 0 && v.conversionRatio >= 0 ? { value: v.underlyingPrice * v.conversionRatio, unit: "价格", formula: "标的价格 × 有效转换比率" } : null,
  },
  viz: {
    method: "优先股净价相对转股价值", result: "转换溢价", required: [["preferredPrice", "授权优先股行情", "净价和市场时间"], ["conversionValue", "转股价值工作台", "同币种同时间点"]],
    inputs: [["preferredPrice", "优先股净价", "价格", "授权行情或用户情景"], ["conversionValue", "转股价值", "价格", "转股价值工作台"]].map(([key, label, unit, source]) => ({ key, label, unit, source })),
    calculate: v => v.conversionValue > 0 ? { value: (v.preferredPrice / v.conversionValue - 1) * 100, unit: "%", formula: "(优先股净价 / 转股价值 - 1) × 100" } : null,
  },
  prc: {
    method: "逐期现金流折现并按赎回/到期假设求根", result: "简化年化到期或赎回收益率", required: [["cleanPrice", "授权优先股行情", "净价、币种和时点"], ["cashflows", "核验条款", "金额、日期和日历"], ["redemptionAssumption", "用户情景", "赎回或到期假设"]],
    inputs: [["price", "当前净价", "价格", "授权行情或用户情景"], ["annualDistribution", "年末现金分配", "金额/年", "核验现金流或用户情景"], ["redemptionValue", "期末偿还金额", "金额", "核验条款或用户情景"], ["years", "剩余整年期数", "年", "估值日与到期/赎回假设"]].map(([key, label, unit, source]) => ({ key, label, unit, source })),
    calculate: values => {
      const value = solvePreferredAnnualYield(values.price, values.annualDistribution, values.redemptionValue, values.years);
      return value === null ? null : {
        value,
        unit: "%/年",
        formula: "当前净价 = Σ 年末现金分配/(1+y)^t + 期末偿还金额/(1+y)^n",
      };
    },
  },
  qfm: {
    method: "年化现金分配除以当前净价", result: "当前收益率", required: [["annualCashDistribution", "核验分配记录或条款现金流", "年化金额和币种"], ["currentCleanPrice", "授权优先股行情", "同币种当前净价和市场时间"]],
    inputs: [["annualDistribution", "年化现金分配", "金额", "核验现金流或用户情景"], ["currentPrice", "当前净价", "价格", "授权行情或用户情景"]].map(([key, label, unit, source]) => ({ key, label, unit, source })),
    calculate: v => v.currentPrice > 0 ? { value: (v.annualDistribution / v.currentPrice) * 100, unit: "%", formula: "年化现金分配 / 当前净价 × 100" } : null,
  },
  mdl: {
    method: "价格、修正久期和规模的线性利率冲击", result: "DV01 情景", required: [["cleanPrice", "授权优先股行情", "净价和市场时间"], ["modifiedDuration", "有来源模型输入", "久期口径和校准日"]],
    inputs: [["price", "净价", "价格", "授权行情或用户情景"], ["duration", "修正久期", "年", "经核验模型输入"], ["quantity", "持仓数量", "股", "账户或用户情景"]].map(([key, label, unit, source]) => ({ key, label, unit, source })),
    calculate: v => v.price >= 0 && v.duration >= 0 && v.quantity >= 0 ? { value: v.price * v.duration * v.quantity * 0.0001, unit: "金额/bp", formula: "净价 × 修正久期 × 数量 × 0.0001" } : null,
  },
  crd: { method: "评级机构、日期、展望和迁移事件对账", result: "证券信用等级与历史迁移", required: [["rating/outlook", "获许可评级源", "机构、日期、评级和展望"], ["watch/status", "获许可评级源", "观察名单和迁移"]] },
  wei: {
    method: "发行主体杠杆和利息覆盖复算", result: "发行人偿付能力指标", required: [["totalDebt", "发行人财务披露", "总债务及报告期"], ["ebitda/interestExpense", "发行人财务披露", "同报告期口径"]],
    inputs: [["debt", "总债务", "金额", "发行人财务披露或用户情景"], ["ebitda", "EBITDA", "金额", "发行人财务披露或用户情景"], ["ebit", "EBIT", "金额", "发行人财务披露或用户情景"], ["interest", "利息费用", "金额", "发行人财务披露或用户情景"]].map(([key, label, unit, source]) => ({ key, label, unit, source })),
    calculate: v => v.ebitda > 0 && v.interest > 0 ? { value: v.debt / v.ebitda, unit: "倍", formula: `债务/EBITDA；利息覆盖=${(v.ebit / v.interest).toFixed(4)}倍` } : null,
  },
  rpa: { method: "资本结构工具逐级排序与条款证据核验", result: "优先股偿付顺位和回收边界", required: [["seniority", "核验发行条款", "合同顺位"], ["capitalStructure", "发行人披露", "同主体资本结构"], ["guarantee/subordination", "法律文件", "担保和次级关系"]] },
  liq: {
    method: "同一时点买卖价差复算", result: "中价口径相对价差", required: [["bid/ask", "授权行情源", "同场所同时间报价"], ["depth/trades", "授权订单簿与成交源", "规模和市场时间"]],
    inputs: [["bid", "买价", "价格", "授权行情或用户情景"], ["ask", "卖价", "价格", "授权行情或用户情景"]].map(([key, label, unit, source]) => ({ key, label, unit, source })),
    calculate: v => v.bid > 0 && v.ask >= v.bid ? { value: ((v.ask - v.bid) / ((v.ask + v.bid) / 2)) * 10000, unit: "bp", formula: "(卖价 - 买价) / 中价 × 10,000" } : null,
  },
  por: { method: "条款字段标准化后的同类横截面对照", result: "可比证券差异与证据缺口", required: [["peerDefinition", "用户筛选", "币种、结构、发行人或评级范围"], ["normalizedTerms", "账户条款", "股息、赎回、转换和顺位字段"]] },
  aide: {
    method: "利率与信用利差的一阶联合冲击", result: "透明价格冲击情景", required: [["cleanPrice", "授权行情或用户情景", "净价"], ["rateDuration/spreadDuration", "有来源模型输入", "久期口径"], ["rateShock/spreadShock", "用户情景", "冲击基点"]],
    inputs: [["price", "净价", "价格", "授权行情或用户情景"], ["rateDuration", "利率久期", "年", "经核验模型输入"], ["spreadDuration", "利差久期", "年", "经核验模型输入"], ["rateShock", "利率冲击", "bp", "用户情景"], ["spreadShock", "利差冲击", "bp", "用户情景"]].map(([key, label, unit, source]) => ({ key, label, unit, source })),
    calculate: v => v.price >= 0 && v.rateDuration >= 0 && v.spreadDuration >= 0 ? { value: -v.price * (v.rateDuration * v.rateShock + v.spreadDuration * v.spreadShock) / 10000, unit: "价格", formula: "-净价 × (利率久期×利率冲击 + 利差久期×利差冲击) / 10,000" } : null,
  },
};

const fieldLabels: Record<string, string> = {
  securityIdentifier: "证券标识", sourceReference: "来源证据", couponRatePct: "票面股息率",
  referenceIndex: "参考利率", spreadBps: "加点", firstCallDate: "首赎日", maturityDate: "到期日",
  liquidationPreference: "清算优先额", issuerName: "发行人", cik: "CIK", asOfDate: "条款时点",
};

function isPresent(value: unknown) {
  return value !== null && value !== undefined && value !== "";
}

export default function PreferredCapabilityAnalysisTool({ moduleId }: { moduleId: string }) {
  const capability = PREFERRED_STOCK_CAPABILITIES.find(item => item.id === moduleId) ?? PREFERRED_STOCK_CAPABILITIES[0];
  const mode = capability.id as ModuleId;
  const definition = DEFINITIONS[mode];
  const { isAuthenticated } = useAuth();
  const terms = trpc.preferredStockResearch.listTerms.useQuery({ limit: 500 }, { enabled: isAuthenticated, retry: false, staleTime: 30_000, refetchOnReconnect: true });
  const [values, setValues] = useState<Record<string, string>>({});
  const [runAt, setRunAt] = useState<string | null>(null);
  const numericValues = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, Number(value)]));
  const result = definition.calculate?.(numericValues) ?? null;
  const termFields = useMemo(() => {
    const rows = terms.data ?? [];
    const keys = Array.from(new Set(definition.required.flatMap(([field]) => field.split(/[\/]/)).filter(field => fieldLabels[field])));
    return keys.map(field => ({ field, label: fieldLabels[field], available: rows.filter((row: any) => isPresent(row[field])).length, total: rows.length }));
  }, [definition.required, terms.data]);

  return (
    <section className="min-h-full bg-[#070b10] text-xs text-slate-200" aria-label={`${capability.code} ${capability.name}分析工具`}>
      <header className="border-b border-slate-800 px-2 py-2">
        <b className="font-mono text-cyan-200">{capability.code}</b><span className="ml-2">{capability.name}分析工具</span>
        <p className="mt-1 text-[10px] text-slate-500">方法：{definition.method} · 输出：{definition.result}</p>
      </header>
      <div role="toolbar" className="flex flex-wrap items-end gap-2 border-b border-slate-800 p-2">
        {(definition.inputs ?? []).map(input => <label key={input.key} className="min-w-32 flex-1 text-[10px] text-slate-400">{input.label} ({input.unit})<input aria-label={`${capability.code} ${input.label}`} type="number" value={values[input.key] ?? ""} onChange={event => setValues(current => ({ ...current, [input.key]: event.target.value }))} placeholder="输入情景值" className="mt-1 h-7 w-full border border-slate-700 bg-black px-2 font-mono text-[11px] text-slate-200" /></label>)}
        <button type="button" onClick={() => { setRunAt(new Date().toISOString()); void terms.refetch(); }} disabled={terms.isFetching} className="inline-flex h-7 items-center gap-1 border border-cyan-800 px-2 text-[11px] text-cyan-200 disabled:opacity-40"><RefreshCw className={`h-3 w-3 ${terms.isFetching ? "animate-spin" : ""}`} />核验并复算</button>
      </div>

      {definition.inputs?.length ? <table className="w-full text-left text-[10px]"><thead className="text-slate-500"><tr><th className="p-2">分析结果</th><th>结果值</th><th>计算式</th><th>状态</th></tr></thead><tbody><tr className="border-t border-slate-800"><td className="p-2 text-cyan-200">{definition.result}</td><td className="font-mono">{result ? `${result.value.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${result.unit}` : "—"}</td><td>{result?.formula ?? "输入完整且满足定义后计算"}</td><td className={result ? "text-emerald-300" : "text-amber-200"}>{result ? "会话情景已复算" : "等待有效输入"}</td></tr></tbody></table> : null}

      <table className="w-full text-left text-[10px]"><thead className="border-t border-slate-800 text-slate-500"><tr><th className="p-2">必需字段</th><th>权威来源</th><th>验收口径</th><th>当前状态</th></tr></thead><tbody>{definition.required.map(([field, source, rule]) => <tr key={field} className="border-t border-slate-800"><td className="p-2 font-mono text-amber-200">{field}</td><td>{source}</td><td>{rule}</td><td className="text-slate-400">{termFields.some(item => field.split(/[\/]/).includes(item.field) && item.available > 0) ? "账户条款有部分记录" : "待接入或输入"}</td></tr>)}</tbody></table>

      {termFields.length ? <table className="w-full text-left text-[10px]"><thead className="border-t border-slate-800 text-slate-500"><tr><th className="p-2">账户字段</th><th>有值记录</th><th>账户记录总数</th><th>覆盖状态</th></tr></thead><tbody>{termFields.map(item => <tr key={item.field} className="border-t border-slate-800"><td className="p-2">{item.label}</td><td className="font-mono">{item.available}</td><td className="font-mono">{item.total}</td><td>{!isAuthenticated ? "未认证" : terms.isLoading ? "读取中" : terms.isError ? "读取失败" : item.available ? "有来源账户记录" : "账户未提供"}</td></tr>)}</tbody></table> : null}
      <footer role="status" className="border-t border-slate-800 p-2 text-[10px] leading-5 text-slate-500">{runAt ? `最近复算 ${runAt}。` : "尚未执行本会话复算。"} 输入值仅作为透明用户情景；未连接的行情、评级、订单簿或交易数据不会显示为市场事实，也不会自动生成投资建议。</footer>
    </section>
  );
}
