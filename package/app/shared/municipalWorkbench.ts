/** Municipal research calculations. Defaults are editable assumptions, never quotes. */
export type WorkbenchField = {
  key: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  value: number;
};
const field = (
  key: string,
  label: string,
  unit: string,
  value: number,
  min = 0,
  max = 100,
  step = 0.01
): WorkbenchField => ({ key, label, unit, value, min, max, step });
const face = field("face", "本金", "百万美元", 100, 0.01, 100000, 0.01);
const coupon = field("coupon", "票面利率", "%", 4, 0, 30);
const yieldField = field("yield", "折现收益率", "%", 4, 0, 30);
const years = field("years", "剩余年限", "年", 10, 1, 40, 1);
const shock = field("shock", "利率冲击", "bp", 100, -300, 500, 25);
const days = field("days", "持有天数", "天", 90, 1, 365, 1);
export const MUNICIPAL_TOOLS = {
  SMUN: {
    title: "债务现金流与偿债压力",
    purpose: "逐期本金、利息、现值与利率冲击；不使用虚构的发行人负债或评级。",
    fields: [face, coupon, yieldField, years, shock],
  },
  AAA: {
    title: "期限曲线情景",
    purpose:
      "以用户参考点研究斜率与平移；可载入已发布国债观察，不是 BVAL 授权曲线。",
    fields: [
      yieldField,
      years,
      shock,
      field("slope", "每年斜率", "bp", 3, -30, 30, 1),
    ],
  },
  PICK: {
    title: "分期发行资金计划",
    purpose: "比较不同发行批次的资金到位与新增年利息。日期和规模均为用户计划。",
    fields: [
      face,
      coupon,
      field("batches", "发行批次", "批", 4, 1, 12, 1),
      field("step", "每批利率变化", "bp", 10, -100, 100, 5),
    ],
  },
  MBWD: {
    title: "询价价格与净到手比较",
    purpose: "同一现金流按不同报价收益率折现，扣除费用，比较净到手金额。",
    fields: [
      face,
      coupon,
      yieldField,
      years,
      field("fee", "交易费", "bp", 5, 0, 200, 1),
    ],
  },
  CDRN: {
    title: "商议承销费用桥",
    purpose:
      "拆分管理费、承销费、销售让利与净募集金额。输入是谈判假设，不是交易商报价。",
    fields: [
      face,
      field("management", "管理费", "bp", 5, 0, 200, 1),
      field("underwriting", "承销费", "bp", 8, 0, 200, 1),
      field("selling", "销售让利", "bp", 20, 0, 300, 1),
      field("price", "发行价格", "每百元", 100, 50, 150),
    ],
  },
  CDRC: {
    title: "竞标真实利息成本 TIC",
    purpose: "按净募集金额反解现金流内部收益率，展示不同报价价格的真实成本。",
    fields: [
      face,
      coupon,
      years,
      field("price", "竞标价格", "每百元", 100, 50, 150),
      field("fee", "发行费用", "bp", 20, 0, 200, 1),
    ],
  },
  CDRA: {
    title: "固定利率付息计划",
    purpose:
      "展开逐期利息、到期还本及累计支付。以当前输入测算，不生成发行公告。",
    fields: [
      face,
      coupon,
      years,
      field("frequency", "每年付息次数", "次", 2, 1, 4, 1),
    ],
  },
  CNDS: {
    title: "短票折价与资金占用",
    purpose: "区分银行折价率、货币市场收益率和实际占用资金；采用 ACT/360。",
    fields: [face, { ...yieldField, label: "银行折价率" }, days],
  },
  CDRV: {
    title: "浮息重设现金流",
    purpose: "按重设间隔计算计息天数、基础利率、加点及现金支出，采用 ACT/360。",
    fields: [
      face,
      { ...yieldField, label: "初始重设基准" },
      field("spread", "信用加点", "bp", 20, 0, 500, 5),
      field("reset", "重设周期", "天", 7, 1, 90, 1),
      days,
      shock,
    ],
  },
  DEAL: {
    title: "交收金额核算",
    purpose: "净价、应计利息、手续费汇成交收净额；应计天数由用户核定。",
    fields: [
      face,
      coupon,
      field("price", "成交净价", "每百元", 100, 1, 200),
      field("accruedDays", "应计天数", "天", 45, 0, 365, 1),
      field("fee", "手续费", "bp", 3, 0, 200, 1),
    ],
  },
  CACT: {
    title: "信用事件损失敏感性",
    purpose: "将违约概率和回收率假设转为预期损失；不生成信用事件或评级结论。",
    fields: [
      face,
      field("pd", "一年违约概率", "%", 1, 0, 100),
      field("recovery", "回收率", "%", 40, 0, 100, 1),
    ],
  },
  MCAL: {
    title: "项目现金流支付瀑布",
    purpose: "逐年将可用现金分配至优先利息、本金和剩余现金，展示未覆盖缺口。",
    fields: [
      face,
      coupon,
      years,
      field("cash", "每年可用现金", "百万美元", 15, 0, 100000, 1),
      field("growth", "现金增长假设", "%", 2, -50, 50),
    ],
  },
  MBIX: {
    title: "自定组合收益归因",
    purpose:
      "把持有期收益拆为票息、利率、凸性与利差四项，不冒充授权市政债指数。",
    fields: [
      coupon,
      field("duration", "修正久期", "年", 6, 0, 40),
      field("convexity", "凸性", "年²", 45, 0, 2000, 1),
      shock,
      field("spread", "利差变动", "bp", 20, -200, 500, 5),
      days,
    ],
  },
  VRDN: {
    title: "七日回售备付压力",
    purpose:
      "结合潜在回售比例、现金和流动性额度计算每日缺口，不伪造再营销库存。",
    fields: [
      face,
      field("put", "七日回售比例", "%", 25, 0, 100, 1),
      field("cash", "现金备付", "百万美元", 10, 0, 100000, 1),
      field("facility", "可用流动性额度", "百万美元", 10, 0, 100000, 1),
    ],
  },
  BMA: {
    title: "免税与应税盈亏平衡",
    purpose:
      "税收等价收益率与税率敏感性。应税收益率可读取官方 SOFR；免税端为用户输入。",
    fields: [
      field("muni", "免税收益率", "%", 3.5, 0, 30),
      field("taxable", "应税收益率", "%", 4.5, 0.01, 30),
      field("tax", "边际税率", "%", 37, 0, 70, 1),
    ],
  },
  BOOM: {
    title: "库存融资与减仓压力",
    purpose:
      "将持仓、折扣率和融资成本转为保证金、持有成本及出售后现金；不是实际库存。",
    fields: [
      face,
      field("haircut", "融资折扣", "%", 5, 0, 100, 1),
      { ...yieldField, label: "融资年利率" },
      days,
      field("sale", "减仓比例", "%", 20, 0, 100, 1),
    ],
  },
} as const;
export type MunicipalToolId = keyof typeof MUNICIPAL_TOOLS;
export type CalcRow = {
  label: string;
  value: number;
  [key: string]: number | string;
};
export type CalcResult = {
  columns: { key: string; label: string; unit: string }[];
  rows: CalcRow[];
  formula: string;
  chart: "bar" | "line";
  metrics: { label: string; value: number; unit: string }[];
};
export function bondPrice(
  couponPct: number,
  yieldPct: number,
  nYears: number,
  frequency = 2
) {
  const rate = yieldPct / 100 / frequency;
  if (rate <= -1) throw new Error("折现率使现金流无法折现");
  const periods = Math.round(nYears * frequency);
  let price = 0;
  for (let p = 1; p <= periods; p++)
    price +=
      ((100 * couponPct) / 100 / frequency + (p === periods ? 100 : 0)) /
      (1 + rate) ** p;
  return price;
}
export function solveYield(couponPct: number, price: number, nYears: number) {
  if (price <= 0) throw new Error("净募集价格必须大于零");
  let low = -50,
    high = 500;
  for (let i = 0; i < 100; i++) {
    const mid = (low + high) / 2;
    if (bondPrice(couponPct, mid, nYears) > price) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}
export function calculateMunicipalTool(
  id: MunicipalToolId,
  supplied: Record<string, number>
): CalcResult {
  if (!Object.hasOwn(MUNICIPAL_TOOLS, id)) throw new Error("未知工作台");
  const spec = MUNICIPAL_TOOLS[id];
  const v: Record<string, number> = {};
  const integers = new Set([
    "years",
    "batches",
    "frequency",
    "days",
    "reset",
    "accruedDays",
  ]);
  for (const key of Object.keys(supplied))
    if (!spec.fields.some(f => f.key === key))
      throw new Error("输入包含不属于当前功能的字段");
  for (const f of spec.fields) {
    const x = supplied[f.key] ?? f.value;
    if (
      !Number.isFinite(x) ||
      x < f.min ||
      x > f.max ||
      (integers.has(f.key) && !Number.isInteger(x))
    )
      throw new Error(`${f.label}超出有效范围`);
    v[f.key] = x;
  }
  const column = (key: string, label: string, unit = "") => ({
    key,
    label,
    unit,
  });
  const metric = (label: string, value: number, unit: string) => ({
    label,
    value,
    unit,
  });
  let rows: CalcRow[] = [],
    columns = [column("label", "情景"), column("value", "测算值")],
    formula = "",
    metrics: CalcResult["metrics"] = [],
    chart: CalcResult["chart"] = "bar";
  if (id === "SMUN") {
    const base = bondPrice(v.coupon, v.yield, v.years);
    rows = [-200, -100, 0, 100, 200, v.shock]
      .filter((s, i, a) => a.indexOf(s) === i)
      .sort((a, b) => a - b)
      .map(s => {
        const price = bondPrice(v.coupon, v.yield + s / 100, v.years);
        return {
          label: `${s > 0 ? "+" : ""}${s} bp`,
          shock: s,
          price,
          value: (price / base - 1) * 100,
          pnl: ((price - base) / 100) * v.face,
        };
      });
    columns = [
      column("label", "利率冲击"),
      column("price", "全价", "每百元"),
      column("value", "价格变化", "%"),
      column("pnl", "市值变化", "百万美元"),
    ];
    const duration =
      (bondPrice(v.coupon, v.yield - 0.01, v.years) -
        bondPrice(v.coupon, v.yield + 0.01, v.years)) /
      (2 * base * 0.0001);
    metrics = [
      metric("修正久期", duration, "年"),
      metric("DV01", ((duration * base) / 100) * v.face * 100, "美元/bp"),
      metric("票息总额", ((v.face * v.coupon) / 100) * v.years, "百万美元"),
    ];
    formula =
      "半年付息、到期一次还本；P=Σ CF/(1+y/2)^t。久期使用 ±1bp 中心差分。";
  } else if (id === "AAA") {
    rows = [1, 2, 3, 5, 7, 10, 20, 30].map(t => ({
      label: `${t}Y`,
      tenor: t,
      base: v.yield + ((t - v.years) * v.slope) / 100,
      value: v.yield + ((t - v.years) * v.slope) / 100 + v.shock / 100,
    }));
    columns = [
      column("label", "期限"),
      column("base", "基准情景", "%"),
      column("value", "冲击后", "%"),
    ];
    formula =
      "用户基点 + (期限 − 参考期限) × 斜率 + 平移冲击；不是市场拟合曲线。";
    chart = "line";
  } else if (id === "PICK") {
    if (v.coupon + Math.min(0, ((v.batches - 1) * v.step) / 100) < 0)
      throw new Error("每批利率变化使后续票息低于0；请调整票息、批次或利差。");
    rows = Array.from({ length: v.batches }, (_, i) => ({
      label: `第${i + 1}批`,
      amount: v.face / v.batches,
      rate: v.coupon + (i * v.step) / 100,
      value: ((v.face / v.batches) * (v.coupon + (i * v.step) / 100)) / 100,
      cumulative: (v.face / v.batches) * (i + 1),
    }));
    columns = [
      column("label", "批次"),
      column("amount", "募资", "百万美元"),
      column("rate", "票息假设", "%"),
      column("value", "新增年利息", "百万美元"),
      column("cumulative", "累计到位", "百万美元"),
    ];
    formula = "每批等额发行；年利息=该批本金×票息，不代表实际发行日程。";
  } else if (id === "MBWD") {
    rows = [-20, -10, 0, 10, 20].map(s => {
      const y = v.yield + s / 100,
        price = bondPrice(v.coupon, y, v.years);
      return {
        label: `${y.toFixed(2)}%`,
        yield: y,
        price,
        value: (v.face * price) / 100 - (v.face * v.fee) / 10000,
        cost: (v.face * v.fee) / 10000,
      };
    });
    columns = [
      column("label", "询价收益率"),
      column("price", "折现价格", "每百元"),
      column("cost", "交易费", "百万美元"),
      column("value", "卖出净到手", "百万美元"),
    ];
    formula = "净到手=本金×现金流折现价格/100−本金×交易费bp/10000。";
  } else if (id === "CDRN") {
    rows = [
      ["管理费", v.management],
      ["承销费", v.underwriting],
      ["销售让利", v.selling],
    ].map(([label, bp]) => ({
      label: String(label),
      bps: Number(bp),
      value: (v.face * Number(bp)) / 10000,
    }));
    columns = [
      column("label", "费用类别"),
      column("bps", "费率", "bp"),
      column("value", "成本", "百万美元"),
    ];
    metrics = [
      metric(
        "净募集",
        (v.face * v.price) / 100 - rows.reduce((a, r) => a + r.value, 0),
        "百万美元"
      ),
    ];
    formula =
      "净募集=面值×发行价/100−各项费用；三类费用分别输入，避免重复扣减。";
  } else if (id === "CDRC") {
    rows = [-1, -0.5, 0, 0.5, 1].map(d => {
      const price = v.price + d,
        net = price - v.fee / 100;
      return {
        label: price.toFixed(2),
        net,
        value: solveYield(v.coupon, net, v.years),
        proceeds: (v.face * net) / 100,
      };
    });
    columns = [
      column("label", "竞标价"),
      column("net", "费用后价格"),
      column("value", "TIC", "%"),
      column("proceeds", "净募集", "百万美元"),
    ];
    formula =
      "TIC 为使半年付息现金流现值等于扣费后募集额的年化收益率（二分求根）。";
  } else if (id === "CDRA") {
    let cumulative = 0;
    rows = Array.from({ length: v.years * v.frequency }, (_, i) => {
      const principal = i === v.years * v.frequency - 1 ? v.face : 0,
        interest = (v.face * v.coupon) / 100 / v.frequency;
      cumulative += principal + interest;
      return {
        label: `第${i + 1}期`,
        year: (i + 1) / v.frequency,
        principal,
        interest,
        value: principal + interest,
        cumulative,
      };
    });
    columns = [
      column("label", "支付期"),
      column("year", "距今", "年"),
      column("principal", "本金", "百万美元"),
      column("interest", "利息", "百万美元"),
      column("value", "当期支付", "百万美元"),
    ];
    formula = "规则付息期模型（非节假日调整的真实付息日历）；到期一次还本。";
  } else if (id === "CNDS") {
    rows = [7, 30, 60, 90, 180, 360, v.days]
      .filter((x, i, a) => a.indexOf(x) === i)
      .sort((a, b) => a - b)
      .map(d => {
        const price = 100 * (1 - ((v.yield / 100) * d) / 360);
        return {
          label: `${d}天`,
          price,
          value: ((((100 - price) / price) * 360) / d) * 100,
          funds: (v.face * price) / 100,
          interest: (v.face * (100 - price)) / 100,
        };
      });
    columns = [
      column("label", "期限"),
      column("price", "折价价格"),
      column("value", "货币市场收益率", "%"),
      column("funds", "占用资金", "百万美元"),
      column("interest", "到期收益", "百万美元"),
    ];
    formula = "P=100×(1−折价率×天数/360)；投资收益率=(100−P)/P×360/天数。";
  } else if (id === "CDRV") {
    rows = Array.from({ length: Math.ceil(v.days / v.reset) }, (_, i) => {
      const d = Math.min(v.reset, v.days - i * v.reset),
        rate = v.yield + v.spread / 100 + (i === 0 ? 0 : v.shock / 100);
      return {
        label: `第${i + 1}段`,
        days: d,
        rate,
        value: (((v.face * rate) / 100) * d) / 360,
        end: Math.min(v.days, (i + 1) * v.reset),
      };
    });
    columns = [
      column("label", "重设段"),
      column("days", "计息天数", "天"),
      column("rate", "重设利率", "%"),
      column("value", "利息支出", "百万美元"),
    ];
    formula =
      "首段用当前基准+加点；此后各段施加同一冲击；利息=本金×利率×实际天数/360。";
    chart = "line";
  } else if (id === "DEAL") {
    rows = [
      { label: "净价金额", value: (v.face * v.price) / 100 },
      {
        label: "应计利息",
        value: (((v.face * v.coupon) / 100) * v.accruedDays) / 360,
      },
      { label: "交易费用", value: (v.face * v.fee) / 10000 },
    ];
    columns = [
      column("label", "交收分项"),
      column("value", "金额", "百万美元"),
    ];
    metrics = [
      metric(
        "买入应付",
        rows.reduce((a, r) => a + r.value, 0),
        "百万美元"
      ),
      metric(
        "卖出应收",
        rows[0].value + rows[1].value - rows[2].value,
        "百万美元"
      ),
    ];
    formula =
      "买入应付=净价+应计+费用；卖出应收=净价+应计−费用，应计采用用户天数/360。";
  } else if (id === "CACT") {
    rows = [0, 20, 40, 60, 80, 100, v.recovery]
      .filter((x, i, a) => a.indexOf(x) === i)
      .sort((a, b) => a - b)
      .map(r => ({
        label: `回收${r}%`,
        recovery: r,
        value: ((v.face * v.pd) / 100) * (1 - r / 100),
        loss: v.face * (1 - r / 100),
      }));
    columns = [
      column("label", "回收情景"),
      column("loss", "违约条件损失", "百万美元"),
      column("value", "一年预期损失", "百万美元"),
    ];
    formula = "EL=违约敞口×一年PD×(1−回收率)；不构成已发生事件或预测。";
  } else if (id === "MCAL") {
    let balance = v.face, arrears = 0;
    rows = Array.from({ length: v.years }, (_, i) => {
      const cash = v.cash * (1 + v.growth / 100) ** i,
        interest = (balance * v.coupon) / 100,
        dueInterest = interest + arrears,
        paidInterest = Math.min(cash, dueInterest),
        principal = Math.min(balance, Math.max(0, cash - dueInterest));
      arrears = dueInterest - paidInterest;
      balance -= principal;
      return {
        label: `Y${i + 1}`,
        cash,
        dueInterest,
        interest: paidInterest,
        principal,
        value: Math.max(0, cash - paidInterest - principal),
        arrears,
        shortfall:
          arrears + (i === v.years - 1 ? balance : 0),
        balance,
      };
    });
    columns = [
      column("label", "年度"),
      column("cash", "可用现金", "百万美元"),
      column("dueInterest", "含欠息应付", "百万美元"),
      column("interest", "已付利息", "百万美元"),
      column("principal", "已还本金", "百万美元"),
      column("value", "剩余现金", "百万美元"),
      column("arrears", "结转欠息", "百万美元"),
      column("balance", "剩余本金", "百万美元"),
      column("shortfall", "未覆盖义务（末期含本金）", "百万美元"),
    ];
    formula =
      "现金先支付累计欠息与当期利息，再归还本金；欠息逐年结转但不计罚息，末期未还本金计入未覆盖义务。不模拟破产加速到期。";
  } else if (id === "MBIX") {
    rows = [
      { label: "票息持有", value: (v.coupon * v.days) / 365 },
      { label: "无风险利率", value: (-v.duration * v.shock) / 100 },
      {
        label: "凸性",
        value: 0.5 * v.convexity * (v.shock / 10000) ** 2 * 100,
      },
      { label: "利差", value: (-v.duration * v.spread) / 100 },
    ];
    columns = [column("label", "归因因子"), column("value", "收益贡献", "%")];
    metrics = [
      metric(
        "近似总收益",
        rows.reduce((a, r) => a + r.value, 0),
        "%"
      ),
    ];
    formula =
      "总收益≈票息×天数/365−D×Δr+½C×Δr²−D×Δs，不含交叉凸性、税费或再投资。";
  } else if (id === "VRDN") {
    rows = Array.from({ length: 7 }, (_, i) => {
      const demand = (((v.face * v.put) / 100) * (i + 1)) / 7,
        capacity = v.cash + v.facility;
      return {
        label: `T+${i + 1}`,
        demand,
        capacity,
        value: Math.max(0, demand - capacity),
      };
    });
    columns = [
      column("label", "回售日"),
      column("demand", "累计需求", "百万美元"),
      column("capacity", "备付能力", "百万美元"),
      column("value", "未覆盖缺口", "百万美元"),
    ];
    formula = "假设七日内匀速回售；缺口=max(累计回售−现金−可用额度,0)。";
    chart = "line";
  } else if (id === "BMA") {
    rows = [0, 10, 20, 30, 37, 40, 50, 60, v.tax]
      .filter((x, i, a) => a.indexOf(x) === i)
      .sort((a, b) => a - b)
      .map(t => ({
        label: `${t}%`,
        tax: t,
        value: v.muni / (1 - t / 100),
        afterTax: v.taxable * (1 - t / 100),
        difference: v.muni - v.taxable * (1 - t / 100),
      }));
    columns = [
      column("label", "边际税率"),
      column("value", "免税等价收益", "%"),
      column("afterTax", "应税税后收益", "%"),
      column("difference", "免税端优势", "百分点"),
    ];
    metrics = [metric("盈亏平衡税率", (1 - v.muni / v.taxable) * 100, "%")];
    formula =
      "TEY=免税收益/(1−税率)；盈亏平衡税率=1−免税收益/应税收益；不含州税、AMT。";
    chart = "line";
  } else if (id === "BOOM") {
    rows = [0, 25, 50, 75, 100, v.sale]
      .filter((x, i, a) => a.indexOf(x) === i)
      .sort((a, b) => a - b)
      .map(s => {
        const remaining = v.face * (1 - s / 100),
          financing = remaining * (1 - v.haircut / 100);
        return {
          label: `减仓${s}%`,
          remaining,
          collateral: (remaining * v.haircut) / 100,
          financing,
          value: (((financing * v.yield) / 100) * v.days) / 360,
        };
      });
    columns = [
      column("label", "处置情景"),
      column("remaining", "剩余面值", "百万美元"),
      column("collateral", "自有资金", "百万美元"),
      column("financing", "融资余额", "百万美元"),
      column("value", "持有期融资费", "百万美元"),
    ];
    formula =
      "按平价处置假设；融资余额=剩余持仓×(1−折扣)，成本=融资余额×利率×天数/360。";
  }
  if (id === "SMUN")
    metrics.push(
      metric(
        "所选冲击市值变化",
        ((bondPrice(v.coupon, v.yield + v.shock / 100, v.years) -
          bondPrice(v.coupon, v.yield, v.years)) /
          100) *
          v.face,
        "百万美元"
      )
    );
  if (id === "CNDS")
    metrics.push(
      metric(
        "所选期限占款",
        v.face * (1 - ((v.yield / 100) * v.days) / 360),
        "百万美元"
      )
    );
  if (id === "CACT")
    metrics.push(
      metric(
        "所选回收率预期损失",
        ((v.face * v.pd) / 100) * (1 - v.recovery / 100),
        "百万美元"
      )
    );
  if (id === "BMA")
    metrics.push(metric("所选税率等价收益", v.muni / (1 - v.tax / 100), "%"));
  if (id === "BOOM")
    metrics.push(
      metric(
        "所选减仓释放自有资金",
        (((v.face * v.sale) / 100) * v.haircut) / 100,
        "百万美元"
      )
    );
  return { rows, columns, formula, metrics, chart };
}
