import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { mapNyFedPoint, MONEY_MARKET_SOURCES, parseFredMoneyMarketCsv } from './routers/moneyMarketResearch';

const root = resolve(import.meta.dirname, '..');
const terminal = readFileSync(resolve(root, 'client/src/pages/Terminal.tsx'), 'utf8');
const menu = readFileSync(resolve(root, 'client/src/components/MoneyMarketMenu.tsx'), 'utf8');
const specialist = readFileSync(resolve(root, 'client/src/components/mm/MoneyMarketSpecialistPanels.tsx'), 'utf8');
const router = readFileSync(resolve(root, 'server/routers/moneyMarketResearch.ts'), 'utf8');
const matrix = readFileSync(resolve(root, 'money-market-22-differentiation-matrix.md'), 'utf8');
const matrix24 = readFileSync(resolve(root, 'money-market-24-differentiation-matrix.md'), 'utf8');
const distinctiveLayer = readFileSync(resolve(root, 'client/src/components/mm/MoneyMarketDistinctiveLayer.tsx'), 'utf8');

describe('货币市场公开数据服务', () => {
  it('仅保留 FRED 有效观察，缺失值不会被填充为静态或随机数据', () => {
    const result = parseFredMoneyMarketCsv('observation_date,SOFR\n2026-08-13,3.62\n2026-08-14,.\n2026-08-17,3.64\n2099-01-01,9.99\n', { id: 'SOFR', label: 'SOFR', category: '担保隔夜融资', sourceUrl: 'https://fred.stlouisfed.org/series/SOFR' });
    expect(result.history).toEqual([{ date: '2026-08-13', value: 3.62 }, { date: '2026-08-17', value: 3.64 }]);
    expect(result.changeBps).toBe(2);
    expect(result.status).toBe('available');
  });

  it('覆盖 FRED、美国财政部、巴西中央银行、台湾中央银行和 PBOC 的公开来源与边界', () => {
    expect(MONEY_MARKET_SOURCES.map((item) => item.id)).toEqual(expect.arrayContaining(['FRED-SOFR', 'FRED-EFFR', 'NYFED-FUNDING', 'TREASURY-AUCTIONS', 'BCB-CDI', 'CBC-CALL', 'PBOC']));
    expect(router).toContain('auctions_query');
    expect(router).toContain('bcdata.sgs.12');
    expect(router).toContain('不使用缓存样本、随机路径或替代报价填充');
  });

  it('保留纽约联储原始成交量、分位、政策区间和修订字段，不用合成字段替代', () => {
    expect(mapNyFedPoint({ effectiveDate: '2026-09-03', percentRate: 3.66, percentPercentile1: 3.60, percentPercentile25: 3.64, percentPercentile75: 3.70, percentPercentile99: 3.74, volumeInBillions: 2949, revisionIndicator: 'R' }, 'SOFR')).toEqual({ date: '2026-09-03', product: 'SOFR', ratePct: 3.66, volumeBn: 2949, p1Pct: 3.60, p25Pct: 3.64, p75Pct: 3.70, p99Pct: 3.74, targetLowPct: null, targetHighPct: null, revision: 'R' });
    expect(mapNyFedPoint({ effectiveDate: '2026-09-03', percentRate: 3.63, targetRateFrom: 3.5, targetRateTo: 3.75, volumeInBillions: 109 }, 'EFFR')).toMatchObject({ product: 'EFFR', targetLowPct: 3.5, targetHighPct: 3.75, volumeBn: 109 });
    expect(mapNyFedPoint({}, 'OBFR')).toBeNull();
  });
});

describe('货币市场 22 项专业差异化路由', () => {
  const ids = ['des-mm', 'pgm', 'mktbeat', 'btmm', 'boom', 'tcon', 'rv', 'ycqsim', 'gc', 'crvf-mmkt', 'crvf', 'fibc', 'cdie', 'efsf', 'mmidx', 'etrade', 'edsf', 'wbf', 'pboc', 'twdi', 'cenb', 'news-mm'];

  it('保留所有原始菜单编号、名称和顺序，并将 22 项映射到专属工作流', () => {
    ids.forEach((id, index) => {
      expect(menu).toContain(`num: ${index + 1}`);
      expect(terminal).toContain(`moduleId="${id}"`);
      expect(matrix).toContain(`| ${index + 1} |`);
    });
    expect(terminal).toContain('requestedModule === "money-market"');
  });

  it('把研究、日历、控制、计算、资料目录、交易准备和证据交付分为独有工作流', () => {
    ['MarketBeat', 'Boom', 'Tcon', 'RelativeValue', 'CurveScenario', 'Fibc', 'Cdie', 'Etrade', 'Edsf', 'Wbf', 'Pboc', 'Twdi', 'NewsLedger'].forEach((name) => expect(specialist).toContain(`function ${name}`));
    expect(specialist).toContain('本工作台不连接交易场所、不生成价格、不发送订单');
    expect(specialist).toContain('不把统计偏离解释为可成交套利');
    expect(specialist).not.toContain('Math.random');
  });

  it('货币市场菜单的额外入口只展示公开资料时效研究，不显示虚构活跃信号', () => {
    expect(menu).toContain('公开资料时效监控台');
    expect(menu).not.toContain('15 ACTIVE');
    expect(specialist).toContain('本工作台不连接交易场所、不生成价格、不发送订单，也不模拟成交');
  });
});

describe('货币市场完整性与差异化审计补强', () => {
  const audit = readFileSync(resolve(root, 'money-market-functional-audit-2026-08-19.md'), 'utf8');
  const enhancer = readFileSync(resolve(root, 'client/src/components/mm/MoneyMarketDepthEnhancer.tsx'), 'utf8');
  const integratedViews = readFileSync(resolve(root, 'client/src/components/mm/MoneyMarketIntegratedViews.tsx'), 'utf8');
  const moneyMarketPanel = readFileSync(resolve(root, 'client/src/components/mm/MoneyMarketSpecialistPanels.tsx'), 'utf8');
  const moneyMarketRouter = readFileSync(resolve(root, 'server/routers/moneyMarketResearch.ts'), 'utf8');

  it('为全部 22 项提供可追溯的职责、真实输入、输出与数据边界审计矩阵', () => {
    ['| 1 | DES |', '| 6 | TCON |', '| 10 | CRVF MMKT |', '| 15 | MMIDX |', '| 22 | NEWS |'].forEach((marker) => expect(audit).toContain(marker));
    expect(audit).toContain('只增加、不删除');
    expect(audit).toContain('拒绝虚构报价、模拟成交');
  });

  it('将原本较浅或相近的模块替换为彼此不同的单一工作台而不变更菜单路由', () => {
    ['DesIntegrated', 'PgmIntegrated', 'BoomIntegrated', 'TconIntegrated', 'CurveDirectoryIntegrated', 'FibcIntegrated', 'EfsfIntegrated', 'EtradeIntegrated', 'EdsfIntegrated', 'WbfIntegrated', 'PbocIntegrated', 'CenbIntegrated', 'NewsIntegrated'].forEach((marker) => expect(integratedViews).toContain(`export function ${marker}`));
    expect(specialist).toContain('MoneyMarketIntegratedViews');
    expect(specialist).not.toContain('MoneyMarketDepthEnhancer');
    expect(specialist).not.toContain('depthIds');
  });

  it('保留公开数据、用户输入和授权边界，不用随机路径、报价或政策预测补全', () => {
    ['不作为利率参与计算', '不表示均值回归、套利空间或交易建议', '上游公开序列不可读时不补点', '不推断价格、收益率或政策结果', '并非合约条款、交易所价格或 SOFR FRA 报价'].forEach((marker) => expect(enhancer).toContain(marker));
  });

  it('将优先模块扩展为市场比较、拍卖分析、透明压力面、复利、执行控制与统计，而非新增重复台账', () => {
    ['短端基准窗口变化监测', '国库券拍卖期限结构与到期梯度', '短端曲线压力面与节点比较', 'CDI 已实现复利路径与观察窗口', '交易准备的结算与控制情景', '台湾隔夜拆款窗口统计与变动分解'].forEach((marker) => expect(enhancer).toContain(marker));
    ['不构造发售日历', '不含市场概率、校准参数或预测', '不估计利率或期货', '不下单、不校验市场价格、不连接交易场所，也不模拟成交', '统计仅使用台湾中央银行可读的隔夜拆款观察', 'TAIBOR、期限拆款或下一期利率预测'].forEach((marker) => expect(enhancer).toContain(marker));
  });

  it('公开快照加载或失败时仍保留原有面板主体，并将核心观察优先展示在终端内', () => {
    ['{body[moduleId]}', '{sourceStatus}', '{extensions}'].forEach((marker) => expect(moneyMarketPanel).toContain(marker));
    expect(moneyMarketPanel).toContain('原有面板仍可使用');
    expect(moneyMarketPanel).toContain('原有输入、计算、核验和导出面板保持可用');
    expect(moneyMarketPanel).toContain('核心观察、日期、覆盖与可用性直接在终端查看');
    expect(moneyMarketPanel).toContain('原始证据（可选核验）');
    expect(moneyMarketPanel).not.toContain('const primary = snapshotQuery.isLoading');
  });

  it('为 GC、BTMM 与 MKTBEAT 提供真实来源约束下的 PDF、日期区间与交叉窗口分析', () => {
    ['高分辨率 PDF 图表报告已导出', 'scale: 2.5', 'MktbeatCrossWindow', 'BtmmRangeComparison', '多基准交叉窗口统计', '官方拍卖日期区间比较与趋势'].forEach((marker) => expect(moneyMarketPanel).toContain(marker));
    ['getAuctionRange', 'auction_date:gte:', 'auction_date:lte:', '单次比较区间不得超过 730 天', '不推断发行计划'].forEach((marker) => expect(moneyMarketRouter).toContain(marker));
  });

  it('为第 1至8项追加相互独立的研究交付层，并保留公开来源或受控输入边界', () => {
    ['| 1 | DES |', '| 8 | YCQSIM |', '| 23 | SOURCE |', '| 24 | MMFLOW |'].forEach((marker) => expect(matrix24).toContain(marker));
    ['字段口径对照卡', '研究委托范围卡', '观察发布对齐监测', '官方拍卖节奏画像', '未来 45 日官方事件地平线', '走廊分解与容许带', '三对基准差值位置矩阵', '节点冲击交付网格'].forEach((marker) => expect(distinctiveLayer).toContain(marker));
    ['不混合利率口径', '不会替用户创建截止日期或研究结论', '不构造发售节奏', '不代表市场隐含概率或预测'].forEach((marker) => expect(distinctiveLayer).toContain(marker));
    expect(specialist).toContain('MoneyMarketDistinctiveLayer');
  });

  it('为第 9至16项追加与前序模块不同的曲线证据、来源判定、计算口径和流程控制', () => {
    ['| 9 | GC |', '| 16 | ETRADE |'].forEach((marker) => expect(matrix24).toContain(marker));
    ['图表证据清单', '货币市场资料路由器', '跨来源计量兼容性判定', '日计数口径桥接', 'CDI 已实现计息梯度', '原始文件来源资格卡', '基准离散带宽监测', '结算释放控制卡'].forEach((marker) => expect(distinctiveLayer).toContain(marker));
    ['不以示例曲线替代', '不推荐未经授权的报价来源', '不将不同币种、市场或定义转换成统一收益率', '实际证券惯例和条款须以原始文件为准', '不下单、不连接交易场所'].forEach((marker) => expect(distinctiveLayer).toContain(marker));
  });

  it('为第 17至24项提供独立的生命周期、转换、来源资格、时效和交付工作流', () => {
    ['| 17 | EDSF |', '| 22 | NEWS |', '| 23 | SOURCE |', '| 24 | MMFLOW |'].forEach((marker) => expect(matrix24).toContain(marker));
    ['FRA 生命周期与结算区间卡', '转换因子基差桥接', '官方公告域名资格闸门', '公开观察完整性与日变动审计', '央行与公开来源覆盖拓扑', '原始资料引用包', '公开资料时效与可用性运营台', '研究交付来源清单组装'].forEach((marker) => expect(distinctiveLayer).toContain(marker));
    expect(menu).toContain('num: 23');
    expect(menu).toContain("code: 'SOURCE'");
    expect(menu).toContain('num: 24');
    expect(menu).toContain("code: 'MMFLOW'");
    expect(terminal).toContain('moduleId="source-mm"');
    expect(terminal).toContain('moduleId="mmflow"');
    ['CTD、不提供实时期货报价', '不推断下一期拆款或期限利率', '不生成新闻摘要、市场观点或预测', '不会以模拟时效状态填充', '不生成未经核验的分析内容'].forEach((marker) => expect(distinctiveLayer).toContain(marker));
  });
});
