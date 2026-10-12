import {
  periodLast,
  type EconomicSnapshot,
  type EconomicPoint,
} from "./economicObservations";
export type CentralBankDrill = {
  label: string;
  description: string;
  columns: Array<[string, string]>;
  rows: Array<Record<string, unknown>>;
};
const cols = (...columns: Array<[string, string]>) => columns;
const match = (points: EconomicPoint[], date: string) =>
  points.find(p => p.date === date)?.value ?? null;
const days = (a: string, b: string) =>
  (Date.parse(b) - Date.parse(a)) / 86400000;
export function centralBankDrilldown(
  group: "fdsp" | "cbrt",
  id: string,
  data: EconomicSnapshot
): CentralBankDrill {
  const h = (id: string) => data.series.find(s => s.id === id)?.history ?? [];
  const points = h(id);
  const supported = group === "cbrt"
    ? ["DFEDTARU", "DFEDTARL", "ECBDFR", "CPIAUCSL", "DEXUSEU"]
    : ["WALCL", "TREAST", "WSHOMCB", "WRESBAL", "WTREGEN", "WCURCIR", "IORB", "DFF", "RRPONTSYD", "WLCFLPCL"];
  if (!supported.includes(id)) return {
    label: "字段未配置分析合同",
    description: "该字段不属于当前分析合同，不套用其他指标的计算。",
    columns: [],
    rows: [],
  };
  if (group === "cbrt") {
    if (id === "DFEDTARU")
      return {
        label: "政策利率持稳区间",
        description:
          "按实际观察切分不变的政策上限区间，列出持续日数；首尾为可见窗口边界，不推断窗口外决议。",
        columns: cols(
          ["start", "区间首观察"],
          ["end", "区间末观察"],
          ["rate", "上限%"],
          ["elapsed", "跨度日数"]
        ),
        rows: points.reduce<Array<Record<string, unknown>>>((rows, p) => {
          const last = rows.at(-1);
          if (last && last.rate === p.value && days(String(last.end), p.date) === 1) {
            last.end = p.date;
            last.elapsed = days(String(last.start), p.date);
          } else
            rows.push({
              start: p.date,
              end: p.date,
              rate: p.value,
              elapsed: 0,
            });
          return rows;
        }, []),
      };
    if (id === "DFEDTARL")
      return {
        label: "目标利率走廊核验",
        description: "只按同日上下限计算走廊宽度和中点，缺少上限时不推算。",
        columns: cols(
          ["date", "日期"],
          ["width", "走廊宽度bp"],
          ["midpoint", "目标中点%"]
        ),
        rows: points.flatMap(p => {
          const upper = match(h("DFEDTARU"), p.date);
          return upper === null
            ? []
            : [
                {
                  date: p.date,
                  width: (upper - p.value) * 100,
                  midpoint: (upper + p.value) / 2,
                },
              ];
        }),
      };
    if (id === "ECBDFR")
      return {
        label: "欧元区政策步长分布",
        description:
          "按真实变更事件分组计数，不重复每日利率或逐项决议表；不把步长频率当成未来概率。",
        columns: cols(
          ["step", "变动bp"],
          ["count", "次数"],
          ["first", "首次观察变更"],
          ["last", "最近观察变更"]
        ),
        rows: [
          ...points
            .slice(1)
            .reduce((groups, p, i) => {
              const step =
                Math.round((p.value - points[i].value) * 100000) / 1000;
              if (step === 0) return groups;
              const old = groups.get(step);
              groups.set(step, {
                step,
                count: (old?.count ?? 0) + 1,
                first: old?.first ?? p.date,
                last: p.date,
              });
              return groups;
            }, new Map<number, { step: number; count: number; first: string; last: string }>())
            .values(),
        ],
      };
    if (id === "CPIAUCSL")
      return {
        label: "通胀变化对实际利率的影响核算",
        description:
          "精确相邻月份政策上限变化减通胀同比变化，拆分事后实际利率的变动。缺月不跨期计算。不是政策因果估计。",
        columns: cols(
          ["date", "月份"],
          ["policyChange", "政策变化百分点"],
          ["inflationChange", "通胀变化百分点"],
          ["realChange", "实际利率变化百分点"]
        ),
        rows: points.slice(1).map((p, i) => {
          const prior = points[i];
          const priorMonth=new Date(p.date+'T00:00:00Z');
          priorMonth.setUTCMonth(priorMonth.getUTCMonth()-1);
          const consecutive=prior.date.slice(0,7)===priorMonth.toISOString().slice(0,7);
          const base = match(
            points,
            `${Number(p.date.slice(0, 4)) - 1}${p.date.slice(4)}`
          );
          const previousBase = match(
            points,
            `${Number(prior.date.slice(0, 4)) - 1}${prior.date.slice(4)}`
          );
          const rates = periodLast(h("DFEDTARU"));
          const currentRate = match(rates, p.date.slice(0, 7));
          const priorRate = match(rates, prior.date.slice(0, 7));
          const policyChange =
            !consecutive || currentRate === null || priorRate === null
              ? null
              : currentRate - priorRate;
          const inflationChange =
            consecutive && base && previousBase
              ? (p.value / base - 1 - (prior.value / previousBase - 1)) * 100
              : null;
          return {
            date: p.date.slice(0, 7),
            policyChange,
            inflationChange,
            realChange:
              policyChange === null || inflationChange === null
                ? null
                : policyChange - inflationChange,
          };
        }),
      };
    return {
      label: "政策利差变化与汇率共振",
      description:
        "同日政策利差出现变化时，列出相邻实际汇率收益，不重复每日利差水平表，不作因果归因。",
      columns: cols(
        ["date", "观察日"],
        ["spreadMove", "美欧利差变化bp"],
        ["fxReturn", "相邻汇率收益%"],
        ["base", "汇率基期"]
      ),
      rows: points.slice(1).flatMap((p, i) => {
        const prior = points[i];
        const a = match(h("DFEDTARU"), p.date),
          b = match(h("ECBDFR"), p.date),
          c = match(h("DFEDTARU"), prior.date),
          d = match(h("ECBDFR"), prior.date);
        if (a === null || b === null || c === null || d === null) return [];
        const move = (a - b - c + d) * 100;
        return Math.abs(move) < 1e-8
          ? []
          : [
              {
                date: p.date,
                spreadMove: move,
                fxReturn:
                  prior.value > 0 ? (p.value / prior.value - 1) * 100 : null,
                base: prior.date,
              },
            ];
      }),
    };
  }
  if (id === "WALCL")
    return {
      label: "资产峰值回撤核算",
      description:
        "相对已接入窗口历史峰值计算回撤；总资产的净变化不等同于证券到期缩表。",
      columns: cols(
        ["date", "观察日"],
        ["peakDate", "此前峰值日"],
        ["drawdown", "距峰值十亿美元"],
        ["drawdownPct", "距峰值%"]
      ),
      rows: points.map((p, i) => {
        const peak = points
          .slice(0, i + 1)
          .reduce((a, b) => (a.value >= b.value ? a : b));
        return {
          date: p.date,
          peakDate: peak.date,
          drawdown: (p.value - peak.value) / 1000,
          drawdownPct:
            peak.value > 0
              ? Math.round((p.value / peak.value - 1) * 100 * 1e6) / 1e6
              : null,
        };
      }),
    };
  if (id === "TREAST")
    return {
      label: "国债持仓净变化与资产占比",
      description:
        "同日国债余额占总资产比重，并列相邻周净变化；不解释为净买入交易。",
      columns: cols(
        ["date", "观察日"],
        ["share", "国债占资产%"],
        ["weeklyNet", "相邻净变化十亿美元"]
      ),
      rows: points.map((p, i) => {
        const total = match(h("WALCL"), p.date);
        return {
          date: p.date,
          share: total && total > 0 ? (p.value / total) * 100 : null,
          weeklyNet: i ? (p.value - points[i - 1].value) / 1000 : null,
        };
      }),
    };
  if (id === "WSHOMCB")
    return {
      label: "MBS证券组合权重与收缩",
      description:
        "按同日国债与MBS持仓计算MBS组合权重，并核对近四条周观察净减少。非提前偿付率。",
      columns: cols(
        ["date", "观察日"],
        ["securitiesShare", "MBS占两类证券%"],
        ["fourWeekRunoff", "四观察期净减少十亿美元"]
      ),
      rows: points.map((p, i) => {
        const treasury = match(h("TREAST"), p.date);
        return {
          date: p.date,
          securitiesShare:
            treasury !== null && treasury + p.value > 0
              ? (p.value / (treasury + p.value)) * 100
              : null,
          fourWeekRunoff:
            i >= 4 ? (points[i - 4].value - p.value) / 1000 : null,
        };
      }),
    };
  if (id === "WRESBAL")
    return {
      label: "准备金对资产与财政账户的相对变化",
      description:
        "按同日准备金、总资产与TGA拆分观测变化，缺项为空；不是准备金充裕度阈值或因果模型。",
      columns: cols(
        ["date", "观察日"],
        ["reserveRatio", "准备金/资产%"],
        ["reserveDelta", "准备金变化十亿美元"],
        ["tgaDelta", "TGA变化十亿美元"]
      ),
      rows: points.map((p, i) => {
        const total = match(h("WALCL"), p.date);
        const tga = match(h("WTREGEN"), p.date),
          prior = i ? match(h("WTREGEN"), points[i - 1].date) : null;
        return {
          date: p.date,
          reserveRatio: total && total > 0 ? (p.value / total) * 100 : null,
          reserveDelta: i ? (p.value - points[i - 1].value) / 1000 : null,
          tgaDelta:
            tga === null || prior === null ? null : (tga - prior) / 1000,
        };
      }),
    };
  if (id === "WTREGEN")
    return {
      label: "财政账户流动性吸收观察",
      description:
        "TGA增加列为负的其他条件不变流动性效应，仅为会计方向，不能作为完整银行准备金归因。",
      columns: cols(
        ["date", "观察日"],
        ["tgaChange", "TGA净变化十亿美元"],
        ["mechanicalEffect", "机械流动性方向十亿美元"]
      ),
      rows: points
        .slice(1)
        .map((p, i) => ({
          date: p.date,
          tgaChange: (p.value - points[i].value) / 1000,
          mechanicalEffect: (points[i].value - p.value) / 1000,
        })),
    };
  if (id === "WCURCIR")
    return {
      label: "流通货币年度增量",
      description:
        "配对364日前同星期观察计算年度增量；不与季度通胀同比口径混用。",
      columns: cols(
        ["date", "观察日"],
        ["baseDate", "52周基期"],
        ["increase", "年度增量十亿美元"],
        ["growth", "52周增速%"]
      ),
      rows: points.map(p => {
        const baseDate = new Date(Date.parse(p.date) - 364 * 86400000)
          .toISOString()
          .slice(0, 10);
        const base = match(points, baseDate);
        return {
          date: p.date,
          baseDate,
          increase: base === null ? null : (p.value - base) / 1000,
          growth: base && base > 0 ? (p.value / base - 1) * 100 : null,
        };
      }),
    };
  if (id === "IORB")
    return {
      label: "准备金利息成本情景",
      description:
        "同日准备金余额×年利率估计年化简单利息；不是联储已披露利息费用或利润。",
      columns: cols(
        ["date", "配对观察日"],
        ["annualizedCost", "年化简单利息十亿美元"],
        ["dailyCost", "365日均摊百万美元"]
      ),
      rows: points.flatMap(p => {
        const reserves = match(h("WRESBAL"), p.date);
        return reserves === null
          ? []
          : [
              {
                date: p.date,
                annualizedCost: (reserves * p.value) / 100 / 1000,
                dailyCost: (reserves * p.value) / 100 / 365,
              },
            ];
      }),
    };
  if (id === "DFF")
    return {
      label: "联邦基金与准备金利率利差",
      description:
        "同日有效基金利率减准备金利率，用于观察执行利率差，不复制泰勒规则的通胀调整实际利率。",
      columns: cols(["date", "日期"], ["executionSpread", "DFF减IORB基点"]),
      rows: points.flatMap(p => {
        const iorb = match(h("IORB"), p.date);
        return iorb === null
          ? []
          : [{ date: p.date, executionSpread: (p.value - iorb) * 100 }];
      }),
    };
  if (id === "RRPONTSYD")
    return {
      label: "逆回购余额月内波动",
      description:
        "对真实日观察按月统计极值、范围及样本数，不用月末余额代替月内资金波动。",
      columns: cols(
        ["month", "月份"],
        ["range", "月内范围十亿美元"],
        ["max", "月内高点十亿美元"],
        ["observations", "日观察数"]
      ),
      rows: [
        ...points.reduce((map, p) => {
          const month = p.date.slice(0, 7);
          map.set(month, [...(map.get(month) ?? []), p.value]);
          return map;
        }, new Map<string, number[]>()),
      ].map(([month, values]) => ({
        month,
        range: Math.max(...values) - Math.min(...values),
        max: Math.max(...values),
        observations: values.length,
      })),
    };
  return {
    label: "贴现窗口增量与跳升事件",
    description:
      "仅列一级信贷余额发生变化的观察，按百万美元换算十亿美元；不将余额增量视为借款机构数量。",
    columns: cols(
      ["date", "变更观察日"],
      ["netCredit", "信贷净变化十亿美元"],
      ["relative", "较前值%"]
    ),
    rows: points
      .slice(1)
      .flatMap((p, i) =>
        p.value === points[i].value
          ? []
          : [
              {
                date: p.date,
                netCredit: (p.value - points[i].value) / 1000,
                relative:
                  points[i].value > 0
                    ? (p.value / points[i].value - 1) * 100
                    : null,
              },
            ]
      ),
  };
}
