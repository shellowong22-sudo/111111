/**
 * 佑诚新闻引擎：多语种、多市场的实时新闻流。
 *
 *  - 采集：7×24 快讯、财经要闻滚动、各市场 / 行业 / 主题检索、英文市场头条、多语种（日 / 德 / 法 / 繁中）
 *  - 加工：去重聚类（同一事件多家报道合并为一条并计热度）、分类（市场 / 行业 / 主题）、利好利空、关联标的识别、重要性评分
 *  - 读取：任意文章正文提取（阅读器）、上市公司公告（美股 SEC 申报）、宏观数据快照
 *
 * 前端只拿到内容本身，不返回任何来源 / 发布方字段。
 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getTicks } from "./market";
import { archiveNews, loadArticleBody, loadNewsSince, saveArticleBody, searchArchive, startWarehouse } from "./warehouse";

/* ------------------------------------------------------------------ 类型 */
export type NewsItem = {
  id: string;
  title: string;
  summary: string | null;
  url: string | null;
  time: number;
  lang: "zh" | "en" | "ja" | "de" | "fr" | "zh-TW" | "ko";
  region: string;
  cats: string[];
  tone: 1 | 0 | -1;
  toneScore: number;
  tickers: string[];
  cluster: string;
  heat: number;
  score: number;
  kind: "flash" | "article";
  feed: string;
};
export type PublicNews = Omit<NewsItem, "feed">;

type Feed = {
  id: string;
  url: string;
  lang: NewsItem["lang"];
  region: string;
  cats: string[];
  kind: "rss" | "sina-live" | "wallstcn-live" | "wallstcn-articles";
  every: number; // 秒
  flash?: boolean;
};

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const gn = (q: string, lang: "zh" | "en" | "ja" | "de" | "fr" | "zh-TW" | "ko" = "zh") => {
  const p = { zh: ["zh-CN", "CN", "CN:zh-Hans"], en: ["en-US", "US", "US:en"], ja: ["ja", "JP", "JP:ja"], de: ["de", "DE", "DE:de"], fr: ["fr", "FR", "FR:fr"], "zh-TW": ["zh-TW", "TW", "TW:zh-Hant"], ko: ["ko", "KR", "KR:ko"] }[lang];
  return `https://news.google.com/rss/search?q=${encodeURIComponent(`${q} when:2d`)}&hl=${p[0]}&gl=${p[1]}&ceid=${p[2]}`;
};

const bing = (q: string, zh: boolean) => `https://www.bing.com/news/search?q=${encodeURIComponent(q)}&format=rss${zh ? "&cc=cn" : ""}`;

const FEEDS: Feed[] = [
  // 7×24 快讯
  { id: "live-wscn", url: "https://api-one.wallstcn.com/apiv1/content/lives?channel=global-channel&limit=60", lang: "zh", region: "全球", cats: [], kind: "wallstcn-live", every: 45, flash: true },
  { id: "wscn-articles", url: "https://api-one.wallstcn.com/apiv1/content/information-flow?channel=global-channel&accept=article&limit=40", lang: "zh", region: "全球", cats: [], kind: "wallstcn-articles", every: 180 },
  { id: "wscn-cn", url: "https://api-one.wallstcn.com/apiv1/content/information-flow?channel=a-stock-channel&accept=article&limit=30", lang: "zh", region: "中国", cats: ["A股"], kind: "wallstcn-articles", every: 300 },
  { id: "wscn-us", url: "https://api-one.wallstcn.com/apiv1/content/information-flow?channel=us-stock-channel&accept=article&limit=30", lang: "zh", region: "美国", cats: ["美股"], kind: "wallstcn-articles", every: 300 },
  { id: "wscn-forex", url: "https://api-one.wallstcn.com/apiv1/content/information-flow?channel=forex-channel&accept=article&limit=30", lang: "zh", region: "全球", cats: ["外汇"], kind: "wallstcn-articles", every: 600 },
  { id: "wscn-commodity", url: "https://api-one.wallstcn.com/apiv1/content/information-flow?channel=commodity-channel&accept=article&limit=30", lang: "zh", region: "全球", cats: ["商品"], kind: "wallstcn-articles", every: 600 },
  // 中文要闻滚动
  { id: "sina-roll", url: "https://rss.sina.com.cn/roll/finance/hot_roll.xml", lang: "zh", region: "中国", cats: [], kind: "rss", every: 180 },
  { id: "ftcn", url: "https://www.ftchinese.com/rss/news", lang: "zh", region: "全球", cats: [], kind: "rss", every: 600 },
  { id: "ftcn-feature", url: "https://www.ftchinese.com/rss/feed", lang: "zh", region: "全球", cats: ["观点"], kind: "rss", every: 900 },
  { id: "36kr", url: "https://36kr.com/feed", lang: "zh", region: "中国", cats: ["科技"], kind: "rss", every: 900 },
  // 英文市场头条
  { id: "cnbc-top", url: "https://www.cnbc.com/id/100003114/device/rss/rss.html", lang: "en", region: "美国", cats: [], kind: "rss", every: 300 },
  { id: "cnbc-finance", url: "https://www.cnbc.com/id/10000664/device/rss/rss.html", lang: "en", region: "美国", cats: ["金融"], kind: "rss", every: 600 },
  { id: "cnbc-econ", url: "https://www.cnbc.com/id/20910258/device/rss/rss.html", lang: "en", region: "美国", cats: ["宏观"], kind: "rss", every: 900 },
  { id: "mw-top", url: "https://feeds.content.dowjones.io/public/rss/mw_topstories", lang: "en", region: "美国", cats: [], kind: "rss", every: 300 },
  { id: "mw-pulse", url: "https://feeds.content.dowjones.io/public/rss/mw_marketpulse", lang: "en", region: "美国", cats: ["美股"], kind: "rss", every: 180, flash: true },
  { id: "inv-news", url: "https://www.investing.com/rss/news.rss", lang: "en", region: "全球", cats: [], kind: "rss", every: 600 },
  { id: "yf-spx", url: "https://feeds.finance.yahoo.com/rss/2.0/headline?s=^GSPC,^IXIC,^DJI&region=US&lang=en-US", lang: "en", region: "美国", cats: ["美股"], kind: "rss", every: 300 },
  // 分主题检索（中文）
  ...([
    ["A股 行情", "中国", ["A股"]], ["港股 恒指", "中国香港", ["港股"]], ["美股 纳斯达克 标普", "美国", ["美股"]], ["欧洲股市", "欧洲", ["欧洲"]], ["日本 股市 日经", "日本", ["日本"]],
    ["美联储 利率", "美国", ["央行"]], ["中国人民银行 货币政策", "中国", ["央行"]], ["欧洲央行 日本央行", "全球", ["央行"]],
    ["宏观经济 GDP CPI", "全球", ["宏观"]], ["人民币 汇率 美元指数", "全球", ["外汇"]], ["国债 收益率 债市", "全球", ["债券"]],
    ["原油 OPEC", "全球", ["能源", "商品"]], ["黄金 白银 价格", "全球", ["商品"]], ["铜 铁矿石 大宗商品", "全球", ["商品"]],
    ["半导体 芯片 人工智能", "全球", ["科技"]], ["新能源 光伏 锂电", "中国", ["能源"]], ["银行 保险 券商", "中国", ["金融"]],
    ["房地产 楼市", "中国", ["地产"]], ["消费 白酒 零售", "中国", ["消费"]], ["医药 生物科技", "全球", ["医药"]], ["汽车 电动车", "全球", ["汽车"]],
    ["比特币 加密货币", "全球", ["加密"]], ["IPO 上市 招股", "全球", ["IPO"]], ["财报 业绩 季报", "全球", ["公司"]], ["并购 收购", "全球", ["公司"]],
    ["关税 贸易 地缘", "全球", ["地缘", "政策"]], ["证监会 监管 政策", "中国", ["政策"]], ["新兴市场 印度 东南亚", "新兴市场", ["新兴市场"]],
    ["分析师 观点 评论 市场展望", "全球", ["观点"]],
  ] as Array<[string, string, string[]]>).flatMap(([q, region, cats], i): Feed[] => [
    { id: `gn-zh-${i}`, url: gn(q, "zh"), lang: "zh", region, cats, kind: "rss", every: 900 },
    { id: `bing-zh-${i}`, url: bing(q, true), lang: "zh", region, cats, kind: "rss", every: 900 },
  ]),
  // 英文主题
  ...([
    ["stock market today", "美国", ["美股"]], ["federal reserve rates", "美国", ["央行"]], ["treasury yields bonds", "美国", ["债券"]], ["oil prices", "全球", ["能源", "商品"]],
    ["earnings report", "美国", ["公司"]], ["china economy", "中国", ["宏观"]], ["emerging markets", "新兴市场", ["新兴市场"]], ["semiconductor stocks", "全球", ["科技"]],
    ["dollar currency markets", "全球", ["外汇"]], ["bank stocks", "全球", ["金融"]],
  ] as Array<[string, string, string[]]>).flatMap(([q, region, cats], i): Feed[] => [
    { id: `gn-en-${i}`, url: gn(q, "en"), lang: "en", region, cats, kind: "rss", every: 900 },
    { id: `bing-en-${i}`, url: bing(q, false), lang: "en", region, cats, kind: "rss", every: 900 },
  ]),
  // 多语种
  { id: "gn-ja", url: gn("株式市場 日経平均", "ja"), lang: "ja", region: "日本", cats: ["日本"], kind: "rss", every: 1200 },
  { id: "gn-ja-boj", url: gn("日銀 金利", "ja"), lang: "ja", region: "日本", cats: ["央行"], kind: "rss", every: 1800 },
  { id: "gn-de", url: gn("Börse DAX Aktien", "de"), lang: "de", region: "欧洲", cats: ["欧洲"], kind: "rss", every: 1800 },
  { id: "gn-fr", url: gn("Bourse CAC 40", "fr"), lang: "fr", region: "欧洲", cats: ["欧洲"], kind: "rss", every: 1800 },
  { id: "gn-tw", url: gn("台股 加權指數", "zh-TW"), lang: "zh-TW", region: "中国台湾", cats: ["新兴市场"], kind: "rss", every: 1200 },
  { id: "gn-ko", url: gn("코스피 증시", "ko"), lang: "ko", region: "韩国", cats: ["新兴市场"], kind: "rss", every: 1800 },
];

/* ------------------------------------------------------------------ 分类 / 情绪 / 标的 */
const CAT_RULES: Array<[string, RegExp]> = [
  ["央行", /央行|美联储|联储|鲍威尔|加息|降息|利率决议|议息|LPR|MLF|逆回购|欧洲央行|拉加德|日本央行|日银|植田|英国央行|Fed\b|FOMC|Powell|rate (cut|hike)|central bank|ECB|BOJ|BoE|日銀|EZB|Zinsen/i],
  ["宏观", /GDP|CPI|PPI|PMI|通胀|通缩|就业|非农|失业率|零售销售|社融|M2|经济数据|景气|inflation|payrolls|jobless|unemployment|retail sales|economy|economic|recession|消費者物価|Inflation|Konjunktur/i],
  ["A股", /A股|沪指|上证|深成指|创业板|科创板|沪深|北交所|两市|主力资金|涨停|龙虎榜|Shanghai Composite|CSI 300/i],
  ["港股", /港股|恒指|恒生|港交所|南向|Hang Seng|HKEX/i],
  ["美股", /美股|纳指|纳斯达克|标普|道指|华尔街|S&P 500|Nasdaq|Dow Jones|Wall Street|stocks? (rise|fall|rally|slide)|futures/i],
  ["欧洲", /欧股|欧洲股市|德国DAX|英国富时|法国CAC|Stoxx|FTSE|DAX|CAC 40|Europe(an)? stocks|欧元区/i],
  ["日本", /日股|日经|东证|日元|Nikkei|Topix|日経|東証|円安|円高/i],
  ["外汇", /汇率|人民币|美元指数|欧元|日元|英镑|离岸|外汇|dollar|yuan|euro|yen|forex|currency|DXY/i],
  ["债券", /国债|债市|收益率|美债|信用债|城投|利差|bond|yield|treasur|gilt|Bund/i],
  ["能源", /原油|石油|OPEC|天然气|布伦特|WTI|煤炭|电力|光伏|风电|储能|oil|crude|Brent|natural gas|LNG|energy/i],
  ["商品", /黄金|白银|铜|铝|铁矿|大宗商品|期货|螺纹|大豆|玉米|小麦|gold|silver|copper|commodit|iron ore|wheat|soybean/i],
  ["科技", /科技|芯片|半导体|人工智能|AI|大模型|算力|英伟达|苹果|微软|谷歌|特斯拉|华为|台积电|tech|chip|semiconductor|Nvidia|Apple|Microsoft|Google|Alphabet|Meta|OpenAI|TSMC/i],
  ["金融", /银行|保险|券商|证券公司|基金公司|理财|bank|insurer|brokerage|JPMorgan|Goldman|Morgan Stanley|HSBC/i],
  ["地产", /房地产|楼市|房企|房价|土地|万科|碧桂园|恒大|保利|property|real estate|housing|mortgage/i],
  ["消费", /消费|零售|白酒|茅台|餐饮|旅游|免税|电商|consumer|retail|Walmart|Amazon|Costco/i],
  ["医药", /医药|医疗|生物科技|创新药|疫苗|器械|pharma|biotech|drug|FDA|healthcare/i],
  ["汽车", /汽车|电动车|新能源车|比亚迪|蔚来|理想|小鹏|车企|auto|EV\b|electric vehicle|Tesla|Ford|GM\b|Toyota/i],
  ["加密", /比特币|以太坊|加密货币|数字货币|稳定币|bitcoin|ethereum|crypto|stablecoin|BTC|ETH/i],
  ["IPO", /IPO|上市首日|招股|新股|港股上市|递表|listing debut|goes public/i],
  ["公司", /财报|业绩|营收|净利润|季报|年报|回购|分红|并购|收购|重组|earnings|revenue|profit|quarter|buyback|dividend|acquisition|merger|deal/i],
  ["政策", /政策|国务院|发改委|证监会|财政部|监管|关税|制裁|立法|policy|regulat|tariff|sanction|SEC\b|legislation|stimulus/i],
  ["地缘", /地缘|冲突|战争|中东|俄乌|以色列|伊朗|台海|朝鲜|war|conflict|geopolit|Ukraine|Israel|Iran|missile/i],
  ["观点", /评论|观点|专栏|分析|展望|解读|策略|研报|opinion|column|analysis|outlook|commentary|strategist|view:/i],
  ["新兴市场", /新兴市场|印度|越南|印尼|巴西|墨西哥|土耳其|南非|东南亚|emerging market|India|Brazil|Indonesia|Vietnam|Mexico|Turkey/i],
];

const POS = ["上涨", "大涨", "涨停", "飙升", "走高", "收涨", "增长", "回升", "超预期", "创新高", "新高", "利好", "回购", "增持", "上调", "盈利", "扭亏", "突破", "获批", "中标", "分红", "提振", "强劲", "看涨", "反弹", "降息", "宽松", "刺激", "放宽",
  "surge", "soar", "jump", "rally", "rallies", "beat", "beats", "record high", "upgrade", "raises", "buyback", "gain", "gains", "bullish", "outperform", "approval", "strong", "rebound", "climb", "boost", "higher", "rate cut", "上昇", "最高値", "steigt"];
const NEG = ["下跌", "大跌", "跌停", "暴跌", "重挫", "走低", "收跌", "下滑", "回落", "不及预期", "亏损", "利空", "减持", "下调", "调查", "处罚", "诉讼", "裁员", "风险", "违约", "警告", "停产", "召回", "看跌", "降级", "加息", "收紧", "制裁", "冲突", "衰退", "暴雷",
  "plunge", "fall", "falls", "drop", "drops", "slump", "slide", "miss", "misses", "downgrade", "cut to", "lawsuit", "probe", "loss", "bearish", "warning", "recall", "layoff", "decline", "weak", "tumble", "sell-off", "selloff", "lower", "recession", "default", "rate hike", "下落", "急落", "fällt"];

function toneOf(text: string): { tone: 1 | 0 | -1; score: number } {
  const t = text.toLowerCase();
  const p = POS.filter((w) => t.includes(w.toLowerCase())).length;
  const n = NEG.filter((w) => t.includes(w.toLowerCase())).length;
  const score = p + n ? (p - n) / (p + n) : 0;
  return { tone: score > 0.2 ? 1 : score < -0.2 ? -1 : 0, score };
}

/** 名称 → 行情代码（用于新闻关联标的；前端点击后直接打开 K 线） */
const TICKER_DICT: Array<[RegExp, string]> = [
  [/苹果公司|苹果(?!手机)|\bApple\b|\bAAPL\b/i, "AAPL"], [/微软|Microsoft|\bMSFT\b/i, "MSFT"], [/英伟达|Nvidia|\bNVDA\b/i, "NVDA"], [/亚马逊|Amazon|\bAMZN\b/i, "AMZN"],
  [/谷歌|Alphabet|Google|\bGOOGL?\b/i, "GOOGL"], [/Meta Platforms|脸书|\bMeta\b/, "META"], [/特斯拉|Tesla|\bTSLA\b/i, "TSLA"], [/博通|Broadcom|\bAVGO\b/i, "AVGO"],
  [/台积电|TSMC|\bTSM\b/i, "TSM"], [/摩根大通|JPMorgan|\bJPM\b/i, "JPM"], [/高盛|Goldman Sachs/i, "GS"], [/伯克希尔|Berkshire/i, "BRK.B"], [/奈飞|Netflix/i, "NFLX"],
  [/AMD|超威/i, "AMD"], [/英特尔|Intel\b/i, "INTC"], [/甲骨文|Oracle/i, "ORCL"], [/礼来|Eli Lilly/i, "LLY"], [/诺和诺德|Novo Nordisk/i, "NVO"], [/阿斯麦|ASML/i, "ASML.AS"],
  [/沃尔玛|Walmart/i, "WMT"], [/波音|Boeing/i, "BA"], [/埃克森|Exxon/i, "XOM"], [/雪佛龙|Chevron/i, "CVX"], [/可口可乐|Coca-Cola/i, "KO"], [/迪士尼|Disney/i, "DIS"],
  [/Palantir/i, "PLTR"], [/OpenAI/i, "MSFT"], [/阿里巴巴|阿里|Alibaba/i, "9988.HK"], [/腾讯|Tencent/i, "0700.HK"], [/美团|Meituan/i, "3690.HK"], [/京东|JD\.com/i, "9618.HK"],
  [/拼多多|PDD/i, "PDD"], [/小米|Xiaomi/i, "1810.HK"], [/比亚迪|BYD/i, "002594.SZ"], [/宁德时代|CATL/i, "300750.SZ"], [/贵州茅台|茅台/i, "600519.SH"], [/五粮液/i, "000858.SZ"],
  [/中国平安/i, "601318.SH"], [/招商银行/i, "600036.SH"], [/工商银行/i, "601398.SH"], [/建设银行/i, "601939.SH"], [/中国石油/i, "601857.SH"], [/中国移动/i, "0941.HK"],
  [/中芯国际|SMIC/i, "688981.SH"], [/紫金矿业/i, "601899.SH"], [/长江电力/i, "600900.SH"], [/隆基/i, "601012.SH"], [/中信证券/i, "600030.SH"], [/汇丰|HSBC/i, "0005.HK"],
  [/友邦|AIA\b/i, "1299.HK"], [/港交所|HKEX/i, "0388.HK"], [/网易|NetEase/i, "9999.HK"], [/百度|Baidu/i, "9888.HK"], [/蔚来|NIO\b/i, "NIO"], [/理想汽车|Li Auto/i, "LI"], [/小鹏|XPeng/i, "XPEV"],
  [/丰田|Toyota/i, "7203.T"], [/索尼|Sony/i, "6758.T"], [/软银|SoftBank/i, "9984.T"], [/三星电子|三星|Samsung/i, "005930.KS"], [/SK海力士|SK Hynix/i, "000660.KS"],
  [/思爱普|SAP\b/i, "SAP.DE"], [/西门子|Siemens/i, "SIE.DE"], [/路威酩轩|LVMH/i, "MC.PA"], [/壳牌|Shell\b/i, "SHEL.L"], [/阿斯利康|AstraZeneca/i, "AZN.L"], [/雀巢|Nestl/i, "NESN.SW"],
  [/黄金|gold price|金价/i, "GC"], [/原油|油价|oil price|crude/i, "CL"], [/布伦特|Brent/i, "BRENT"], [/白银|silver/i, "SI"], [/铜价|copper/i, "HG"], [/天然气|natural gas/i, "NG"],
  [/比特币|Bitcoin|\bBTC\b/i, "BTC"], [/以太坊|Ethereum/i, "ETH"], [/美元指数|dollar index|DXY/i, "DXY"], [/人民币|yuan|CNH/i, "USDCNH"], [/日元|\byen\b/i, "USDJPY"], [/欧元|\beuro\b/i, "EURUSD"],
  [/标普500|标普|S&P 500/i, "^GSPC"], [/纳斯达克|纳指|Nasdaq/i, "^IXIC"], [/道琼斯|道指|Dow Jones/i, "^DJI"], [/恒生指数|恒指|Hang Seng/i, "^HSI"], [/上证指数|沪指|Shanghai Composite/i, "000001.SH"],
  [/沪深300|CSI 300/i, "000300.SH"], [/创业板指/i, "399006.SZ"], [/日经|Nikkei|日経平均/i, "^N225"], [/德国DAX|\bDAX\b/i, "^GDAXI"], [/富时100|FTSE 100/i, "^FTSE"], [/美债|Treasury|国债期货/i, "ZN"], [/VIX|恐慌指数/i, "^VIX"],
];
function detectTickers(text: string): string[] {
  const out = new Set<string>();
  for (const [re, sym] of TICKER_DICT) if (re.test(text)) out.add(sym);
  for (const m of text.matchAll(/\((?:NASDAQ|NYSE|NYSEARCA|AMEX)\s*:\s*([A-Z.]{1,6})\)/g)) out.add(m[1]);
  for (const m of text.matchAll(/[（(](\d{6})[)）]/g)) out.add(`${m[1]}.${/^[569]/.test(m[1]) ? "SH" : "SZ"}`);
  for (const m of text.matchAll(/[（(](0?\d{4})\.HK[)）]/gi)) out.add(`${m[1].padStart(4, "0").slice(-4)}.HK`);
  return [...out].slice(0, 6);
}

const IMPORTANT = /突发|快讯|重磅|紧急|breaking|just in|urgent|央行|美联储|降息|加息|非农|CPI|GDP|关税|制裁|战争|暴跌|大涨|熔断|停牌|违约|破产|史上|首次|record/i;

/* ------------------------------------------------------------------ 解析 */
const decode = (s: string) => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
  .replace(/\s+/g, " ").trim();

type Raw = { title: string; summary: string | null; url: string | null; time: number };

function parseRss(xml: string, google: boolean): Raw[] {
  const out: Raw[] = [];
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/g) ?? xml.match(/<entry[\s>][\s\S]*?<\/entry>/g) ?? [];
  for (const body of blocks) {
    const pick = (tag: string) => {
      const r = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`).exec(body);
      return r ? decode(r[1]) : "";
    };
    let title = pick("title");
    if (google) title = title.replace(/\s+-\s+[^-]{1,50}$/, "");
    let url = pick("link") || (/<link[^>]*href="([^"]+)"/.exec(body)?.[1] ?? "");
    if (!/^https?:/.test(url)) url = pick("guid");
    if (/bing\.com\/news\/apiclick/i.test(url)) {
      const real = /[?&]url=([^&]+)/.exec(url)?.[1];
      if (real) url = decodeURIComponent(real);
    }
    const desc = google ? "" : pick("description") || pick("summary") || pick("content");
    const time = Date.parse(pick("pubDate") || pick("published") || pick("updated") || pick("dc:date")) || Date.now();
    if (title && title.length > 4) out.push({ title: title.slice(0, 300), summary: desc && desc !== title ? desc.slice(0, 600) : null, url: /^https?:/.test(url) ? url : null, time });
  }
  return out;
}

function parseSinaLive(json: any): Raw[] {
  const list: any[] = json?.result?.data?.feed?.list ?? [];
  return list.map((x) => {
    const text = decode(String(x.rich_text ?? x.text ?? ""));
    const m = /^【([^】]{4,80})】\s*(.*)$/.exec(text);
    const time = Date.parse(String(x.create_time ?? "").replace(" ", "T") + "+08:00") || Date.now();
    return { title: (m ? m[1] : text.slice(0, 80)).trim(), summary: (m ? m[2] : text).slice(0, 600) || null, url: x.docurl || null, time };
  }).filter((x) => x.title.length > 4);
}

function parseWscnArticles(json: any): Raw[] {
  const list: any[] = json?.data?.items ?? [];
  return list.map((x) => x?.resource ?? x).filter((r) => r && r.title).map((r) => ({
    title: decode(String(r.title)),
    summary: r.content_short ? decode(String(r.content_short)).slice(0, 600) : null,
    url: r.uri || (r.id ? `https://wallstreetcn.com/articles/${r.id}` : null),
    time: (Number(r.display_time) || Date.now() / 1000) * 1000,
  }));
}

function parseWscnLive(json: any): Raw[] {
  const list: any[] = json?.data?.items ?? [];
  return list.map((x) => {
    const text = decode(String(x.content_text ?? x.content ?? ""));
    const m = /^【([^】]{4,80})】\s*(.*)$/.exec(text);
    const title = String(x.title || (m ? m[1] : text.slice(0, 80))).trim();
    return { title, summary: (m ? m[2] : text).slice(0, 600) || null, url: x.uri || null, time: (Number(x.display_time) || Date.now() / 1000) * 1000 };
  }).filter((x) => x.title.length > 4);
}

/* ------------------------------------------------------------------ 存储 / 聚类 */
const store = new Map<string, NewsItem>();
const clusters = new Map<string, { ids: Set<string>; tokens: Set<string>; first: number }>();
const feedHealth = new Map<string, { ok: number; fail: number; lastOk: number; lastError: string | null; next: number; count: number }>();
const FILE = path.join(process.cwd(), ".runtime", "uc", "news.json");
const KEEP_MS = 4 * 86400e3;

function tokens(title: string): Set<string> {
  const t = title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ");
  const out = new Set<string>();
  for (const w of t.split(" ")) {
    if (!w) continue;
    if (/[一-鿿぀-ヿ가-힯]/.test(w)) for (let i = 0; i < w.length - 1; i++) out.add(w.slice(i, i + 2));
    else if (w.length > 2) out.add(w);
  }
  return out;
}
function similarity(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / Math.min(a.size, b.size);
}

function scoreOf(item: NewsItem) {
  const ageH = (Date.now() - item.time) / 3600e3;
  return Math.round((Math.log2(1 + item.heat) * 18 + (IMPORTANT.test(item.title) ? 18 : 0) + item.cats.length * 2 + item.tickers.length * 3 + Math.abs(item.toneScore) * 6 + (item.kind === "flash" ? 4 : 0) - ageH * 4) * 10) / 10;
}

function ingest(feed: Feed, raws: Raw[]) {
  let added = 0;
  const cutoff = Date.now() - KEEP_MS;
  for (const r of raws) {
    if (r.time < cutoff || r.time > Date.now() + 3600e3) continue;
    const id = createHash("sha1").update(r.title.toLowerCase().replace(/\s+/g, "")).digest("hex").slice(0, 16);
    if (store.has(id)) {
      const old = store.get(id)!;
      if (!old.summary && r.summary) old.summary = r.summary;
      continue;
    }
    const text = `${r.title} ${r.summary ?? ""}`;
    const cats = new Set(feed.cats);
    for (const [c, re] of CAT_RULES) if (re.test(text)) cats.add(c);
    const { tone, score } = toneOf(text);
    // 聚类：与最近 18 小时内标题相似的归为同一事件
    const tk = tokens(r.title);
    let clusterId = id;
    for (const [cid, c] of clusters) {
      if (Math.abs(c.first - r.time) > 18 * 3600e3) continue;
      if (similarity(tk, c.tokens) >= 0.6) {
        clusterId = cid;
        break;
      }
    }
    const c = clusters.get(clusterId) ?? { ids: new Set<string>(), tokens: tk, first: r.time };
    c.ids.add(id);
    clusters.set(clusterId, c);
    const item: NewsItem = {
      id, title: r.title, summary: r.summary, url: r.url, time: r.time, lang: feed.lang, region: feed.region, cats: [...cats].slice(0, 6), tone, toneScore: score,
      tickers: detectTickers(text), cluster: clusterId, heat: c.ids.size, score: 0, kind: feed.flash ? "flash" : "article", feed: feed.id,
    };
    store.set(id, item);
    archiveNews([item]);
    for (const otherId of c.ids) {
      const o = store.get(otherId);
      if (o) o.heat = c.ids.size;
    }
    added++;
  }
  return added;
}

function prune() {
  const cutoff = Date.now() - KEEP_MS;
  for (const [id, n] of store) if (n.time < cutoff) store.delete(id);
  for (const [cid, c] of clusters) {
    for (const id of c.ids) if (!store.has(id)) c.ids.delete(id);
    if (!c.ids.size) clusters.delete(cid);
  }
  if (store.size > 9000) {
    const sorted = [...store.values()].sort((a, b) => a.time - b.time);
    for (const n of sorted.slice(0, store.size - 9000)) store.delete(n.id);
  }
}

async function fetchText(url: string, timeout = 15000) {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/rss+xml, application/xml, application/json, text/xml, */*" }, signal: AbortSignal.timeout(timeout) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function pollFeed(feed: Feed) {
  const h = feedHealth.get(feed.id) ?? { ok: 0, fail: 0, lastOk: 0, lastError: null, next: 0, count: 0 };
  feedHealth.set(feed.id, h);
  try {
    const text = await fetchText(feed.url);
    const raws = feed.kind === "sina-live" ? parseSinaLive(JSON.parse(text)) : feed.kind === "wallstcn-live" ? parseWscnLive(JSON.parse(text)) : feed.kind === "wallstcn-articles" ? parseWscnArticles(JSON.parse(text)) : parseRss(text, feed.url.includes("news.google.com"));
    const added = ingest(feed, raws);
    h.ok++;
    h.fail = 0;
    h.lastOk = Date.now();
    h.lastError = null;
    h.count = raws.length;
    h.next = Date.now() + feed.every * 1000;
    return added;
  } catch (error) {
    h.fail++;
    h.lastError = error instanceof Error ? error.message : String(error);
    // 失败退避：最多 30 分钟后再试
    h.next = Date.now() + Math.min(1800, feed.every * 2 ** Math.min(4, h.fail)) * 1000;
    return 0;
  }
}

let started = false;
let lastSave = 0;
export function startNewsEngine() {
  if (started) return;
  started = true;
  void (async () => {
    startWarehouse();
    try {
      const fromDb = await loadNewsSince(Date.now() - KEEP_MS);
      for (const r of fromDb) {
        if (store.has(r.id)) continue;
        const n: NewsItem = { ...r, lang: r.lang as NewsItem["lang"], tone: (r.tone > 0 ? 1 : r.tone < 0 ? -1 : 0) as NewsItem["tone"], kind: r.kind as NewsItem["kind"], heat: 1, score: 0 };
        store.set(n.id, n);
        const c = clusters.get(n.cluster) ?? { ids: new Set<string>(), tokens: tokens(n.title), first: n.time };
        c.ids.add(n.id);
        clusters.set(n.cluster, c);
      }
      for (const c of clusters.values()) for (const id of c.ids) { const x = store.get(id); if (x) x.heat = c.ids.size; }
    } catch {
      /* 数据库不可用时用本地缓存 */
    }
    try {
      if (!store.size && existsSync(FILE)) {
        const saved = JSON.parse(await readFile(FILE, "utf8")) as NewsItem[];
        for (const n of saved) {
          store.set(n.id, n);
          const c = clusters.get(n.cluster) ?? { ids: new Set<string>(), tokens: tokens(n.title), first: n.time };
          c.ids.add(n.id);
          clusters.set(n.cluster, c);
        }
      }
    } catch {
      /* 旧缓存损坏就重新采集 */
    }
    const tick = async () => {
      const due = FEEDS.filter((f) => (feedHealth.get(f.id)?.next ?? 0) <= Date.now());
      for (let i = 0; i < due.length; i += 6) await Promise.all(due.slice(i, i + 6).map(pollFeed));
      prune();
      if (Date.now() - lastSave > 5 * 60e3) {
        lastSave = Date.now();
        try {
          await mkdir(path.dirname(FILE), { recursive: true });
          await writeFile(FILE, JSON.stringify([...store.values()].filter((n) => n.time > Date.now() - 2 * 86400e3)));
        } catch {
          /* 下次再存 */
        }
      }
    };
    await tick();
    setInterval(() => void tick().catch(() => undefined), 15_000).unref?.();
  })();
}

/* ------------------------------------------------------------------ 查询 */
const pub = (n: NewsItem): PublicNews => {
  const { feed: _feed, ...rest } = n;
  return { ...rest, score: scoreOf(n) };
};

export type FeedQuery = { cats?: string[]; region?: string; lang?: string; q?: string; symbol?: string; kind?: "flash" | "article"; tone?: number; sort?: "time" | "score" | "heat"; limit?: number; before?: number; since?: number; hours?: number; dedupe?: boolean };

export function queryNews(q: FeedQuery): PublicNews[] {
  startNewsEngine();
  const words = (q.q ?? "").trim().toLowerCase().split(/\s+/).filter(Boolean);
  const since = q.since ?? (q.hours ? Date.now() - q.hours * 3600e3 : 0);
  let list = [...store.values()].filter((n) =>
    (!q.cats?.length || q.cats.some((c) => n.cats.includes(c)))
    && (!q.region || n.region === q.region)
    && (!q.lang || n.lang === q.lang)
    && (!q.kind || n.kind === q.kind)
    && (q.tone === undefined || n.tone === q.tone)
    && (!q.symbol || n.tickers.includes(q.symbol))
    && (!q.before || n.time < q.before)
    && (!since || n.time >= since)
    && (!words.length || words.every((w) => `${n.title} ${n.summary ?? ""}`.toLowerCase().includes(w))));
  // 只给前端能在站内读到正文的新闻：聚合跳转链接且同一事件没有可直读的报道、也没有摘要的，不展示
  const directCluster = new Set<string>();
  for (const n of list) if (n.url && !n.url.includes("news.google.com")) directCluster.add(n.cluster);
  list = list.filter((n) => n.kind === "flash" || directCluster.has(n.cluster) || (n.summary && n.summary.length > 40) || [...(clusters.get(n.cluster)?.ids ?? [])].some((id) => { const x = store.get(id); return !!x?.url && !x.url.includes("news.google.com"); }));
  if (q.dedupe !== false) {
    const best = new Map<string, NewsItem>();
    for (const n of list) {
      const b = best.get(n.cluster);
      const direct = (x: NewsItem) => !!x.url && !x.url.includes("news.google.com");
      if (!b || (direct(n) && !direct(b)) || (direct(n) === direct(b) && ((n.summary && !b.summary) || (n.lang === "zh" && b.lang !== "zh")))) best.set(n.cluster, n);
    }
    list = [...best.values()];
  }
  const sort = q.sort ?? "time";
  list.sort((a, b) => sort === "time" ? b.time - a.time : sort === "heat" ? b.heat - a.heat || b.time - a.time : scoreOf(b) - scoreOf(a));
  return list.slice(0, Math.min(400, q.limit ?? 80)).map(pub);
}

/** 内存里没有的（更早的、或冷门标的 / 关键词）到永久库里补齐 */
export async function queryNewsDeep(q: FeedQuery): Promise<PublicNews[]> {
  const live = queryNews(q);
  const limit = Math.min(400, q.limit ?? 80);
  const wantsHistory = (q.before && q.before < Date.now() - KEEP_MS) || ((q.q || q.symbol) && live.length < limit);
  if (!wantsHistory) return live;
  const seen = new Set(live.map((n) => n.cluster));
  const old = await searchArchive({ q: q.q, symbol: q.symbol, cat: q.cats?.[0], before: q.before ?? Date.now() - KEEP_MS + 1, limit: limit - live.length });
  const extra = old.filter((r) => !seen.has(r.cluster)).map((r) => ({ ...r, lang: r.lang as NewsItem["lang"], tone: (r.tone > 0 ? 1 : r.tone < 0 ? -1 : 0) as NewsItem["tone"], kind: r.kind as NewsItem["kind"], heat: 1, score: 0 })) as NewsItem[];
  return [...live, ...extra.map(pub)].slice(0, limit);
}

export function newsStats() {
  startNewsEngine();
  const now = Date.now();
  const items = [...store.values()];
  const byCat: Record<string, number> = {};
  const byRegion: Record<string, number> = {};
  for (const n of items) {
    if (n.time < now - 86400e3) continue;
    for (const c of n.cats) byCat[c] = (byCat[c] ?? 0) + 1;
    byRegion[n.region] = (byRegion[n.region] ?? 0) + 1;
  }
  const feeds = [...feedHealth.values()];
  return {
    total: items.length,
    last24h: items.filter((n) => n.time > now - 86400e3).length,
    lastHour: items.filter((n) => n.time > now - 3600e3).length,
    newest: items.reduce((m, n) => Math.max(m, n.time), 0),
    channelsOk: feeds.filter((f) => f.lastOk > now - 3600e3).length,
    channels: FEEDS.length,
    byCat,
    byRegion,
  };
}

const STOP = new Set(["the", "and", "for", "with", "from", "that", "this", "after", "over", "into", "amid", "will", "says", "said", "about", "more", "than", "what", "how", "why", "are", "its", "has", "have", "new", "stock", "stocks", "market", "markets", "news", "today",
  "中国", "市场", "公司", "表示", "今年", "没有", "可能", "我们", "他们", "已经", "以及", "进行", "目前", "发布", "最新", "消息", "报道", "记者", "相关", "今日", "昨日", "一个", "这一", "继续", "情况", "问题"]);

/** 热词趋势：近 N 小时标题词频，按小时分桶 */
export function newsTrends(hours = 24) {
  startNewsEngine();
  const since = Date.now() - hours * 3600e3;
  const items = [...store.values()].filter((n) => n.time >= since);
  const count = new Map<string, { n: number; tone: number; hours: number[] }>();
  const bucket = (t: number) => Math.min(hours - 1, Math.floor((t - since) / 3600e3));
  for (const n of items) {
    const words = new Set<string>();
    for (const m of n.title.matchAll(/[一-鿿]{2,6}|[A-Za-z][A-Za-z0-9&.\-]{2,}/g)) {
      const w = m[0].length > 4 && /[一-鿿]/.test(m[0]) ? m[0].slice(0, 4) : m[0];
      if (!STOP.has(w.toLowerCase())) words.add(/^[a-z]/i.test(w) ? w.replace(/^./, (c) => c.toUpperCase()) : w);
    }
    for (const t of n.tickers) words.add(`$${t}`);
    for (const w of words) {
      const e = count.get(w) ?? { n: 0, tone: 0, hours: Array(hours).fill(0) };
      e.n++;
      e.tone += n.toneScore;
      e.hours[bucket(n.time)]++;
      count.set(w, e);
    }
  }
  const terms = [...count.entries()].filter(([, v]) => v.n >= 2).sort((a, b) => b[1].n - a[1].n).slice(0, 60).map(([term, v]) => {
    const recent = v.hours.slice(-Math.max(1, Math.floor(hours / 4))).reduce((a, b) => a + b, 0);
    const early = v.hours.slice(0, Math.max(1, Math.floor(hours / 4))).reduce((a, b) => a + b, 0);
    return { term, count: v.n, tone: v.tone / v.n, momentum: recent - early, hours: v.hours };
  });
  const volume = Array.from({ length: hours }, (_, i) => ({ t: since + i * 3600e3, n: 0, pos: 0, neg: 0 }));
  for (const n of items) {
    const b = volume[bucket(n.time)];
    b.n++;
    if (n.tone > 0) b.pos++;
    if (n.tone < 0) b.neg++;
  }
  return { terms, volume };
}

/** 情绪雷达：按分类 / 地区的利好利空分布与小时序列 */
export function newsSentiment(hours = 24) {
  startNewsEngine();
  const since = Date.now() - hours * 3600e3;
  const items = [...store.values()].filter((n) => n.time >= since);
  const group = (key: (n: NewsItem) => string[]) => {
    const m = new Map<string, { n: number; pos: number; neg: number; sum: number }>();
    for (const n of items) for (const k of key(n)) {
      const e = m.get(k) ?? { n: 0, pos: 0, neg: 0, sum: 0 };
      e.n++;
      e.sum += n.toneScore;
      if (n.tone > 0) e.pos++;
      if (n.tone < 0) e.neg++;
      m.set(k, e);
    }
    return [...m.entries()].map(([k, v]) => ({ key: k, count: v.n, pos: v.pos, neg: v.neg, index: Math.round(((v.pos - v.neg) / Math.max(1, v.n)) * 100) })).sort((a, b) => b.count - a.count);
  };
  const series = Array.from({ length: hours }, (_, i) => ({ t: since + i * 3600e3, pos: 0, neg: 0, n: 0 }));
  for (const n of items) {
    const b = series[Math.min(hours - 1, Math.floor((n.time - since) / 3600e3))];
    b.n++;
    if (n.tone > 0) b.pos++;
    if (n.tone < 0) b.neg++;
  }
  const tickers = group((n) => n.tickers).slice(0, 30);
  return { byCat: group((n) => n.cats), byRegion: group((n) => [n.region]), tickers, series, total: items.length };
}

/* ------------------------------------------------------------------ 阅读器 */
const articleCache = new Map<string, { at: number; value: { title: string | null; text: string; url: string } }>();

/** Google 新闻的跳转链接解码成原文地址 */
async function resolveGoogleNews(url: string): Promise<string> {
  const id = /\/articles\/([^?/]+)/.exec(url)?.[1];
  if (!id) return url;
  const page = await fetch(`https://news.google.com/articles/${id}?hl=en-US&gl=US&ceid=US:en`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15000) }).then((r) => r.text());
  const sg = /data-n-a-sg="([^"]+)"/.exec(page)?.[1];
  const ts = /data-n-a-ts="([^"]+)"/.exec(page)?.[1];
  if (!sg || !ts) return url;
  const inner = `["garturlreq",[["X","X",["X","X"],null,null,1,1,"US:en",null,1,null,null,null,null,null,0,1],"X","X",1,[1,1,1],1,1,null,0,0,null,0],"${id}",${ts},"${sg}"]`;
  const body = `f.req=${encodeURIComponent(JSON.stringify([[["Fbv4je", inner, null, "generic"]]]))}`;
  const res = await fetch("https://news.google.com/_/DotsSplashUi/data/batchexecute", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8", "User-Agent": UA }, body, signal: AbortSignal.timeout(15000) });
  const text = await res.text();
  const m = /garturlres\\",\\"(https?:[^\\"]+)/.exec(text) ?? /"garturlres","(https?:[^"]+)"/.exec(text);
  return m ? m[1].replace(/\\u003d/g, "=").replace(/\\u0026/g, "&") : url;
}

async function fetchHtml(url: string): Promise<{ html: string; url: string }> {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml", "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8" }, signal: AbortSignal.timeout(20000), redirect: "follow" });
  if (!res.ok) throw new Error(`原文站点返回 ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const head = buf.subarray(0, 4096).toString("latin1");
  const charset = (/charset=([\w-]+)/i.exec(res.headers.get("content-type") ?? "")?.[1] ?? /<meta[^>]+charset=["']?([\w-]+)/i.exec(head)?.[1] ?? "utf-8").toLowerCase();
  let html: string;
  try {
    html = new TextDecoder(/gb2312|gbk|gb18030/.test(charset) ? "gbk" : charset).decode(buf);
  } catch {
    html = buf.toString("utf8");
  }
  return { html, url: res.url || url };
}

/** 正文提取：去掉导航 / 脚本 / 广告，取正文段落 */
function extractArticle(html: string): { title: string | null; text: string; description: string | null } {
  const meta = (name: string) => new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']+)["']`, "i").exec(html)?.[1] ?? new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${name}["']`, "i").exec(html)?.[1] ?? null;
  const title = meta("og:title") ?? (/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? null);
  let body = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<(nav|header|footer|aside|form|figure|figcaption|button|svg)[\s\S]*?<\/\1>/gi, " ");
  body = body.replace(/<(ul|ol)[\s\S]*?<\/\1>/gi, " ");
  // 常见正文容器：从容器开始截取，避开页面前面的推荐列表
  const box = /class="[^"]*(caas-body|atoms-wrapper|article-body|articleBody|ArticleBody|article-content|article__content|post-content|entry-content|story-body|story-content|main-content|content-article|detail-content|art_content|article_content|news_txt|newsContent)[^"]*"/i.exec(body);
  if (box?.index) body = body.slice(box.index, box.index + 120000);
  const art = /<article[\s\S]*?<\/article>/i.exec(body)?.[0];
  if (art && art.length > 1500) body = art;
  // 找正文：相邻段落（HTML 距离近）连成一段，取文字最多的一段，避开侧栏和推荐列表
  type P = { start: number; end: number; text: string; head: boolean };
  const found: P[] = [];
  for (const m of body.matchAll(/<(p|h2|h3)[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const t = decode(m[2]);
    const head = /^h[23]$/i.test(m[1]);
    if (t.length < (head ? 4 : 12)) continue;
    if (/^(Copyright|©|版权|责任编辑|免责声明|Sign up|Subscribe|Advertisement|相关阅读|推荐阅读|点击|扫码|关注我们|Read more|Click here|Skip Navigation|Related|Recommended|Trending|热门)/i.test(t)) continue;
    found.push({ start: m.index ?? 0, end: (m.index ?? 0) + m[0].length, text: head ? `## ${t}` : t, head });
  }
  const runs: P[][] = [];
  for (const p of found) {
    const last = runs[runs.length - 1];
    if (last && p.start - last[last.length - 1].end < 2500) last.push(p);
    else runs.push([p]);
  }
  const weight = (r: P[]) => r.filter((x) => !x.head).reduce((n, x) => n + (x.text.length > 40 ? x.text.length : x.text.length / 3), 0);
  const bestRun = runs.sort((x, y) => weight(y) - weight(x))[0] ?? [];
  const seen = new Set<string>();
  const clean = bestRun.map((x) => x.text).filter((p) => (seen.has(p) ? false : (seen.add(p), true)));
  return { title: title ? decode(title) : null, text: clean.join("\n\n"), description: meta("og:description") ?? meta("description") };
}

export async function readArticle(url: string) {
  const hit = articleCache.get(url);
  if (hit && Date.now() - hit.at < 3600e3) return hit.value;
  if (!/^https?:\/\//.test(url)) throw new Error("无效的文章地址");
  let target = url;
  let value: { title: string | null; text: string; url: string } | null = null;
  // 上市公司公告：直接取公告正文
  if (/np-cnotice-stock\.eastmoney\.com\/api\/content\/ann/.test(url)) {
    try {
      const j = JSON.parse(await fetchText(url, 15000));
      const d = j?.data ?? {};
      const text = String(d.notice_content ?? "").replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
      if (text.length > 20) value = { title: d.notice_title ?? null, text: text.slice(0, 30000), url };
    } catch {
      /* 走通用提取 */
    }
  }
  const wscn = /wallstreetcn\.com\/articles\/(\d+)/.exec(url);
  if (wscn) {
    try {
      const j = JSON.parse(await fetchText(`https://api-one.wallstcn.com/apiv1/content/articles/${wscn[1]}?extract=0`, 15000));
      const html = String(j?.data?.content ?? "");
      const a = extractArticle(`<article>${html}</article>`);
      if (a.text.length > 60) value = { title: j?.data?.title ?? null, text: a.text.slice(0, 30000), url };
    } catch {
      /* 走通用提取 */
    }
  }
  // 聚合跳转链接的原文地址解析容易被限流，只在明确需要时调用
  if (!value && /news\.google\.com\/(rss\/)?articles\//.test(url) && process.env.UC_RESOLVE_GNEWS === "1") target = await resolveGoogleNews(url).catch(() => url);
  if (!value && target.includes("news.google.com")) throw new Error("聚合链接无法直接提取正文");
  if (!value) try {
    const { html, url: finalUrl } = await fetchHtml(target);
    const a = extractArticle(html);
    const text = a.text.length >= 120 ? a.text : a.description ?? "";
    if (text.length >= 40) value = { title: a.title, text: text.slice(0, 30000), url: finalUrl };
  } catch {
    /* 换正文服务再试 */
  }
  if (!value) {
    const res = await fetch(`https://r.jina.ai/${target}`, { headers: { "X-Return-Format": "markdown" }, signal: AbortSignal.timeout(35_000) });
    if (!res.ok) throw new Error(`正文读取失败（${res.status}）`);
    const raw = await res.text();
    let text = raw.includes("Markdown Content:") ? raw.slice(raw.indexOf("Markdown Content:") + 17) : raw;
    text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/\[([^\]]+)\]\((?:https?:)?[^)]*\)/g, "$1");
    const paras = text.split(/\n\n+/).filter((p) => p.replace(/[#*\s]/g, "").length > 18);
    value = { title: /^Title:\s*(.+)$/m.exec(raw)?.[1]?.trim() ?? null, text: paras.join("\n\n").slice(0, 30000), url: target };
    if (value.text.length < 80) throw new Error("没有提取到正文");
  }
  articleCache.set(url, { at: Date.now(), value });
  if (articleCache.size > 300) articleCache.delete(articleCache.keys().next().value!);
  return value;
}

/** 阅读一条新闻：优先读本条原文；读不到就读同一事件的其他报道；再不行把各家报道的摘要汇总成正文 */
export async function readNewsItem(id: string | null, url: string | null) {
  const item = id ? store.get(id) : undefined;
  if (id) {
    const saved = await loadArticleBody(id);
    if (saved && saved.length > 60) return { title: item?.title ?? null, text: saved, url: url ?? item?.url ?? "", related: [] as Array<{ id: string; title: string; time: number }> };
  }
  const result = await readNewsItemLive(id, url, item);
  if (id && result.text.length > 60) void saveArticleBody(id, result.text);
  return result;
}

async function readNewsItemLive(id: string | null, url: string | null, item: NewsItem | undefined) {
  const siblings = item ? [...(clusters.get(item.cluster)?.ids ?? [])].map((x) => store.get(x)).filter((x): x is NewsItem => !!x) : [];
  const candidates = [item, ...siblings].filter((x): x is NewsItem => !!x && !!x.url);
  candidates.sort((a, b) => Number((a.url ?? "").includes("news.google.com")) - Number((b.url ?? "").includes("news.google.com")));
  const tried = new Set<string>();
  for (const c of [...candidates.map((x) => x.url!), ...(url ? [url] : [])]) {
    if (tried.has(c) || tried.size >= 4) continue;
    tried.add(c);
    try {
      const a = await readArticle(c);
      return { ...a, related: siblings.filter((x) => x.id !== id).slice(0, 8).map((x) => ({ id: x.id, title: x.title, time: x.time })) };
    } catch {
      /* 下一篇 */
    }
  }
  const parts = [item, ...siblings].filter((x): x is NewsItem => !!x).map((x) => x.summary || "").filter((t) => t && t.length > 20);
  const uniq = [...new Set(parts)];
  if (uniq.length) return { title: item?.title ?? null, text: uniq.join("\n\n"), url: url ?? "", related: siblings.filter((x) => x.id !== id).slice(0, 8).map((x) => ({ id: x.id, title: x.title, time: x.time })) };
  // 最后：按标题检索同一事件的其他直连报道
  if (item) {
    const tk = tokens(item.title);
    const alt = [...store.values()].filter((x) => x.id !== item.id && x.url && !x.url.includes("news.google.com") && Math.abs(x.time - item.time) < 2 * 86400e3 && similarity(tk, tokens(x.title)) >= 0.35).slice(0, 3);
    for (const x of alt) {
      try {
        const a = await readArticle(x.url!);
        return { ...a, related: alt.map((y) => ({ id: y.id, title: y.title, time: y.time })) };
      } catch {
        /* 继续 */
      }
    }
  }
  throw new Error("暂时没有可读取的正文");
}

/* ------------------------------------------------------------------ 公告（美股 SEC 申报） */
let cikMap: { at: number; map: Map<string, { cik: string; title: string }> } | null = null;
const FORM_LABEL: Record<string, string> = {
  "10-K": "年度报告", "10-Q": "季度报告", "8-K": "重大事项", "6-K": "外国发行人报告", "20-F": "外国发行人年报", "S-1": "首次公开发行注册", "DEF 14A": "股东大会委托书",
  "4": "内部人交易", "3": "内部人首次持股", "SC 13G": "大股东持股", "SC 13D": "大股东持股（主动）", "13F-HR": "机构持仓", "424B2": "募资说明书", "144": "限售股出售通知",
};
export async function secFilings(symbol: string) {
  const ticker = symbol.toUpperCase().replace(/\.(O|N|A|OQ|US)$/, "").replace(".", "-");
  if (!cikMap || Date.now() - cikMap.at > 86400e3) {
    const res = await fetch("https://www.sec.gov/files/company_tickers.json", { headers: { "User-Agent": "Ucheer Terminal research@ucheer.local" }, signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`公司目录读取失败（${res.status}）`);
    const json = (await res.json()) as Record<string, { cik_str: number; ticker: string; title: string }>;
    cikMap = { at: Date.now(), map: new Map(Object.values(json).map((v) => [v.ticker.toUpperCase(), { cik: String(v.cik_str).padStart(10, "0"), title: v.title }])) };
  }
  const hit = cikMap.map.get(ticker);
  if (!hit) return { company: null, filings: [] };
  const res = await fetch(`https://data.sec.gov/submissions/CIK${hit.cik}.json`, { headers: { "User-Agent": "Ucheer Terminal research@ucheer.local" }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`公告读取失败（${res.status}）`);
  const j = (await res.json()) as any;
  const r = j?.filings?.recent ?? {};
  const n = Math.min(80, (r.form ?? []).length);
  const filings = Array.from({ length: n }, (_, i) => {
    const acc = String(r.accessionNumber[i]).replace(/-/g, "");
    return {
      form: String(r.form[i]),
      label: FORM_LABEL[String(r.form[i])] ?? "其他申报",
      date: String(r.filingDate[i]),
      reportDate: r.reportDate?.[i] || null,
      description: r.primaryDocDescription?.[i] || null,
      url: `https://www.sec.gov/Archives/edgar/data/${Number(hit.cik)}/${acc}/${r.primaryDocument[i]}`,
    };
  });
  return { company: { name: j.name ?? hit.title, ticker, industry: j.sicDescription ?? null, exchange: (j.exchanges ?? [])[0] ?? null, fiscalYearEnd: j.fiscalYearEnd ?? null, state: j.stateOfIncorporation ?? null }, filings };
}

/* ------------------------------------------------------------------ 宏观快照 */
let macroCache: { at: number; value: unknown } | null = null;
export async function macroSnapshot() {
  if (macroCache && Date.now() - macroCache.at < 15 * 60e3) return macroCache.value;
  const out: { curve: Array<{ tenor: string; value: number }>; curveDate: string | null; curvePrev: Array<{ tenor: string; value: number }>; rates: Array<{ key: string; label: string; value: number | null; date: string | null; unit: string }>; markets: Array<{ symbol: string; label: string; price: number | null; changePct: number | null }> } = { curve: [], curveDate: null, curvePrev: [], rates: [], markets: [] };
  const year = new Date().getUTCFullYear();
  await Promise.all([
    (async () => {
      const text = await fetchText(`https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/${year}/all?type=daily_treasury_yield_curve&field_tdr_date_value=${year}`, 20000);
      const lines = text.trim().split(/\r?\n/);
      const head = lines[0].split(",").map((h) => h.replace(/"/g, ""));
      const row = (i: number) => lines[i]?.split(",") ?? [];
      const toCurve = (r: string[]) => head.slice(1).map((h, i) => ({ tenor: h.replace(/ Mo(nth)?$/, "M").replace(/ Yr$/, "Y").replace("1.5 Month", "6W"), value: Number(r[i + 1]) })).filter((x) => Number.isFinite(x.value) && x.value > 0);
      out.curve = toCurve(row(1));
      out.curveDate = row(1)[0] ?? null;
      out.curvePrev = toCurve(row(Math.min(lines.length - 1, 21)));
    })().catch(() => undefined),
    (async () => {
      const j = JSON.parse(await fetchText("https://markets.newyorkfed.org/api/rates/all/latest.json", 15000));
      for (const r of j?.refRates ?? []) {
        if (!["SOFR", "EFFR", "OBFR", "TGCR", "BGCR"].includes(r.type)) continue;
        out.rates.push({ key: r.type, label: { SOFR: "担保隔夜融资利率 SOFR", EFFR: "有效联邦基金利率", OBFR: "隔夜银行融资利率", TGCR: "三方回购利率", BGCR: "广义回购利率" }[r.type as string] ?? r.type, value: Number(r.percentRate), date: r.effectiveDate, unit: "%" });
      }
    })().catch(() => undefined),
    (async () => {
      const j = JSON.parse(await fetchText("https://api.bls.gov/publicAPI/v2/timeseries/data/CUUR0000SA0", 15000));
      const d = j?.Results?.series?.[0]?.data ?? [];
      if (d.length >= 13) {
        const yoy = ((Number(d[0].value) / Number(d[12].value)) - 1) * 100;
        out.rates.push({ key: "CPI", label: "美国 CPI 同比", value: Math.round(yoy * 100) / 100, date: `${d[0].year}-${String(d[0].period).replace("M", "")}`, unit: "%" });
      }
    })().catch(() => undefined),
  ]);
  const markets: Array<[string, string]> = [["DXY", "美元指数"], ["ZN", "美10年期国债期货"], ["^VIX", "VIX 波动率"], ["GC", "黄金"], ["CL", "WTI 原油"], ["USDCNH", "美元/离岸人民币"], ["EURUSD", "欧元/美元"], ["USDJPY", "美元/日元"]];
  const ticks = await getTicks(markets.map(([s]) => s), { budgetMs: 6000 }).catch(() => ({} as Record<string, any>));
  out.markets = markets.map(([s, label]) => ({ symbol: s, label, price: ticks[s]?.price ?? null, changePct: ticks[s]?.changePct ?? null }));
  macroCache = { at: Date.now(), value: out };
  return out;
}

export function feedHealthReport() {
  return FEEDS.map((f) => ({ id: f.id, ...(feedHealth.get(f.id) ?? { ok: 0, fail: 0, lastOk: 0, lastError: null, next: 0, count: 0 }) }));
}

/* ------------------------------------------------------------------ 经济日历（实时：今天 / 明天 / 本周，公布后自动出实际值） */
export type EconEvent = { id: string; date: string; time: number | null; country: string; region: string; name: string; nameZh: string; actual: string | null; consensus: string | null; previous: string | null; importance: 1 | 2 | 3; surprise: number | null; released: boolean };

const COUNTRY_ZH: Record<string, string> = {
  "United States": "美国", China: "中国", "Euro Zone": "欧元区", "Euro Area": "欧元区", Japan: "日本", "United Kingdom": "英国", Germany: "德国", France: "法国", Italy: "意大利", Spain: "西班牙",
  Canada: "加拿大", Australia: "澳大利亚", "New Zealand": "新西兰", Switzerland: "瑞士", "Hong Kong": "中国香港", India: "印度", Brazil: "巴西", Mexico: "墨西哥", "South Korea": "韩国", Korea: "韩国",
  Singapore: "新加坡", "South Africa": "南非", Russia: "俄罗斯", Turkey: "土耳其", Sweden: "瑞典", Norway: "挪威", Taiwan: "中国台湾", Indonesia: "印度尼西亚",
};
const EVENT_ZH: Array<[RegExp, string]> = [
  [/Nonfarm Payrolls/i, "非农就业人数"], [/Unemployment Rate/i, "失业率"], [/Initial Jobless Claims/i, "首次申请失业救济人数"], [/Continuing Jobless Claims/i, "续请失业救济人数"], [/Average Hourly Earnings/i, "平均时薪"],
  [/Core CPI/i, "核心CPI"], [/\bCPI\b/i, "CPI"], [/Core PPI/i, "核心PPI"], [/\bPPI\b/i, "PPI"], [/Core PCE/i, "核心PCE物价指数"], [/\bPCE\b/i, "PCE物价指数"], [/GDP/i, "GDP"],
  [/Retail Sales/i, "零售销售"], [/Industrial Production/i, "工业产出"], [/Manufacturing PMI/i, "制造业PMI"], [/Services PMI/i, "服务业PMI"], [/Composite PMI/i, "综合PMI"], [/ISM Manufacturing/i, "ISM制造业指数"], [/ISM Non-Manufacturing|ISM Services/i, "ISM非制造业指数"],
  [/Fed Interest Rate Decision|Interest Rate Decision/i, "利率决议"], [/FOMC/i, "美联储议息"], [/Fed Chair|Powell/i, "美联储主席讲话"], [/Speaks/i, "官员讲话"], [/Crude Oil Inventories/i, "EIA原油库存"], [/Natural Gas Storage/i, "天然气库存"],
  [/Trade Balance/i, "贸易帐"], [/Consumer Confidence/i, "消费者信心指数"], [/Michigan Consumer Sentiment/i, "密歇根大学消费者信心"], [/Building Permits/i, "营建许可"], [/Housing Starts/i, "新屋开工"], [/New Home Sales/i, "新屋销售"],
  [/Existing Home Sales/i, "成屋销售"], [/Pending Home Sales/i, "成屋签约销售"], [/Durable Goods Orders/i, "耐用品订单"], [/Factory Orders/i, "工厂订单"], [/JOLTS/i, "JOLTS职位空缺"], [/ADP/i, "ADP就业人数"],
  [/Bond Auction|Note Auction|Bill Auction/i, "国债拍卖"], [/Money Supply|M2/i, "货币供应"], [/Loan Prime Rate/i, "贷款市场报价利率"], [/Business Confidence/i, "商业信心"], [/Inflation Rate/i, "通胀率"], [/Current Account/i, "经常帐"],
];
const HIGH = /Nonfarm|Unemployment Rate|CPI|PCE|GDP|Interest Rate Decision|FOMC|Fed Chair|Retail Sales|ISM|PMI|Loan Prime Rate|Payrolls/i;
const MID = /PPI|Jobless|Confidence|Sentiment|Industrial Production|Durable|Housing|Home Sales|Trade Balance|Crude Oil|JOLTS|ADP|Speaks|Inflation/i;
const zhName = (name: string) => {
  const hit = EVENT_ZH.find(([re]) => re.test(name));
  if (!hit) return name;
  const period = /\((\w{3}(?:\/\w+)?|Q\d|YoY|MoM)\)/i.exec(name)?.[1];
  const tag = /YoY/i.test(name) ? "同比" : /MoM/i.test(name) ? "环比" : /QoQ/i.test(name) ? "季环比" : "";
  return `${hit[1]}${tag ? `（${tag}）` : ""}${period && !/YoY|MoM|QoQ/i.test(period) ? ` ${period}` : ""}`;
};
const numOf = (s: string | null) => {
  if (!s) return null;
  const m = /-?\d+(?:\.\d+)?/.exec(s.replace(/,/g, ""));
  return m ? Number(m[0]) : null;
};

const econCache = new Map<string, { at: number; rows: EconEvent[] }>();
async function econDay(date: string): Promise<EconEvent[]> {
  const hit = econCache.get(date);
  const today = new Date().toISOString().slice(0, 10);
  const ttl = date === today ? 60_000 : date < today ? 3600e3 : 10 * 60e3;
  if (hit && Date.now() - hit.at < ttl) return hit.rows;
  const res = await fetch(`https://api.nasdaq.com/api/calendar/economicevents?date=${date}`, { headers: { Accept: "application/json, text/plain, */*" }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = (await res.json()) as { data?: { rows?: Array<Record<string, string>> } };
  const clean = (v: unknown) => {
    const s = String(v ?? "").replace(/&nbsp;/g, " ").trim();
    return s && s !== "-" && s !== "--" ? s : null;
  };
  const rows: EconEvent[] = (j.data?.rows ?? []).map((r, i) => {
    const name = clean(r.eventName) ?? "";
    const country = clean(r.country) ?? "";
    const gmt = clean(r.gmt);
    const time = gmt && /^\d{1,2}:\d{2}$/.test(gmt) ? Date.parse(`${date}T${gmt.padStart(5, "0")}:00Z`) : null;
    const actual = clean(r.actual);
    const consensus = clean(r.consensus);
    const previous = clean(r.previous);
    const a = numOf(actual);
    const c = numOf(consensus) ?? numOf(previous);
    return {
      id: `${date}-${i}-${name}`.slice(0, 120), date, time, country, region: COUNTRY_ZH[country] ?? country, name, nameZh: zhName(name), actual, consensus, previous,
      importance: HIGH.test(name) ? 3 : MID.test(name) ? 2 : 1, surprise: a != null && c != null ? Math.round((a - c) * 1000) / 1000 : null,
      released: !!actual || (time != null && time < Date.now() - 5 * 60e3 && !consensus && !previous),
    };
  }).filter((e) => e.name);
  econCache.set(date, { at: Date.now(), rows });
  return rows;
}

export async function economicCalendar(from: string, days: number) {
  const dates = Array.from({ length: Math.max(1, Math.min(10, days)) }, (_, i) => new Date(Date.parse(`${from}T00:00:00Z`) + i * 86400e3).toISOString().slice(0, 10));
  const lists = await Promise.all(dates.map((d) => econDay(d).catch(() => econCache.get(d)?.rows ?? [])));
  return lists.flat().sort((a, b) => (a.time ?? Date.parse(`${a.date}T23:59:00Z`)) - (b.time ?? Date.parse(`${b.date}T23:59:00Z`)));
}
