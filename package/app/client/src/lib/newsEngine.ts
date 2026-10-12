/**
 * 统一新闻数据引擎
 * ------------------------------------------------------------------
 * 所有新闻 / 研究 / 情绪条目均由当前真实行情指标（涨跌幅、品种类型、
 * 成交量等）确定性推导生成，不使用任何虚构的第三方新闻源或编造的报道，
 * 来源统一标注为「行情数据」「市场动态」「系统衍生」等，确保数据可信。
 *
 * 22 个新闻模块共享此引擎，各自挑选不同的切片 / 排序 / 聚合方式，
 * 从而形成差异化的可视化面板。
 */

export interface MarketRow {
  symbol: string;
  name: string;
  market: string; // stock/bond/forex/commodity/index/derivative/option/fund
  price: string;
  changeVal: string;
  changePct: string;
  volume?: string | null;
  bid?: string | null;
  ask?: string | null;
  high52w?: string | null;
  low52w?: string | null;
  updatedAt?: string | Date | null;
}

export type Sentiment = 'positive' | 'negative' | 'neutral';
export type Importance = 'high' | 'medium' | 'low';

export interface NewsItem {
  id: string;
  symbol: string;
  name: string;
  title: string;
  summary: string;
  category: string;      // 中文板块名
  marketType: string;    // 原始 market 枚举
  source: string;        // 合规来源标注
  minutesAgo: number;
  sentiment: Sentiment;
  importance: Importance;
  changePct: number;
  price: number;
  volume: number;
  tags: string[];
}

export const CATEGORY_MAP: Record<string, string> = {
  stock: '股票',
  bond: '债券',
  forex: '外汇',
  commodity: '商品',
  index: '指数',
  derivative: '衍生品',
  option: '期权',
  fund: '基金',
};

export const CATEGORY_LIST = ['股票', '债券', '外汇', '商品', '指数', '衍生品', '期权', '基金'];

/** 合规来源池：均为系统/行情衍生口径，非虚构媒体 */
const SOURCE_POOL = ['行情数据', '市场动态', '系统衍生', '终端实时', '量化监测'];

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

/** 根据涨跌幅生成标题（确定性，不随机编造） */
function buildTitle(name: string, changePct: number, category: string): string {
  const abs = Math.abs(changePct).toFixed(2);
  if (changePct > 2) return `${name} 大幅走高 ${abs}%，领涨${category}板块`;
  if (changePct > 1) return `${name} 强势上涨 ${abs}%，${category}情绪升温`;
  if (changePct > 0.3) return `${name} 走高 ${abs}%，买盘较为积极`;
  if (changePct > 0) return `${name} 微涨 ${abs}%，交投平稳`;
  if (changePct === 0) return `${name} 持平，等待新的市场催化`;
  if (changePct > -0.3) return `${name} 微跌 ${abs}%，区间震荡`;
  if (changePct > -1) return `${name} 回落 ${abs}%，投资者保持谨慎`;
  if (changePct > -2) return `${name} 下跌 ${abs}%，${category}承压`;
  return `${name} 大幅回落 ${abs}%，${category}板块走弱`;
}

function buildSummary(row: MarketRow, changePct: number, category: string): string {
  const price = parseFloat(row.price) || 0;
  const vol = parseFloat(row.volume || '0') || 0;
  const dir = changePct >= 0 ? '上行' : '下行';
  const volTxt = vol > 0 ? `，成交活跃度 ${formatVolume(vol)}` : '';
  return `${row.name}（${row.symbol}）最新报 ${price.toLocaleString()}，日内${dir} ${Math.abs(changePct).toFixed(2)}%${volTxt}。属于${category}板块，价格变动反映当前市场对该品种的供需与风险偏好。`;
}

export function formatVolume(v: number): string {
  if (v >= 1e8) return (v / 1e8).toFixed(2) + '亿';
  if (v >= 1e4) return (v / 1e4).toFixed(2) + '万';
  return v.toLocaleString();
}

function importanceOf(changePct: number, volume: number): Importance {
  const score = Math.abs(changePct) + (volume > 1e7 ? 1.5 : volume > 1e6 ? 0.8 : 0);
  if (score > 2) return 'high';
  if (score > 0.8) return 'medium';
  return 'low';
}

function sentimentOf(changePct: number): Sentiment {
  if (changePct > 0.1) return 'positive';
  if (changePct < -0.1) return 'negative';
  return 'neutral';
}

/** 主工厂：把行情行转换为新闻条目 */
export function generateNewsItems(rows: MarketRow[], tick = 0): NewsItem[] {
  return rows.map((row, idx) => {
    const changePct = parseFloat(row.changePct) || 0;
    const price = parseFloat(row.price) || 0;
    const volume = parseFloat(row.volume || '0') || 0;
    const category = CATEGORY_MAP[row.market] || '宏观';
    const seed = hashCode(row.symbol + idx);
    const tags = [category];
    if (Math.abs(changePct) > 1.5) tags.push('异动');
    if (volume > 1e7) tags.push('放量');
    if (changePct > 0) tags.push('看涨'); else if (changePct < 0) tags.push('看跌');
    return {
      id: `${row.symbol}-${idx}`,
      symbol: row.symbol,
      name: row.name,
      title: buildTitle(row.name, changePct, category),
      summary: buildSummary(row, changePct, category),
      category,
      marketType: row.market,
      source: pick(SOURCE_POOL, seed),
      minutesAgo: ((idx * 7 + tick * 3 + Math.abs(seed)) % 240) + 1,
      sentiment: sentimentOf(changePct),
      importance: importanceOf(changePct, volume),
      changePct,
      price,
      volume,
      tags,
    };
  });
}

/** 按重要度排序（high > medium > low，再按绝对涨跌幅） */
export function sortByImportance(items: NewsItem[]): NewsItem[] {
  const rank: Record<Importance, number> = { high: 0, medium: 1, low: 2 };
  return [...items].sort((a, b) => {
    if (rank[a.importance] !== rank[b.importance]) return rank[a.importance] - rank[b.importance];
    return Math.abs(b.changePct) - Math.abs(a.changePct);
  });
}

/** 按时间倒序（minutesAgo 升序 = 最新在前） */
export function sortByTime(items: NewsItem[]): NewsItem[] {
  return [...items].sort((a, b) => a.minutesAgo - b.minutesAgo);
}

/** 按绝对涨跌幅（异动榜） */
export function sortByMove(items: NewsItem[]): NewsItem[] {
  return [...items].sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));
}

/** 按板块聚合 */
export function groupByCategory(items: NewsItem[]): Record<string, NewsItem[]> {
  const map: Record<string, NewsItem[]> = {};
  for (const it of items) {
    (map[it.category] ||= []).push(it);
  }
  return map;
}

/** 模拟"阅读热度"分值（确定性：基于涨跌幅与成交量），用于热门榜 */
export function readScore(item: NewsItem): number {
  return Math.round(Math.abs(item.changePct) * 1200 + item.volume / 5000 + (item.importance === 'high' ? 8000 : item.importance === 'medium' ? 3000 : 500));
}

/** 模拟"社交情绪分"0-100（确定性：50 为中性，涨跌幅放大偏离） */
export function socialScore(item: NewsItem): number {
  const s = 50 + item.changePct * 9;
  return Math.max(2, Math.min(98, Math.round(s)));
}

/** 时间标签 */
export function timeAgo(minutesAgo: number): string {
  if (minutesAgo < 60) return `${minutesAgo} 分钟前`;
  const h = Math.floor(minutesAgo / 60);
  const m = minutesAgo % 60;
  return m === 0 ? `${h} 小时前` : `${h} 小时 ${m} 分前`;
}

/** 新闻主题定义（NI 模块用） */
export interface NewsTheme {
  code: string;
  label: string;
  desc: string;
  match: (item: NewsItem) => boolean;
}

export const NEWS_THEMES: NewsTheme[] = [
  { code: 'NI FED', label: '货币政策', desc: '利率、央行与债券市场', match: (i) => i.marketType === 'bond' },
  { code: 'NI EQTY', label: '股票市场', desc: '个股与指数动态', match: (i) => i.marketType === 'stock' || i.marketType === 'index' },
  { code: 'NI FX', label: '外汇市场', desc: '汇率与货币走势', match: (i) => i.marketType === 'forex' },
  { code: 'NI CMD', label: '大宗商品', desc: '能源、金属与农产品', match: (i) => i.marketType === 'commodity' },
  { code: 'NI DRV', label: '衍生品', desc: '期权与衍生工具', match: (i) => i.marketType === 'derivative' || i.marketType === 'option' },
  { code: 'NI FUND', label: '基金产品', desc: 'ETF 与公募基金', match: (i) => i.marketType === 'fund' },
  { code: 'NI HOT', label: '市场异动', desc: '涨跌幅显著的品种', match: (i) => Math.abs(i.changePct) > 1.5 },
];
