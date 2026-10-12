import { useMemo, useRef, useState } from 'react';
import { useSearch } from 'wouter';
import { Activity, CalendarClock, CheckSquare, CircleGauge, FileSearch, GitBranch, ListChecks, RefreshCw, Sigma, Waypoints } from 'lucide-react';
import { trpc } from '@/lib/trpc';

type VisualKind = 'clock' | 'metadata' | 'direction' | 'checklist' | 'chain' | 'formula' | 'ladder' | 'ledger';
type OperationState = 'idle' | 'loading' | 'success' | 'empty' | 'error';
type OperationDetail = { label: string; value: string; tone: 'cyan' | 'teal' | 'amber' };
type RealDataReceipt = { available: boolean; source: string; sourceUrl: string | null; observedAt: string | null; retrievedAt: string; boundary: string; researchUse: string; facts: Array<{ label: string; value: string; tone: OperationDetail['tone'] }>; evidence?: Array<{ label: string; text: string }> };

function formatLocalNumber(value: number) {
  return Number.isFinite(value) ? String(Number(value.toFixed(4))) : '不可算';
}

type ExtensionSpec = {
  id: string;
  tab: string;
  sourceName: string;
  title: string;
  instruction: string;
  empty: string;
  missing: string;
  forbidden: string;
  visual: VisualKind;
};

type ViewAudit = {
  at: Date;
  characters: number;
  numericTokens: number;
  timeTokens: string[];
  text: string;
  values: number[];
  directions: { positive: number; negative: number };
  fragments: string[];
};

const SPECS: ExtensionSpec[] = [
  { id: '01', tab: 'eco', sourceName: 'BLS 官方发布时间表 + 已发布失业率', title: 'BLS 发布时区与滞后', instruction: '选择展示时区；终端读取 BLS 失业率的观察期、官方纽约发布时间并计算至本次读取的自然时长，不使用原日历时刻或预测。', empty: '请选择用于展示的时区。', missing: '原日历上下文尚未渲染。', forbidden: '日历预测、市场时点、热力图', visual: 'clock' },
  { id: '02', tab: 'ecst', sourceName: 'ZIP 原 ECST 当前字段', title: '序列口径卡', instruction: '读取当前统计视图已渲染的字段标签，生成字段数、数值令牌和可读性回执。', empty: '当前统计视图没有可读字段。', missing: '原统计视图尚未渲染。', forbidden: '统计总览、宏观预测', visual: 'metadata' },
  { id: '03', tab: 'ectr', sourceName: 'ZIP 原 ECTR 当前方向', title: '货运方向拆解', instruction: '读取当前贸易视图已显示的方向与周期标签，构造方向链路回执。', empty: '当前贸易视图没有可读方向标签。', missing: '原贸易视图尚未渲染。', forbidden: '贸易流量、国家排行', visual: 'direction' },
  { id: '04', tab: 'wfii', sourceName: '美国财政部 TIC 月度跨境资金流 + ZIP 原 WFII 上下文', title: 'TIC 跨境流剖面', instruction: '在保留原资本流动视图后读取美国财政部已发布 TIC：净流入、私人/官方分项与观察月；不以 FDI 图、短端利率或国别排名替代。', empty: '当前资金视图没有可读类别。', missing: '原资金视图尚未渲染。', forbidden: '全球 FDI、国别排行', visual: 'metadata' },
  { id: '05', tab: 'ecwb', sourceName: 'ZIP 原 ECWB 自选清单', title: '自选项核对单', instruction: '从当前工作台已渲染的自选项读取结构，形成可勾选的本地核对回执。', empty: '当前自选清单为空。', missing: '原工作台视图尚未渲染。', forbidden: '工作台、相关性矩阵', visual: 'checklist' },
  { id: '06', tab: 'rsan', sourceName: '美联储货币政策官方 RSS 发布链', title: '官方发布时间链', instruction: '按美联储货币政策官方 RSS 的实际发布日期排列最近发布，并计算首末时间跨度；不把标题转换为地缘传导或风险评级。', empty: '官方发布流没有足够条目。', missing: '原事件视图尚未渲染。', forbidden: '地缘新闻、风险评级、事件传导', visual: 'chain' },
  { id: '07', tab: 'ecob', sourceName: 'ZIP 原 ECOB 指标字段', title: '指标口径对照', instruction: '读取当前指标卡的可见字段，输出单位/数值令牌的读取回执。', empty: '当前指标卡没有可读字段。', missing: '原指标视图尚未渲染。', forbidden: '关键指标、信号总览', visual: 'metadata' },
  { id: '08', tab: 'ecfc', sourceName: 'ZIP 原 ECFC 版本字段', title: '预测版本尺', instruction: '读取当前预测视图的版本与时间文本，显示版本顺序而不复制预测值。', empty: '当前预测视图没有版本文本。', missing: '原预测视图尚未渲染。', forbidden: '预测清单、走势预测', visual: 'ladder' },
  { id: '09', tab: 'shok', sourceName: '美国财政部日度 PAR 曲线 + 用户 bp 平移', title: '实际曲线冲击算术', instruction: '选择实际 2 年或 10 年 PAR 期限点并输入 bp 平移，终端复算冲击后收益率；不估算久期、债券价格或资产影响。', empty: '请输入有限的 bp 平移。', missing: '原情景视图尚未渲染。', forbidden: '价格预测、资产影响', visual: 'chain' },
  { id: '10', tab: 'wirp', sourceName: '美联储官方 RSS 的声明/纪要材料窗口', title: 'FOMC 材料发布日期窗口', instruction: '读取可识别的最新 FOMC 声明与会议纪要官方发布日期并计算差值；不推断会议日、利率概率或市场路径。', empty: '官方材料无法形成窗口。', missing: '原利率窗口视图尚未渲染。', forbidden: '利率概率、概率分布、市场路径', visual: 'clock' },
  { id: '11', tab: 'fcon', sourceName: 'ZIP 原 FCON 条件字段', title: '条件读取清单', instruction: '读取当前条件字段标签，形成字段可读性清单，不生成金融状况指数。', empty: '当前条件视图没有可读字段。', missing: '原条件视图尚未渲染。', forbidden: '金融状况指数、热力图', visual: 'checklist' },
  { id: '12', tab: 'ecsu', sourceName: 'ZIP 原 ECSU 三点字段', title: '意外归因便签', instruction: '读取可见的前值、预测、实际令牌，展示“三点是否齐全”的计算回执。', empty: '当前意外记录没有三点字段。', missing: '原意外视图尚未渲染。', forbidden: '经济意外、意外指数', visual: 'formula' },
  { id: '13', tab: 'tayl', sourceName: 'BLS CPI-U、FRED EFFR + 用户明确研究参数', title: '参数化研究算术', instruction: '输入中性利率、通胀目标、产出缺口与权重，终端把它们与已发布 CPI-U 12 月变化、实际 EFFR 并列复算；不是目标利率建议。', empty: '请完整输入有限研究参数。', missing: '研究参数校验失败。', forbidden: '政策建议、目标利率', visual: 'formula' },
  { id: '14', tab: 'ecan', sourceName: 'ZIP 原 ECAN 变量标签', title: '假设边界板', instruction: '读取当前分析页变量文本，列出已观测与不可推断边界，不生成观点。', empty: '当前分析视图没有变量文本。', missing: '原分析视图尚未渲染。', forbidden: '经济分析、投资观点', visual: 'ledger' },
  { id: '15', tab: 'mosp', sourceName: 'ZIP 原 MOSP 合约字段', title: '合约到期尺', instruction: '读取当前合约页面的日期和问题令牌，显示到期字段回执，不绘制概率。', empty: '当前合约没有日期或问题字段。', missing: '原合约视图尚未渲染。', forbidden: '预测市场、概率走势', visual: 'clock' },
  { id: '16', tab: 'cenb', sourceName: '已配置的央行官方来源目录', title: '央行来源目录卡', instruction: '终端读取项目内可审计的央行官方机构目录、首个来源和地区覆盖；不绘制地图，不假设各机构均有实时利率。', empty: '当前没有可审计的央行官方来源。', missing: '原央行视图尚未渲染。', forbidden: '全球利率总览、世界地图', visual: 'metadata' },
  { id: '17', tab: 'cbrt', sourceName: 'ZIP 原 CBRT 利率序列', title: '利率变更序列', instruction: '读取当前序列文本中的正负号与数值令牌，形成离散变化计数。', empty: '当前利率视图没有可读数值。', missing: '原利率视图尚未渲染。', forbidden: '央行利率、全球利率总览', visual: 'ladder' },
  { id: '18', tab: 'fomc', sourceName: '美联储官方 RSS + FOMC 会议纪要原文', title: 'FOMC 会议纪要原文证据', instruction: '从官方 RSS 定位最近可识别会议纪要，再在终端内展示规则关键词附近的有限官方原文上下文；不创建会议日程或点阵图。', empty: '当前官方发布流未发现会议纪要。', missing: '原会议视图尚未渲染。', forbidden: '会议日程、点阵图、情绪评级', visual: 'checklist' },
  { id: '19', tab: 'foms', sourceName: '美联储官方 RSS + FOMC 声明原文', title: 'FOMC 声明原文证据', instruction: '从官方 RSS 定位最近可识别声明，再在终端内展示规则关键词附近的有限官方原文上下文；不输出情绪评分。', empty: '当前官方发布流未发现声明。', missing: '原声明视图尚未渲染。', forbidden: '声明摘要、情绪评级、市场影响', visual: 'ledger' },
  { id: '20', tab: 'fdsp', sourceName: '美联储 SEP 官方可访问表 + ZIP 原 FDSP 上下文', title: 'SEP 预测范围尺', instruction: '在保留原分布视图后读取美联储官方 SEP 表 1 的公开中位数与全体预测范围；不从原点阵图或第三方图表推断数值。', empty: '当前原分布上下文不可读。', missing: '美联储 SEP 官方可访问材料当前不可读取。', forbidden: '联储分析仪、原点阵图', visual: 'ladder' },
  { id: '21', tab: 'be', sourceName: 'SEC / 美联储官方 RSS 可用性快照', title: '多源官方发布时效簿', instruction: '读取 SEC 新闻稿、美联储货币政策和美联储研究 RSS 的可用性与最新实际发布日期，计算发布至本次读取的自然时长；不重复新闻清单或情绪标签。', empty: '当前官方发布源没有可读日期。', missing: '原新闻视图尚未渲染。', forbidden: '经济新闻清单、情绪标签、市场影响', visual: 'ledger' },
  { id: '22', tab: 'beco', sourceName: 'Eurostat HICP、BLS CPI-U 实际指数', title: '跨区域通胀口径栏', instruction: '在两项官方价格指数均有 13 个可读月度点时，计算各自 12 月变化与百分点差，并保留不同方法/观察期边界。', empty: '当前区域视图没有可读字段。', missing: '原区域视图尚未渲染。', forbidden: 'GDP 图、市场预测', visual: 'direction' },
  { id: '23', tab: 'bie', sourceName: 'World Bank 主权宏观字段 + 用户国家选择', title: '可选国家资料夹', instruction: '选择支持国家后，终端读取该国家 World Bank 的年份、通胀与债务/GDP 字段；不自动选国家、不制作风险评分或国家排名。', empty: '请选择国家。', missing: '原国家视图尚未渲染。', forbidden: '风险评分、国家排行', visual: 'metadata' },
  { id: '24', tab: 'pmi', sourceName: 'S&P Global PMI 官方公开发布 + ZIP 原 PMI 上下文', title: '官方扩散阈值尺', instruction: '在保留原 PMI 视图后读取标准普尔全球公开美国制造业 PMI，计算官方当前值相对 50 的距离；来源不可读时明确失败。', empty: '当前 PMI 原视图没有可读上下文。', missing: '标准普尔全球官方公开发布当前不可读取。', forbidden: '标普 PMI、总览柱图', visual: 'formula' },
  { id: '25', tab: 'eco', sourceName: 'location.search 的 tab 参数', title: '深链校验条', instruction: '核对当前 `?tab=` 参数是否属于 ZIP 24 个原标签，不建立第二套导航。', empty: '当前地址没有 tab 参数，默认使用 ECO。', missing: 'tab 参数不属于原标签集合。', forbidden: '标签导航、功能推荐', visual: 'ledger' },
  { id: '26', tab: 'eco', sourceName: 'ZIP 原 ECO 筛选按钮状态', title: '筛选条件回执', instruction: '读取当前原日历视图可见事件数，记录筛选后可见性，不复刻日历表。', empty: '当前筛选没有可见事件。', missing: '原筛选状态不可读取。', forbidden: '日历表、事件预测', visual: 'checklist' },
  { id: '27', tab: 'eco', sourceName: 'ZIP 原 ECO 热力图单元', title: '单元格释义卡', instruction: '读取当前热力图数值令牌，说明颜色阈值，不重画矩阵。', empty: '当前热力图没有可读单元。', missing: '原热力图未在当前视图出现。', forbidden: '偏差热力图、国家矩阵', visual: 'metadata' },
  { id: '28', tab: 'ecwb', sourceName: 'ZIP 原 ECWB 自选 DOM 变化', title: '自选项变更记录', instruction: '捕获两次真实原视图之间的文本差异，输出新增/移除令牌计数。', empty: '请先读取一次原视图作为基线。', missing: '原自选清单尚未渲染。', forbidden: '自选指标卡、指标添加器', visual: 'ledger' },
  { id: '29', tab: 'ecwb', sourceName: 'ZIP 原 ECWB 当前视图文本', title: '视图切换回执', instruction: '读取当前视图的文本指纹，记录视图切换前后是否发生实际内容变化。', empty: '请先读取当前视图。', missing: '原工作台视图尚未渲染。', forbidden: '相关性矩阵、视图总览', visual: 'direction' },
];

const VALID_TABS = new Set(['eco', 'ecst', 'ectr', 'wfii', 'ecwb', 'rsan', 'ecob', 'ecfc', 'shok', 'wirp', 'fcon', 'ecsu', 'tayl', 'ecan', 'mosp', 'cenb', 'cbrt', 'fomc', 'foms', 'fdsp', 'be', 'beco', 'bie', 'pmi']);

const ACTION_LABELS: Record<string, string> = {
  '01': '折算 BLS 官方发布时刻', '02': '核对序列口径', '03': '读取同期贸易净额', '04': '读取 TIC 流量', '05': '读取实际平均时薪', '06': '读取官方发布时间链', '07': '读取工业产出观察', '08': '读取月度 GDP 观察', '09': '复算曲线冲击', '10': '读取 FOMC 材料窗口', '11': '读取短端定义观察', '12': '读取 JOLTS 实际变化', '13': '复算研究表达', '14': '读取官方覆盖边界', '15': '读取 Bill 日期链', '16': '读取央行官方目录', '17': '读取央行实际变化', '18': '读取会议纪要原文', '19': '读取声明原文', '20': '读取 SEP 范围', '21': '读取多源时效', '22': '比较通胀口径', '23': '读取国家资料', '24': '读取官方 PMI', '25': '校验当前深链', '26': '读取零售实际观察', '27': '读取短观 DI', '28': '读取就业与视图基线', '29': '记录薪酬与视图指纹',
};

function successMessage(id: string, audit: ViewAudit, input: string, baseline: string | null) {
  const texts: Record<string, string> = {
    '01': `已识别 ${audit.timeTokens.length} 个可见时间令牌，可用于终端内时刻折算。`,
    '02': `已核对 ${audit.numericTokens} 个统计数值字段与 ${audit.characters} 个可读字符。`,
    '03': `已拆解上行 ${audit.directions.positive} 个、下行 ${audit.directions.negative} 个方向符号。`,
    '04': `已检查当前资金类别文本覆盖 ${audit.characters} 个字符。`,
    '05': `已核对自选清单：数值字段 ${audit.numericTokens} 个，文本片段 ${audit.fragments.length} 段。`,
    '06': `已从当前事件视图提取 ${Math.min(audit.fragments.length, 3)} 个传导链节点。`,
    '07': `已对照当前指标字段：数值令牌 ${audit.numericTokens} 个。`,
    '08': `已提取版本阶梯的 ${audit.values.length} 个可读数值节点。`,
    '09': `已生成 ${Math.min(audit.fragments.length, 3)} 帧当前情景路径回执。`,
    '10': `已标注 ${audit.timeTokens.length} 个会议窗口时间令牌。`,
    '11': `已核对条件字段：${audit.fragments.length} 个文本片段可读。`,
    '12': `已计算三点字段回执：当前可读数值令牌 ${audit.numericTokens} 个。`,
    '13': `已按显式输入 ${input} 完成本地平方试算。`,
    '14': `已标记当前变量文本 ${audit.fragments.length} 段；不生成观点或推断。`,
    '15': `已提取合约页面 ${audit.timeTokens.length} 个日期/时间令牌。`,
    '16': `已在当前原视图中找到辖区“${input.trim()}”的本地文本匹配。`,
    '17': `已汇总离散变化：上行 ${audit.directions.positive}，下行 ${audit.directions.negative}。`,
    '18': `已核对会议材料文本块：${audit.fragments.length} 段可读。`,
    '19': `已统计声明文本片段 ${audit.fragments.length} 段，不输出情绪结论。`,
    '20': `已计算当前分布令牌区间：${audit.values.length ? `${Math.min(...audit.values)} → ${Math.max(...audit.values)}` : '无可读数值'}。`,
    '21': `已记录来源时效字段：时间令牌 ${audit.timeTokens.length} 个。`,
    '22': `已检查跨区域字段：数值令牌 ${audit.numericTokens} 个、方向符号 ${audit.directions.positive + audit.directions.negative} 个。`,
    '23': `已汇总国家资料字段：${audit.fragments.length} 段可读文本。`,
    '24': `已测量首个可读 PMI 数值相对阈值 50 的距离。`,
    '25': `已校验当前深链参数，审计了 ${audit.characters} 个原视图字符。`,
    '26': `已核对当前原筛选控件与 ${audit.fragments.length} 个原视图文本片段。`,
    '27': `已提取热力图/原视图 ${audit.values.length} 个数值令牌用于单元格释义。`,
    '28': baseline === null ? '已记录第一次原视图文本作为基线；再次执行才比较差异。' : `已比较两次文本，长度差 ${Math.abs(audit.text.length - baseline.length)} 字符。`,
    '29': `已记录当前视图文本指纹：${audit.characters}:${audit.numericTokens}:${audit.timeTokens.length}。`,
  };
  return texts[id] ?? `已完成当前原视图读取：${audit.characters} 个字符。`;
}

function operationDetails(id: string, audit: ViewAudit, input: string, baseline: string | null): OperationDetail[] {
  const uniqueWords = new Set(audit.fragments.flatMap((item) => item.split(/\s+/).filter((word) => word.length > 1)));
  const plusMinus = audit.directions.positive + audit.directions.negative;
  const dateLike = audit.text.match(/\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{4}Q[1-4]/g) ?? [];
  const flags = audit.text.match(/🇺🇸|🇪🇺|🇨🇳|🇯🇵|🇬🇧|🇩🇪|🇨🇦|🇦🇺/g) ?? [];
  const numberRange = audit.values.length ? `${Math.min(...audit.values)} → ${Math.max(...audit.values)}` : '无';
  const base: Record<string, OperationDetail[]> = {
    '01': [{ label: '首个时刻', value: audit.timeTokens[0] ?? '无', tone: 'cyan' }, { label: '时刻节点', value: String(audit.timeTokens.length), tone: 'teal' }, { label: '源事件行', value: String(audit.fragments.length), tone: 'amber' }],
    '02': [{ label: '数值字段', value: String(audit.numericTokens), tone: 'cyan' }, { label: '唯一词元', value: String(uniqueWords.size), tone: 'teal' }, { label: '时间字段', value: String(audit.timeTokens.length), tone: 'amber' }],
    '03': [{ label: '上行符号', value: String(audit.directions.positive), tone: 'teal' }, { label: '下行符号', value: String(audit.directions.negative), tone: 'amber' }, { label: '方向总数', value: String(plusMinus), tone: 'cyan' }],
    '04': [{ label: '官方来源', value: 'Treasury TIC', tone: 'cyan' }, { label: '发布频率', value: '月度', tone: 'teal' }, { label: '读取范围', value: '净/私人/官方', tone: 'amber' }],
    '05': [{ label: '自选片段', value: String(audit.fragments.length), tone: 'cyan' }, { label: '可核对字段', value: String(audit.numericTokens), tone: 'teal' }, { label: '结构状态', value: audit.characters ? '可读' : '空', tone: 'amber' }],
    '06': [{ label: '链路节点', value: String(Math.min(audit.fragments.length, 3)), tone: 'cyan' }, { label: '渠道词元', value: String(uniqueWords.size), tone: 'teal' }, { label: '方向标记', value: String(plusMinus), tone: 'amber' }],
    '07': [{ label: '指标词元', value: String(uniqueWords.size), tone: 'cyan' }, { label: '数值字段', value: String(audit.numericTokens), tone: 'teal' }, { label: '单位符号', value: String((audit.text.match(/%|万人|亿|万亿|bp/gi) ?? []).length), tone: 'amber' }],
    '08': [{ label: '版本节点', value: String(audit.values.length), tone: 'cyan' }, { label: '日期标记', value: String(dateLike.length), tone: 'teal' }, { label: '可读片段', value: String(audit.fragments.length), tone: 'amber' }],
    '09': [{ label: '官方期限点', value: 'Treasury PAR', tone: 'cyan' }, { label: '用户参数', value: '期限 + bp', tone: 'teal' }, { label: '输出范围', value: '收益率算术', tone: 'amber' }],
    '10': [{ label: '会议时刻', value: String(audit.timeTokens.length), tone: 'cyan' }, { label: '日期标记', value: String(dateLike.length), tone: 'teal' }, { label: '窗口文本', value: String(audit.fragments.length), tone: 'amber' }],
    '11': [{ label: '条件片段', value: String(audit.fragments.length), tone: 'cyan' }, { label: '可读词元', value: String(uniqueWords.size), tone: 'teal' }, { label: '数值字段', value: String(audit.numericTokens), tone: 'amber' }],
    '12': [{ label: '三点余数', value: String(audit.numericTokens % 3), tone: 'cyan' }, { label: '可读数值', value: String(audit.numericTokens), tone: 'teal' }, { label: '完整组数', value: String(Math.floor(audit.numericTokens / 3)), tone: 'amber' }],
    '13': [{ label: '用户参数', value: 'r* / π* / gap / a / b', tone: 'cyan' }, { label: '实际输入', value: 'CPI-U + EFFR', tone: 'teal' }, { label: '输出范围', value: '研究算术', tone: 'amber' }],
    '14': [{ label: '可观测片段', value: String(audit.fragments.length), tone: 'cyan' }, { label: '可读变量', value: String(uniqueWords.size), tone: 'teal' }, { label: '推断输出', value: '禁用', tone: 'amber' }],
    '15': [{ label: '日期标记', value: String(dateLike.length), tone: 'cyan' }, { label: '时间令牌', value: String(audit.timeTokens.length), tone: 'teal' }, { label: '问题片段', value: String(audit.fragments.length), tone: 'amber' }],
    '16': [{ label: '查询文本', value: input || '无', tone: 'cyan' }, { label: '本地匹配', value: input ? String((audit.text.toLowerCase().match(new RegExp(input.trim().toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length) : '0', tone: 'teal' }, { label: '外部跳转', value: '无', tone: 'amber' }],
    '17': [{ label: '上行变更', value: String(audit.directions.positive), tone: 'cyan' }, { label: '下行变更', value: String(audit.directions.negative), tone: 'teal' }, { label: '利率数值', value: String(audit.numericTokens), tone: 'amber' }],
    '18': [{ label: '材料块', value: String(audit.fragments.length), tone: 'cyan' }, { label: '日期标记', value: String(dateLike.length), tone: 'teal' }, { label: '核对状态', value: audit.characters ? '可读' : '空', tone: 'amber' }],
    '19': [{ label: '段落片段', value: String(audit.fragments.length), tone: 'cyan' }, { label: '句末标记', value: String((audit.text.match(/[。！？!?]/g) ?? []).length), tone: 'teal' }, { label: '情绪输出', value: '禁用', tone: 'amber' }],
    '20': [{ label: '数值区间', value: numberRange, tone: 'cyan' }, { label: '分位节点', value: String(audit.values.length), tone: 'teal' }, { label: '可读字段', value: String(audit.numericTokens), tone: 'amber' }],
    '21': [{ label: '时间标记', value: String(audit.timeTokens.length), tone: 'cyan' }, { label: '来源片段', value: String(audit.fragments.length), tone: 'teal' }, { label: '时效文本', value: String(dateLike.length), tone: 'amber' }],
    '22': [{ label: '欧元区系列', value: 'HICP EA20', tone: 'cyan' }, { label: '美国系列', value: 'CPI-U', tone: 'teal' }, { label: '比较方式', value: '12月变化率', tone: 'amber' }],
    '23': [{ label: '数据源', value: 'World Bank', tone: 'cyan' }, { label: '选择方式', value: '用户国家代码', tone: 'teal' }, { label: '禁止输出', value: '风险评分', tone: 'amber' }],
    '24': [{ label: '首个读数', value: audit.values[0]?.toString() ?? '无', tone: 'cyan' }, { label: '相对 50', value: audit.values[0] === undefined ? '不可算' : formatLocalNumber(audit.values[0] - 50), tone: 'teal' }, { label: '数值样本', value: String(audit.values.length), tone: 'amber' }],
    '25': [{ label: '地址参数', value: new URLSearchParams(window.location.search).get('tab') ?? '默认', tone: 'cyan' }, { label: '原标签有效', value: VALID_TABS.has(new URLSearchParams(window.location.search).get('tab') ?? 'eco') ? '是' : '否', tone: 'teal' }, { label: '二次导航', value: '未创建', tone: 'amber' }],
    '26': [{ label: '原筛选控件', value: String(document.querySelectorAll('[role="tabpanel"][data-state="active"] button').length), tone: 'cyan' }, { label: '可见片段', value: String(audit.fragments.length), tone: 'teal' }, { label: '事件表复刻', value: '否', tone: 'amber' }],
    '27': [{ label: '单元数值', value: String(audit.values.length), tone: 'cyan' }, { label: '正向令牌', value: String(audit.directions.positive), tone: 'teal' }, { label: '负向令牌', value: String(audit.directions.negative), tone: 'amber' }],
    '28': [{ label: '基线状态', value: baseline === null ? '首次建立' : '已存在', tone: 'cyan' }, { label: '长度差', value: baseline === null ? '待二读' : String(Math.abs(audit.text.length - baseline.length)), tone: 'teal' }, { label: '新增/移除', value: '仅本地比较', tone: 'amber' }],
    '29': [{ label: '文本指纹', value: `${audit.characters}:${audit.numericTokens}`, tone: 'cyan' }, { label: '时间维度', value: String(audit.timeTokens.length), tone: 'teal' }, { label: '视图变化', value: '再次读取核对', tone: 'amber' }],
  };
  return base[id] ?? [];
}

function visualIcon(kind: VisualKind) {
  if (kind === 'clock') return CalendarClock;
  if (kind === 'checklist') return CheckSquare;
  if (kind === 'chain' || kind === 'direction') return GitBranch;
  if (kind === 'formula') return Sigma;
  if (kind === 'ladder') return CircleGauge;
  if (kind === 'ledger') return ListChecks;
  return FileSearch;
}

function readPreservedText() {
  const preserved = document.querySelector('[data-preserved-economic-hub="true"]');
  const activePanel = preserved?.querySelector('[role="tabpanel"][data-state="active"]');
  return (activePanel?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function extractNumericValues(id: string, text: string, numericTokens: string[]) {
  if (id === '24') {
    const pmiValues = [...text.matchAll(/(?:制造业PMI|服务业PMI|综合PMI|全球PMI均值)\s*(\d+(?:\.\d+)?)/g)].map((match) => Number(match[1])).filter(Number.isFinite);
    if (pmiValues.length) return [...new Set(pmiValues)];
  }
  return numericTokens.map((value) => Number(value.replace('%', ''))).filter(Number.isFinite).slice(0, 12);
}

function stableViewFingerprint(text: string) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function SpecOutputVisual({ id, audit, computed, baseline, input, receipt }: { id: string; audit: ViewAudit | null; computed: number | null; baseline: string | null; input: string; receipt: RealDataReceipt | null }) {
  if (!audit) return <p className="mt-3 text-[9px] leading-4 text-slate-500">等待执行：该区域只在读取当前 ZIP 原视图或校验显式输入后生成，不预填示例结果。</p>;
  const dates = audit.text.match(/\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{4}Q[1-4]/g) ?? [];
  const units = audit.text.match(/%|bp|万人|亿|万亿|美元|指数/gi) ?? [];
  const first = audit.fragments[0] ?? '无可读片段';
  const range = audit.values.length ? `${Math.min(...audit.values)} → ${Math.max(...audit.values)}` : '无可读区间';
  const marker = (label: string, active: boolean) => <div key={label} className="flex items-center gap-1 text-[8px] text-slate-300"><span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-400' : 'bg-amber-400'}`} />{label}</div>;
  switch (id) {
    case '01': return <div className="mt-3 space-y-2"><p className="font-mono text-[8px] text-cyan-300">BLS / RELEASE TIME CONVERSION</p>{receipt?.available ? receipt.facts.map((fact, index) => <div key={fact.label} className="grid grid-cols-[auto_1fr] gap-2 border-l-2 border-cyan-800 pl-2"><span className="font-mono text-[8px] text-slate-500">T{index + 1}</span><div><p className="text-[8px] text-slate-500">{fact.label}</p><p className="font-mono text-[9px] text-cyan-100">{fact.value}</p></div></div>) : <p className="text-[9px] text-slate-500">选择展示时区后读取 BLS 官方发布时间；不使用原日历时刻代替。</p>}</div>;
    case '02': return <div className="mt-3 space-y-2"><p className="font-mono text-[8px] text-cyan-300">BLS / CPI-U OBSERVATION LADDER</p>{receipt?.available ? receipt.facts.map((fact, index) => <div key={fact.label} className="border-l-2 border-cyan-900 pl-2"><div className="flex justify-between gap-2 text-[8px]"><span className="text-slate-400">{fact.label}</span><span className="font-mono text-cyan-100">{fact.value}</span></div><div className="mt-1 h-1.5 rounded bg-slate-800"><div className="h-full rounded bg-cyan-500/70" style={{ width: `${44 + index * 18}%` }} /></div></div>) : <p className="text-[8px] text-slate-500">读取 BLS CPI-U 的最新观察、前期与发布频率；不显示字符或词元统计。</p>}</div>;
    case '03': { const tradeFacts = receipt?.facts ?? []; const tradeAmounts = tradeFacts.map((fact) => Math.abs(Number.parseFloat(fact.value.replace(/,/g, ''))) || 0); const tradeMax = Math.max(...tradeAmounts, 1); return <div className="mt-3 space-y-2"><p className="font-mono text-[8px] text-teal-300">EU27 / TRADE BALANCE SPLIT</p>{receipt?.available ? tradeFacts.map((fact, index) => <div key={fact.label}><div className="flex justify-between text-[8px]"><span className="text-slate-400">{fact.label}</span><span className="font-mono text-teal-100">{fact.value}</span></div><div className="mt-1 h-2 rounded bg-slate-800"><div className={`h-full rounded ${index === 0 ? 'bg-cyan-500/70' : index === 1 ? 'bg-teal-500/70' : 'bg-amber-500/70'}`} style={{ width: `${Math.max(7, Math.round((tradeAmounts[index]! / tradeMax) * 100))}%` }} /></div></div>) : <p className="text-[8px] text-slate-500">仅在同一观察期的 Eurostat 出口和进口均可读时，显示实际同期净额。</p>}<p className="text-[8px] text-slate-500">柱长按本次实际金额绝对值归一，不表示贸易趋势或国家排行。</p></div>; }
    case '04': {
      if (!receipt) return <p className="mt-3 text-[9px] text-slate-500">等待美国财政部 TIC 月度跨境流读取；不使用原视图字符或保留图形代替。</p>;
      if (!receipt.available) return <p className="mt-3 rounded border border-rose-900/60 bg-rose-950/20 p-2 text-[9px] text-rose-100">TIC 官方发布当前不可读；未将原 FDI 图、短端利率或 ZIP 固定数值用作替代。</p>;
      const flows = receipt.facts.slice(0, 3);
      const magnitudes = flows.map((fact) => Math.abs(Number.parseFloat(fact.value)) || 0);
      const maximum = Math.max(...magnitudes, 1);
      return <div className="mt-3 space-y-2"><p className="font-mono text-[8px] text-cyan-300">TIC / MONTHLY FLOW SPLIT</p>{flows.map((fact, index) => <div key={fact.label}><div className="flex justify-between gap-2 text-[8px]"><span className="text-slate-400">{fact.label}</span><span className={fact.tone === 'cyan' ? 'text-cyan-200' : fact.tone === 'teal' ? 'text-teal-200' : 'text-amber-200'}>{fact.value}</span></div><div className="mt-1 h-2 overflow-hidden rounded bg-slate-800"><div className={`h-full rounded ${index === 0 ? 'bg-cyan-500/75' : index === 1 ? 'bg-teal-500/75' : 'bg-amber-500/75'}`} style={{ width: `${Math.max(8, Math.round((magnitudes[index]! / maximum) * 100))}%` }} /></div></div>)}<p className="text-[8px] text-slate-500">柱长按本次发布的绝对金额归一；金额单位见指标，不能据此推断国别归因或交易方向。</p></div>;
    }
    case '05': return <div className="mt-3 rounded border border-teal-900/60 bg-teal-950/15 p-2"><p className="font-mono text-[8px] text-teal-300">BLS / PRIVATE WAGE CHECK</p>{receipt?.available ? <div className="mt-2 grid grid-cols-3 gap-1">{receipt.facts.map((fact) => <div key={fact.label} className="rounded border border-teal-900/40 p-1 text-center"><p className="text-[7px] text-slate-500">{fact.label}</p><p className="mt-1 truncate font-mono text-[9px] text-teal-100">{fact.value}</p></div>)}</div> : <p className="mt-2 text-[8px] text-slate-500">读取 BLS 私营平均时薪及前期观察；不将自选清单片段当作工资数据。</p>}</div>;
    case '06': return <div className="mt-3 space-y-2"><p className="font-mono text-[8px] text-cyan-300">FED / OFFICIAL RELEASE CHAIN</p>{receipt?.evidence?.map((item, index) => <div key={item.label} className="grid grid-cols-[auto_1fr] gap-2"><span className="flex h-4 w-4 items-center justify-center rounded-full border border-cyan-900 text-[8px] text-cyan-200">{index + 1}</span><div className="min-w-0"><p className="font-mono text-[8px] text-teal-300">{item.label}</p><p className="truncate text-[8px] text-slate-300">{item.text}</p></div></div>) ?? <p className="text-[9px] text-slate-500">读取最近官方发布的实际次序和时间跨度。</p>}</div>;
    case '07': return <div className="mt-3"><p className="font-mono text-[8px] text-cyan-300">FED G.17 / INDPRO ACTUAL</p>{receipt?.available ? <div className="mt-2 space-y-1.5">{receipt.facts.map((fact, index) => <div key={fact.label} className="flex items-center gap-2"><span className="w-16 text-[8px] text-slate-500">{fact.label}</span><div className="h-2 flex-1 rounded bg-slate-800"><div className={`h-full rounded ${index === 0 ? 'bg-cyan-500/70' : index === 1 ? 'bg-teal-500/70' : 'bg-amber-500/70'}`} style={{ width: `${42 + index * 17}%` }} /></div><span className="font-mono text-[8px] text-cyan-100">{fact.value}</span></div>)}</div> : <p className="mt-2 text-[8px] text-slate-500">读取 Fed G.17 工业产出实际观察、前期和频率；不使用原字段单位标签。</p>}</div>;
    case '08': return <div className="mt-3"><p className="font-mono text-[8px] text-violet-300">ONS / MONTHLY GDP RELEASE</p>{receipt?.available ? <div className="mt-2 flex h-20 items-end gap-2 border-b border-slate-700 pb-1">{receipt.facts.map((fact, index) => <div key={fact.label} className="flex flex-1 flex-col items-center gap-1"><span className="w-full rounded-t bg-violet-500/65" style={{ height: `${28 + index * 20}%` }} /><span className="text-center text-[7px] text-slate-500">{fact.label}</span><span className="font-mono text-[8px] text-violet-100">{fact.value}</span></div>)}</div> : <p className="mt-2 text-[8px] text-slate-500">读取 ONS 月度 GDP 实际观察及版本边界；不将 ZIP 预测版本数值绘制为实际序列。</p>}</div>;
    case '09': {
      if (!receipt?.available) return <p className="mt-3 text-[9px] text-slate-500">选择官方实际期限点与 bp 平移后显示收益率算术；没有曲线或参数时不绘制情景路径。</p>;
      return <div className="mt-3"><p className="font-mono text-[8px] text-cyan-300">PAR / SHOCK ARITHMETIC</p><div className="mt-3 flex items-center gap-1">{receipt.facts.map((fact, index) => <div key={fact.label} className="min-w-0 flex-1"><div className={`rounded border p-2 text-center ${index === 1 ? 'border-amber-800 bg-amber-950/20' : 'border-cyan-900 bg-slate-900/50'}`}><p className="text-[7px] text-slate-500">{fact.label}</p><p className="mt-1 truncate font-mono text-[9px] text-cyan-100">{fact.value}</p></div>{index < receipt.facts.length - 1 && <div className="mx-auto h-3 w-px bg-cyan-800" />}</div>)}</div><p className="mt-2 text-[8px] text-slate-500">路径仅表示“实际 PAR + 用户 bp/100”的算术步骤。</p></div>;
    }
    case '10': return <div className="mt-3"><p className="font-mono text-[8px] text-cyan-300">FOMC / MATERIAL DATE WINDOW</p>{receipt?.evidence?.map((item, index) => <div key={item.label} className="mt-2 grid grid-cols-[auto_1fr] gap-2 rounded border border-slate-800 p-2"><span className="font-mono text-[9px] text-cyan-200">{index === 0 ? 'S' : 'M'}</span><div className="min-w-0"><p className="text-[8px] text-teal-300">{item.label}</p><p className="truncate text-[8px] text-slate-300">{item.text}</p></div></div>) ?? <p className="mt-2 text-[9px] text-slate-500">仅在官方 RSS 同时可识别声明和纪要时显示发布日期窗口。</p>}</div>;
    case '11': return <div className="mt-3 overflow-hidden rounded border border-slate-800 text-[8px]"><p className="border-b border-slate-800 bg-slate-900/60 px-2 py-1 font-mono text-cyan-300">SOFR / IORB / ON RRP DEFINITIONS</p>{receipt?.available ? receipt.facts.map((fact, index) => <div key={fact.label} className="grid grid-cols-[auto_1fr] gap-2 border-b border-slate-800 px-2 py-1.5 last:border-b-0"><span className="font-mono text-teal-300">{index + 1}</span><div className="flex justify-between gap-2"><span className="text-slate-400">{fact.label}</span><span className="font-mono text-cyan-100">{fact.value}</span></div></div>) : <p className="p-2 text-slate-500">读取 SOFR、IORB 与 ON RRP 的不同单位和公开观察；不合成金融条件分数。</p>}</div>;
    case '12': return <div className="mt-3"><p className="font-mono text-[8px] text-amber-300">BLS JOLTS / ACTUAL CHANGE</p>{receipt?.available ? <div className="mt-2 flex gap-1">{receipt.facts.map((fact) => <div key={fact.label} className="flex-1 rounded border border-amber-900/60 p-1.5 text-center"><p className="text-[8px] text-slate-500">{fact.label}</p><p className="mt-1 truncate font-mono text-[10px] text-amber-100">{fact.value}</p></div>)}</div> : <p className="mt-2 text-[8px] text-slate-500">读取 BLS JOLTS 实际职位空缺及相邻变化；没有真实预期字段时不计算 surprise。</p>}</div>;
    case '13': return <div className="mt-3 rounded border border-amber-900/60 bg-amber-950/20 p-2"><p className="font-mono text-[8px] text-amber-300">RESEARCH ARITHMETIC</p>{receipt?.available ? <><div className="mt-2 grid grid-cols-3 gap-1">{receipt.facts.map((fact) => <div key={fact.label} className="min-w-0 rounded border border-amber-900/40 p-1 text-center"><p className="text-[7px] text-slate-500">{fact.label}</p><p className="mt-1 truncate font-mono text-[9px] text-amber-100">{fact.value}</p></div>)}</div><p className="mt-2 text-[8px] text-slate-500">输入参数与实际 CPI-U、EFFR 的公式边界见左侧数据回执。</p></> : <p className="mt-2 text-[8px] text-slate-500">完整输入五个研究参数后读取实际 CPI-U 与 EFFR；不会预填结论。</p>}</div>;
    case '14': return <div className="mt-3 overflow-hidden rounded border border-slate-800 text-[8px]"><div className="grid grid-cols-[1fr_auto] border-b border-slate-800 bg-slate-900/60 px-2 py-1 text-slate-500"><span>官方观察覆盖</span><span>推断</span></div>{receipt?.available ? receipt.facts.map((fact) => <div key={fact.label} className="grid grid-cols-[1fr_auto] gap-2 border-b border-slate-800 px-2 py-1.5 last:border-b-0"><span className="text-slate-300">{fact.label}</span><span className="font-mono text-cyan-100">{fact.value}</span></div>) : <div className="px-2 py-2 text-slate-500">只汇总官方可读序列、地区覆盖和缺口；不生成假设或投资结论。</div>}<div className="flex justify-end bg-amber-950/15 px-2 py-1 text-amber-300">自动推断：禁用</div></div>;
    case '15': return <div className="mt-3"><p className="font-mono text-[8px] text-cyan-300">TREASURY / BILL ISSUE-TO-MATURITY</p>{receipt?.available ? <div className="mt-2 flex items-center gap-1">{receipt.facts.map((fact, index) => <div key={fact.label} className="min-w-0 flex-1"><div className={`rounded border p-2 text-center ${index === 1 ? 'border-teal-800 bg-teal-950/20' : 'border-cyan-900 bg-slate-900/50'}`}><p className="text-[7px] text-slate-500">{fact.label}</p><p className="mt-1 truncate font-mono text-[9px] text-cyan-100">{fact.value}</p></div>{index < receipt.facts.length - 1 && <div className="mx-auto h-3 w-px bg-cyan-800" />}</div>)}</div> : <p className="mt-2 text-[8px] text-slate-500">读取美国财政部已发布 Bill 的期限、发行至到期天数和发行额；不显示原合约日期令牌。</p>}</div>;
    case '16': return <div className="mt-3 overflow-hidden rounded border border-teal-900/60 text-[8px]"><p className="border-b border-teal-900/60 bg-teal-950/20 px-2 py-1 font-mono text-teal-300">OFFICIAL CENTRAL-BANK SOURCE DIRECTORY</p>{receipt?.available ? receipt.facts.map((fact) => <div key={fact.label} className="flex justify-between gap-2 border-b border-slate-800 px-2 py-1.5"><span className="text-slate-500">{fact.label}</span><span className="font-mono text-teal-100">{fact.value}</span></div>) : <p className="p-2 text-slate-500">目录当前不可读；不使用本地文本匹配或虚构辖区利率代替。</p>}<p className="p-2 text-slate-500">仅为官方来源可审计目录；不表示每个辖区的实时政策、利率或地图覆盖。</p></div>;
    case '17': return <div className="mt-3"><p className="font-mono text-[8px] text-cyan-300">CENTRAL-BANK / ACTUAL OBSERVATION LADDER</p>{receipt?.available ? <div className="mt-2 space-y-2">{receipt.facts.map((fact, index) => <div key={fact.label} className="flex items-center gap-2"><span className="w-20 truncate text-[8px] text-slate-500">{fact.label}</span><div className="h-2 flex-1 rounded bg-slate-800"><div className={`h-full rounded ${index === 0 ? 'bg-cyan-500/70' : index === 1 ? 'bg-teal-500/70' : 'bg-amber-500/70'}`} style={{ width: `${38 + index * 19}%` }} /></div><span className="font-mono text-[8px] text-cyan-100">{fact.value}</span></div>)}</div> : <p className="mt-2 text-[8px] text-slate-500">读取跨机构已发布实际观察及各自相邻变化；不以 ZIP 正负符号构造全球利率总览。</p>}</div>;
    case '18': return <div className="mt-3 space-y-2"><p className="font-mono text-[8px] text-cyan-300">FOMC / MINUTES EVIDENCE</p>{receipt?.evidence?.map((item) => <div key={item.label} className="rounded border border-cyan-950 bg-cyan-950/10 p-2"><p className="font-mono text-[8px] text-cyan-300">{item.label}</p><p className="mt-1 line-clamp-3 text-[8px] leading-4 text-slate-300">{item.text}</p></div>) ?? <p className="text-[9px] text-slate-500">读取官方会议纪要正文的受限关键词上下文；没有正文不显示段落统计。</p>}</div>;
    case '19': return <div className="mt-3 space-y-2"><p className="font-mono text-[8px] text-violet-300">FOMC / STATEMENT EVIDENCE</p>{receipt?.evidence?.map((item) => <div key={item.label} className="rounded border border-violet-950 bg-violet-950/10 p-2"><p className="font-mono text-[8px] text-violet-300">{item.label}</p><p className="mt-1 line-clamp-3 text-[8px] leading-4 text-slate-300">{item.text}</p></div>) ?? <p className="text-[9px] text-slate-500">读取官方声明正文的受限关键词上下文；不输出句末计数或情绪标签。</p>}</div>;
    case '20': {
      if (!receipt) return <div className="mt-3"><div className="flex justify-between font-mono text-[9px] text-cyan-100"><span>等待 SEP</span><span>未读取</span></div><div className="mt-1 h-2 rounded-full bg-slate-800" /><p className="mt-2 text-[8px] text-slate-500">仅在美联储公开 SEP 表可读后显示中位数与全体预测范围。</p></div>;
      if (!receipt.available) return <div className="mt-3 rounded border border-rose-900/60 bg-rose-950/20 p-2 text-[9px] text-rose-100">SEP 官方可访问材料不可用；未使用原点阵图或数值令牌替代。</div>;
      return <div className="mt-3 space-y-2">{receipt.facts.map((fact, index) => <div key={fact.label}><div className="flex justify-between text-[8px] text-slate-400"><span>{fact.label}</span><span className={fact.tone === 'cyan' ? 'text-cyan-200' : fact.tone === 'teal' ? 'text-teal-200' : 'text-amber-200'}>{fact.value}</span></div><div className="mt-1 h-1.5 rounded bg-slate-800"><div className={`h-full rounded ${index === 0 ? 'bg-cyan-500/70' : index === 1 ? 'bg-teal-500/70' : 'bg-amber-500/70'}`} style={{ width: `${48 + index * 14}%` }} /></div></div>)}<p className="text-[8px] text-slate-500">格式：公开中位数 / 全体预测范围；范围不是概率区间。</p></div>;
    }
    case '21': return <div className="mt-3 overflow-hidden rounded border border-slate-800 text-[8px]"><p className="border-b border-slate-800 bg-slate-900/60 px-2 py-1 font-mono text-cyan-300">OFFICIAL RSS / FRESHNESS LEDGER</p>{receipt?.evidence?.map((item) => <div key={item.label} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 border-b border-slate-800 px-2 py-1.5 last:border-b-0"><span className="truncate text-slate-300">{item.label}</span><span className="max-w-28 truncate font-mono text-teal-200">{item.text}</span></div>) ?? <p className="p-2 text-slate-500">读取 SEC 与美联储官方 RSS 的实际可用性和最近发布日期。</p>}</div>;
    case '22': return <div className="mt-3"><p className="font-mono text-[8px] text-cyan-300">CPI / 12M COMPARISON</p>{receipt?.available ? <div className="mt-2 flex items-end gap-2 border-b border-slate-700 pb-1">{receipt.facts.slice(0, 2).map((fact, index) => <div key={fact.label} className="flex flex-1 flex-col items-center gap-1"><span className={index === 0 ? 'w-full rounded-t bg-cyan-500/70' : 'w-full rounded-t bg-teal-500/70'} style={{ height: `${22 + Math.min(58, Math.abs(Number.parseFloat(fact.value)) * 10)}%` }} /><span className="text-center text-[7px] text-slate-500">{fact.label}</span><span className="font-mono text-[8px] text-slate-200">{fact.value}</span></div>)}</div> : <p className="mt-2 text-[8px] text-slate-500">两项官方月度指数均可读取时，才显示各自 12 月变化柱。</p>}<p className="mt-2 text-[8px] text-slate-500">不将不同编制方法强行解释为经济表现或资产结论。</p></div>;
    case '23': return <div className="mt-3 rounded border border-slate-800 p-2"><p className="font-mono text-[8px] text-cyan-300">WORLD BANK / SELECTED DOSSIER</p>{receipt?.available ? <div className="mt-2 space-y-1">{receipt.facts.map((fact) => <div key={fact.label} className="flex justify-between gap-2 border-b border-slate-800 pb-1 text-[8px]"><span className="text-slate-500">{fact.label}</span><span className="font-mono text-cyan-100">{fact.value}</span></div>)}</div> : <p className="mt-2 text-[8px] text-slate-500">选择国家后读取 World Bank 的年份与可用字段；缺失字段不以国家评分代替。</p>}</div>;
    case '24': {
      const actualDistance = receipt ? (receipt.available ? receipt.facts.find((item) => item.label === '相对 50')?.value ?? '不可算' : '来源不可用') : (computed === null ? '—' : formatLocalNumber(computed));
      const actualValue = receipt ? (receipt.available ? receipt.facts.find((item) => item.label === '官方当前值')?.value ?? '未标注' : '来源不可用') : '未读取';
      return <div className="mt-3"><div className="flex items-center gap-3"><div className="flex h-14 w-14 items-center justify-center rounded-full border-4 border-amber-800 font-mono text-[10px] text-amber-100">{actualDistance}</div><div><p className="text-[8px] text-slate-500">S&P Global 美国制造业 PMI 相对荣枯线 50</p><p className="mt-1 text-[9px] text-amber-200">官方当前值 {actualValue}</p><p className="mt-1 text-[8px] text-slate-500">{receipt?.observedAt ? `观察期 ${receipt.observedAt}` : '等待官方发布读取'}</p></div></div></div>;
    }
    case '25': return <div className="mt-3 overflow-hidden rounded border border-cyan-900/60 text-[8px]"><p className="border-b border-cyan-900/60 bg-cyan-950/20 px-2 py-1 font-mono text-cyan-300">ZIP / DEEP-LINK CONTRACT</p>{receipt?.facts.map((fact) => <div key={fact.label} className="flex justify-between gap-2 border-b border-slate-800 px-2 py-1.5"><span className="text-slate-500">{fact.label}</span><span className="font-mono text-cyan-100">{fact.value}</span></div>)}<p className="px-2 py-1.5 text-slate-400">当前参数：<span className="font-mono text-teal-200">{new URLSearchParams(window.location.search).get('tab') ?? 'eco'}</span>；不发起市场资料读取或建立第二套导航。</p></div>;
    case '26': return <div className="mt-3"><p className="font-mono text-[8px] text-cyan-300">EUROSTAT / EA20 RETAIL ACTUAL</p>{receipt?.available ? <div className="mt-2 grid grid-cols-3 gap-1">{receipt.facts.map((fact, index) => <div key={fact.label} className="rounded border border-cyan-900/60 p-1.5 text-center"><p className="text-[7px] text-slate-500">{fact.label}</p><p className={`mt-1 truncate font-mono text-[9px] ${index === 1 ? 'text-teal-100' : 'text-cyan-100'}`}>{fact.value}</p></div>)}</div> : <p className="mt-2 text-[8px] text-slate-500">读取 Eurostat 欧元区零售实际观察、前期与观察期；不复刻事件筛选表。</p>}</div>;
    case '27': return <div className="mt-3"><p className="font-mono text-[8px] text-teal-300">BOJ / TANKAN MANUFACTURING DI</p>{receipt?.available ? <div className="mt-2 space-y-2">{receipt.facts.map((fact, index) => <div key={fact.label}><div className="flex justify-between text-[8px]"><span className="text-slate-400">{fact.label}</span><span className="font-mono text-teal-100">{fact.value}</span></div><div className="mt-1 h-2 rounded bg-slate-800"><div className={`h-full rounded ${index === 0 ? 'bg-teal-500/70' : index === 1 ? 'bg-cyan-500/70' : 'bg-amber-500/70'}`} style={{ width: `${36 + index * 21}%` }} /></div></div>)}</div> : <p className="mt-2 text-[8px] text-slate-500">读取日本银行短观大企业制造业 DI 的实际季度观察；不重绘国家矩阵。</p>}</div>;
    case '28': return <div className="mt-3 overflow-hidden rounded border border-slate-800 text-[8px]"><p className="border-b border-slate-800 bg-slate-900/60 px-2 py-1 font-mono text-cyan-300">ONS / EMPLOYMENT + VIEW BASELINE</p>{receipt?.available ? receipt.facts.map((fact) => <div key={fact.label} className="flex justify-between gap-2 border-b border-slate-800 px-2 py-1.5"><span className="text-slate-500">{fact.label}</span><span className="font-mono text-cyan-100">{fact.value}</span></div>) : <p className="px-2 py-1.5 text-slate-500">读取 ONS 在职人数实际观察后叠加本地视图基线。</p>}<div className="grid grid-cols-2 gap-2 bg-slate-950/50 px-2 py-1.5"><span className="text-slate-500">本地基线</span><span className="font-mono text-teal-200">{baseline === null ? '首次建立' : stableViewFingerprint(baseline)}</span><span className="text-slate-500">当前视图</span><span className="font-mono text-teal-200">{stableViewFingerprint(audit.text)}</span></div></div>;
    case '29': return <div className="mt-3 rounded border border-cyan-900/60 bg-cyan-950/20 p-2"><p className="font-mono text-[8px] text-cyan-300">ONS / REGULAR PAY + VIEW RECEIPT</p>{receipt?.available ? <div className="mt-2 grid grid-cols-3 gap-1">{receipt.facts.map((fact) => <div key={fact.label} className="rounded border border-cyan-900/40 p-1 text-center"><p className="text-[7px] text-slate-500">{fact.label}</p><p className="mt-1 truncate font-mono text-[8px] text-cyan-100">{fact.value}</p></div>)}</div> : null}<div className="mt-2 border-t border-cyan-900/40 pt-2"><p className="text-[8px] text-slate-500">当前活动 ZIP 视图的确定性本地指纹</p><p className="mt-1 font-mono text-sm text-cyan-100">FNV-1a / {stableViewFingerprint(audit.text)}</p><p className="mt-1 text-[8px] text-slate-500">再次读取仅核对视图状态变化，不计算相关性或市场结论。</p></div></div>;
    default: return null;
  }
}

export default function EconOneToOneExtensionBridge() {
  const search = useSearch();
  const [selectedId, setSelectedId] = useState('01');
  const [audit, setAudit] = useState<ViewAudit | null>(null);
  const [baseline, setBaseline] = useState<string | null>(null);
  const fingerprintRef = useRef<string | null>(null);
  const [input, setInput] = useState('');
  const [releaseZone, setReleaseZone] = useState<'Asia/Shanghai' | 'UTC' | 'America/New_York'>('Asia/Shanghai');
  const [curveTenor, setCurveTenor] = useState<'2 Yr' | '10 Yr'>('10 Yr');
  const [shockBps, setShockBps] = useState('25');
  const [countryCode, setCountryCode] = useState<'US' | 'DE' | 'JP' | 'GB'>('US');
  const [taylorInputs, setTaylorInputs] = useState({ neutralRate: '1', inflationTarget: '2', outputGap: '0', inflationWeight: '0.5', outputWeight: '0.5' });
  const [message, setMessage] = useState<string | null>(null);
  const [operationState, setOperationState] = useState<OperationState>('idle');
  const [attemptAt, setAttemptAt] = useState<Date | null>(null);
  const [details, setDetails] = useState<OperationDetail[]>([]);
  const [receipt, setReceipt] = useState<RealDataReceipt | null>(null);
  const activeTab = useMemo(() => {
    const value = new URLSearchParams(search).get('tab') || 'eco';
    return VALID_TABS.has(value) ? value : 'eco';
  }, [search]);
  const candidates = useMemo(() => SPECS.filter((item) => item.tab === activeTab), [activeTab]);
  const spec = candidates.find((item) => item.id === selectedId) ?? candidates[0] ?? SPECS[0];
  const dataProfileMutation = trpc.econ29Data.getProfile.useMutation();
  const Icon = visualIcon(spec.visual);

  const capture = async () => {
    setAttemptAt(new Date());
    setOperationState('loading');
    setMessage(`正在执行“${ACTION_LABELS[spec.id]}”…`);
    window.setTimeout(async () => {
    const text = readPreservedText();
    if (!text) {
      setAudit(null);
      setDetails([]);
      setMessage(spec.missing);
      setOperationState('error');
      return;
    }
    if (spec.id === '09' && !shockBps.trim()) {
      setDetails([]);
      setMessage('请输入有限的 bp 平移；终端不会预设冲击参数或模拟结果。');
      setOperationState('empty');
      return;
    }
    const timeTokens = text.match(/\b\d{1,2}:\d{2}\b/g) ?? [];
    const numericTokens = text.match(/[-+]?\d+(?:\.\d+)?%?/g) ?? [];
    const values = extractNumericValues(spec.id, text, numericTokens);
    const fragments = text.split(/[。；;，,]/).map((item) => item.trim()).filter(Boolean).slice(0, 8);
    const nextAudit = { at: new Date(), characters: text.length, numericTokens: numericTokens.length, timeTokens: [...new Set(timeTokens)].slice(0, 4), text, values, directions: { positive: (text.match(/[+▲↑]/g) ?? []).length, negative: (text.match(/[-▼↓]/g) ?? []).length }, fragments };
      setAudit(nextAudit);
      setDetails(operationDetails(spec.id, nextAudit, input, baseline));
      setReceipt(null);
      let realData: Awaited<ReturnType<typeof dataProfileMutation.mutateAsync>>;
      try {
        realData = await dataProfileMutation.mutateAsync({
          id: spec.id,
          ...(spec.id === '01' ? { releaseZone } : {}),
          ...(spec.id === '09' ? { tenor: curveTenor, shockBps: Number(shockBps) } : {}),
          ...(spec.id === '13' ? { taylor: { neutralRate: Number(taylorInputs.neutralRate), inflationTarget: Number(taylorInputs.inflationTarget), outputGap: Number(taylorInputs.outputGap), inflationWeight: Number(taylorInputs.inflationWeight), outputWeight: Number(taylorInputs.outputWeight) } } : {}),
          ...(spec.id === '23' ? { countryCode } : {}),
        });
      } catch (error) {
        const boundary = `真实数据读取请求失败：${error instanceof Error ? error.message : 'UNKNOWN'}。不以 ZIP 原视图、缓存猜测或固定数值替代。`;
        setReceipt({ available: false, source: '终端真实数据契约', sourceUrl: null, observedAt: null, retrievedAt: new Date().toISOString(), boundary, researchUse: '请求未返回可验证资料时不生成研究结论。', facts: [] });
        setDetails([]);
        setMessage(boundary);
        setOperationState('error');
        return;
      }
      if (!realData?.available) {
        const unavailableReceipt: RealDataReceipt = {
          available: false,
          source: realData?.source ?? '当前扩展数据契约',
          sourceUrl: realData?.sourceUrl ?? null,
          observedAt: realData?.observationDate ?? null,
          retrievedAt: realData?.retrievedAt ?? new Date().toISOString(),
          boundary: realData?.boundary ?? '当前真实数据契约没有返回可验证结果；未使用 ZIP 保留数值替代。',
          researchUse: realData?.researchUse ?? '当前来源不可用时不生成投资结论。',
          facts: [],
          evidence: realData?.evidence ?? [],
        };
        setReceipt(unavailableReceipt);
        setDetails([]);
        setMessage(unavailableReceipt.boundary);
        setOperationState('error');
        return;
      }
      const nextReceipt: RealDataReceipt = {
        available: true,
        source: realData.source,
        sourceUrl: realData.sourceUrl,
        observedAt: realData.observationDate,
        retrievedAt: realData.retrievedAt,
        boundary: realData.boundary,
        researchUse: realData.researchUse,
        facts: realData.metrics,
        evidence: realData.evidence ?? [],
      };
       setReceipt(nextReceipt);
       // 审计契约字段仍保存在 receipt.source；终端界面只呈现清洗后的内容定位，不展示供应商名称或第三方跳转地址。
      setDetails(nextReceipt.facts);
      const sourceMessage = `已读取${nextReceipt.source}的可验证数据（观察期：${nextReceipt.observedAt ?? '未标注'}）。`;
      const metricMessage = nextReceipt.facts.length ? `本次终端结果：${nextReceipt.facts.map((fact) => `${fact.label} ${fact.value}`).join('；')}。` : '本次契约未返回可展示指标。';
      if (spec.id === '25') {
        const rawTab = new URLSearchParams(window.location.search).get('tab');
        setMessage(`${sourceMessage}${rawTab && VALID_TABS.has(rawTab) ? `深链参数“${rawTab}”属于 ZIP 原标签集合；未创建第二套导航。` : '地址未提供有效 tab 参数，当前按 ECO 原标签处理；未创建第二套导航。'}`);
      } else if (spec.id === '28') {
        const currentFingerprint = stableViewFingerprint(text);
        setMessage(`${sourceMessage}${baseline === null ? `已建立当前保留视图基线 FNV-1a/${currentFingerprint}；再次读取仅核对是否发生状态变化。` : `当前保留视图 FNV-1a/${currentFingerprint} 与基线 FNV-1a/${stableViewFingerprint(baseline)} 的状态比较已完成。`}`);
        if (baseline === null) setBaseline(text);
      } else if (spec.id === '29') {
        const fingerprint = stableViewFingerprint(text);
        const changed = fingerprintRef.current !== null && fingerprintRef.current !== fingerprint;
        fingerprintRef.current = fingerprint;
        setMessage(`${sourceMessage}当前保留视图 FNV-1a/${fingerprint} 与上次读取${changed ? '不同' : '相同'}；这只记录视图状态，不推导相关性或市场结论。`);
      } else {
        setMessage(`${sourceMessage}${metricMessage}`);
    }
    setOperationState('success');
    }, 180);
  };

  const computed = useMemo(() => {
    if (!audit) return null;
    if (spec.id === '13') return Number(input) ** 2;
    if (spec.id === '24') {
      return audit.values.length ? Number((audit.values[0] - 50).toFixed(4)) : null;
    }
    if (spec.id === '28' && baseline) return Math.abs(audit.text.length - baseline.length);
    return null;
  }, [audit, baseline, input, spec.id]);

  return <section className="mx-4 mb-4 rounded-xl border border-cyan-900/50 bg-slate-950/80 p-3 text-slate-200" data-econ-one-to-one-extension="true" data-econ-extension-id={spec.id}>
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-2">
      <div><p className="font-mono text-[9px] text-cyan-300">ZIP CONTEXT EXTENSION / {spec.id} / {activeTab.toUpperCase()}</p><h2 className="mt-1 flex items-center gap-2 text-sm font-semibold"><Icon className="h-4 w-4 text-cyan-300" />{spec.title}</h2><p className="mt-1 max-w-4xl text-[10px] leading-4 text-slate-400">{spec.instruction}</p></div>
      <div className="rounded border border-slate-700 px-2 py-1 text-[9px] text-slate-400">原状态来源：{spec.sourceName}</div>
    </div>
    {candidates.length > 1 ? <div className="mt-2 flex flex-wrap gap-1" aria-label={`${activeTab} 的逐项扩展`}>{candidates.map((item) => <button key={item.id} type="button" onClick={() => { setSelectedId(item.id); setAudit(null); setDetails([]); setReceipt(null); setMessage(null); setBaseline(null); fingerprintRef.current = null; setAttemptAt(null); setOperationState('idle'); }} className={`rounded border px-2 py-1 text-[9px] outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${item.id === spec.id ? 'border-cyan-600 bg-cyan-950/50 text-cyan-100' : 'border-slate-700 text-slate-400 hover:border-cyan-800'}`}>{item.id} · {item.title}</button>)}</div> : null}
    <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="rounded border border-slate-800 bg-slate-900/35 p-3">
        {spec.id === '01' ? <label className="block text-[9px] text-slate-400">BLS 发布时间展示时区<select value={releaseZone} onChange={(event) => setReleaseZone(event.target.value as 'Asia/Shanghai' | 'UTC' | 'America/New_York')} className="mt-1 block w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100 outline-none focus-visible:border-cyan-400 focus-visible:ring-2 focus-visible:ring-cyan-400/70"><option value="Asia/Shanghai">Asia/Shanghai · GMT+8</option><option value="UTC">UTC</option><option value="America/New_York">America/New_York</option></select></label> : null}
        {spec.id === '09' ? <div className="grid gap-2 sm:grid-cols-2"><label className="block text-[9px] text-slate-400">官方实际期限<select value={curveTenor} onChange={(event) => setCurveTenor(event.target.value as '2 Yr' | '10 Yr')} className="mt-1 block w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100 outline-none focus-visible:border-cyan-400 focus-visible:ring-2 focus-visible:ring-cyan-400/70"><option value="2 Yr">2 年 PAR</option><option value="10 Yr">10 年 PAR</option></select></label><label className="block text-[9px] text-slate-400">用户平移（bp）<input inputMode="decimal" value={shockBps} onChange={(event) => setShockBps(event.target.value)} className="mt-1 block w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100 outline-none focus-visible:border-cyan-400 focus-visible:ring-2 focus-visible:ring-cyan-400/70" placeholder="例如 25" /></label></div> : null}
        {spec.id === '13' ? <div className="grid gap-2 sm:grid-cols-5">{([['neutralRate', '中性利率 r*'], ['inflationTarget', '通胀目标 π*'], ['outputGap', '产出缺口'], ['inflationWeight', '通胀权重 a'], ['outputWeight', '缺口权重 b']] as const).map(([key, label]) => <label key={key} className="block text-[8px] text-slate-400">{label}<input inputMode="decimal" value={taylorInputs[key]} onChange={(event) => setTaylorInputs((current) => ({ ...current, [key]: event.target.value }))} className="mt-1 block w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100 outline-none focus-visible:border-amber-400 focus-visible:ring-2 focus-visible:ring-amber-400/70" /></label>)}</div> : null}
        {spec.id === '23' ? <label className="block text-[9px] text-slate-400">World Bank 国家<select value={countryCode} onChange={(event) => setCountryCode(event.target.value as 'US' | 'DE' | 'JP' | 'GB')} className="mt-1 block w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100 outline-none focus-visible:border-cyan-400 focus-visible:ring-2 focus-visible:ring-cyan-400/70"><option value="US">US · 美国</option><option value="DE">DE · 德国</option><option value="JP">JP · 日本</option><option value="GB">GB · 英国</option></select></label> : null}
        <button type="button" onClick={capture} disabled={operationState === 'loading'} className="mt-2 inline-flex items-center gap-1 rounded border border-cyan-800 px-2.5 py-1.5 text-[10px] text-cyan-100 outline-none hover:bg-cyan-950/40 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-wait disabled:opacity-60"><RefreshCw className={`h-3 w-3 ${operationState === 'loading' ? 'animate-spin' : ''}`} />{operationState === 'loading' ? '正在读取上下文与官方数据…' : ACTION_LABELS[spec.id]}</button>
        <div className="mt-2 flex items-center gap-2 text-[9px]" role="status" aria-live="polite"><span className={`h-1.5 w-1.5 rounded-full ${operationState === 'loading' ? 'bg-amber-300 animate-pulse' : operationState === 'success' ? 'bg-emerald-400' : operationState === 'empty' ? 'bg-amber-400' : operationState === 'error' ? 'bg-rose-400' : 'bg-slate-500'}`} />{operationState === 'loading' ? '正在核验 ZIP 上下文并读取官方数据' : operationState === 'success' ? '操作完成：官方结果已在右侧可视化' : operationState === 'empty' ? '无可用输入或匹配' : operationState === 'error' ? '读取失败：保留真实原因' : '待执行：尚未读取官方数据'}</div>
        <div className="mt-2 grid gap-1 rounded border border-slate-800 bg-slate-950/40 px-2 py-1.5 text-[8px] text-slate-500"><span>原状态来源：{spec.sourceName}</span><span>本次操作时刻：{attemptAt ? attemptAt.toLocaleTimeString() : '尚未操作'}</span></div>
        {message ? <p className="mt-2 rounded border border-amber-900/70 bg-amber-950/20 p-2 text-[9px] leading-4 text-amber-100">{message}</p> : null}
         {audit ? <><div className="mt-2 grid gap-2 sm:grid-cols-3">{details.map((detail) => <div key={detail.label} className="rounded border border-slate-800 p-2"><p className="font-mono text-[8px] text-slate-500">{detail.label}</p><p className={`mt-1 truncate text-sm ${detail.tone === 'cyan' ? 'text-cyan-200' : detail.tone === 'teal' ? 'text-teal-200' : 'text-amber-200'}`}>{detail.value}</p></div>)}</div>{receipt ? <div className={`mt-2 rounded border p-2 text-[8px] leading-4 ${receipt.available ? 'border-teal-900/60 bg-teal-950/20 text-teal-100' : 'border-rose-900/60 bg-rose-950/20 text-rose-100'}`}><p>数据状态：{receipt.available ? '已清洗' : '暂不可用'}</p><p>观察期：{receipt.observedAt ?? '未标注'} · 本次读取：{new Date(receipt.retrievedAt).toLocaleString()}</p>{receipt.sourceUrl ? <p className="mt-1 break-all text-slate-400">内容定位已留档</p> : null}<p className="mt-1 text-slate-400">研究用途：{receipt.researchUse}</p><p className="mt-1 text-slate-400">边界：{receipt.boundary}</p></div> : null}</> : <p className="mt-2 text-[9px] text-slate-500">尚未读取当前原视图。{spec.id === '13' || spec.id === '16' ? spec.empty : '点击上方操作后，将按当前活动原标签显示真实读取结果。'}</p>}
      </div>
      <div className="rounded border border-slate-800 bg-slate-950/50 p-3" data-econ-extension-visual={`spec-${spec.id}`}><p className="font-mono text-[8px] text-cyan-300">{spec.id} / 专属真实数据输出</p>{receipt ? <div className="mt-2 grid grid-cols-3 gap-1">{receipt.facts.slice(0, 3).map((fact) => <div key={fact.label} className="rounded border border-slate-800 bg-slate-900/50 p-1.5"><p className="text-[7px] text-slate-500">{fact.label}</p><p className={`mt-1 truncate font-mono text-[9px] ${fact.tone === 'cyan' ? 'text-cyan-200' : fact.tone === 'teal' ? 'text-teal-200' : 'text-amber-200'}`}>{fact.value}</p></div>)}</div> : null}<SpecOutputVisual id={spec.id} audit={audit} computed={computed} baseline={baseline} input={input} receipt={receipt} /></div>
    </div>
    <p className="mt-2 border-t border-slate-800 pt-2 text-[8px] leading-4 text-slate-500">文字边界：本扩展不出现“{spec.forbidden}”。读取失败时仅显示真实失败原因；不跳转第三方页面。</p>
  </section>;
}
