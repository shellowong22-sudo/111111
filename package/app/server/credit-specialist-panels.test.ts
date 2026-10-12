import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const specialist = readFileSync(resolve(import.meta.dirname, '../client/src/components/credit/CreditSpecialistPanels.tsx'), 'utf8');
const core = readFileSync(resolve(import.meta.dirname, '../client/src/components/credit/CreditCoreSpecialistPanels.tsx'), 'utf8');
const issuerAnalytics = readFileSync(resolve(import.meta.dirname, '../client/src/components/credit/CreditIssuerAndAnalyticsPanels.tsx'), 'utf8');
const postTrade = readFileSync(resolve(import.meta.dirname, '../client/src/components/credit/CreditPostTradeDeliveryPanels.tsx'), 'utf8');
const terminal = readFileSync(resolve(import.meta.dirname, '../client/src/pages/Terminal.tsx'), 'utf8');

describe('信用债 1–26 原入口内部差异化', () => {
  it('保留二十六个原入口并直接路由到各自原面板，不再叠加共用展示层', () => {
    for (let id = 1; id <= 26; id += 1) {
      expect(terminal).toContain(`'${id}':`);
    }
    expect(terminal).toContain("'1':  { title: '1 证券与功能说明', component: <SECDESCPanel");
    expect(terminal).toContain("'26': { title: '26 BMS保险系统 CRMX', component: <CRMXPanel");
    expect(terminal).not.toContain('<CreditSpecialistPanels moduleId={itemId}');
    expect(terminal).not.toContain('<CreditResearchWorkbench moduleId={itemId}');
  });

  it('为数据字典、市场覆盖、基准拆解、CDS 治理与期限结构提供不可互换的操作', () => {
    expect(specialist).toContain('字段血缘与研究口径管理');
    expect(specialist).toContain('覆盖矩阵');
    expect(specialist).toContain('国债基准与信用收益率拆解');
    expect(specialist).toContain('CDS 数据权限、延迟与实体覆盖治理');
    expect(specialist).toContain('用户输入节点的期限结构研究');
    expect(specialist).toContain('downloadCsv(\'credit-term-structure.csv\'');
  });

  it('为图表编排、指数治理与公开序列发现提供不同的输出物和导出路径', () => {
    expect(specialist).toContain('OAS 序列编排与研究图输出');
    expect(specialist).toContain('指数方法、许可与复现边界治理');
    expect(specialist).toContain('公开时间序列发现与研究清单');
    expect(specialist).toContain('credit-chart-composer-data.csv');
    expect(specialist).toContain('index-governance.csv');
    expect(specialist).toContain('credit-public-series-list.csv');
  });

  it('保留独立的市场监测、SEC 证据、名义利差计算和发行人文件导航', () => {
    expect(core).toContain('信用市场脉冲与风险桶观察');
    expect(core).toContain('SEC 文件筛选、原文证据摘录与审阅');
    expect(core).toContain('名义利差口径、观察日与前次变动复核');
    expect(core).toContain('名义利差复核');
    expect(core).not.toContain('公式链');
    expect(core).toContain('发行人公开文件目录与原文跳转');
    expect(core).toContain('CreditEvidencePanel');
    expect(core).toContain('FRED / ICE BofA 指数级日度 OAS');
  });

  it('继续明确未授权 CDS、单券报价和 TRACE 的真实数据边界', () => {
    expect(specialist).toContain('系统不会在没有可验证授权时显示或推导 CDS 点位');
    expect(specialist).toContain('不创建单券曲线或市场预测');
    expect(core).toContain('不等同于单券报价、实时 TRACE 或 CDS');
    expect(core).toContain('不是 OAS、Z-spread、可成交利差、估值或投资建议');
  });

  it('命名发行人入口只保留 XBRL 财务事实与偿债轨迹，不复刻证券主数据或估值面板', () => {
    expect(issuerAnalytics).toContain('发行人 XBRL 财务趋势与偿债能力核验');
    expect(issuerAnalytics).toContain('SEC XBRL 年度财务事实');
    expect(issuerAnalytics).toContain('债务与流动性轨迹');
    expect(terminal).toContain("'14': { title: '14 证券简介 DES', component: <DESPanel");
    expect(terminal).toContain("'15': { title: '15 收益率与利差分析 YAS', component: <YASPanel");
    expect(terminal).toContain("'16': { title: '16 定价', component: <PRICINGEnhancedPanel");
  });

  it('为 17–24 项保留交易后、事件、证据、工作表与研究交付的专属操作', () => {
    expect(postTrade).toContain('库存、指示价与成交数据可得性台账');
    expect(postTrade).toContain('研究运行队列、版本与人工状态切换');
    expect(postTrade).toContain('FINRA 公开日终交易后市场研究导航');
    expect(postTrade).toContain('发行人公开事件的 SEC 文件核验时间线');
    expect(postTrade).toContain('合约术语、期限与市场数据权限治理');
    expect(postTrade).toContain('风险—证据矩阵、审阅状态与可追溯来源');
    expect(postTrade).toContain('参数、公式因子、来源与计算结果的可复核底稿');
    expect(postTrade).toContain('结构化研究包、来源清单与交付前完整度控制');
  });

  it('以实际用户登记的台账记录驱动库存、运行、衍生品和证据审计可视化', () => {
    expect(postTrade).toContain('超过 30 天未核验');
    expect(postTrade).toContain('逾期未暂停');
    expect(postTrade).toContain('超过 90 天未核验');
    expect(postTrade).toContain('风险分类覆盖');
    expect(postTrade).toContain("row.availability === '已授权'");
    expect(postTrade).toContain("row.status === '进行中'");
    expect(postTrade).toContain("row.permission === '已授权'");
    expect(postTrade).toContain("row.status === '已核验'");
  });

  it('禁止用未授权数据替代交易后、衍生品或信用研究事实', () => {
    expect(postTrade).toContain('不显示库存量、报价或成交价格');
    expect(postTrade).toContain('不请求或展示实时/逐笔 TRACE');
    expect(postTrade).toContain('不在此显示或推断评级变动');
    expect(postTrade).toContain('不会显示未经授权的 CDS 点位或合约估值');
    expect(postTrade).toContain('不产生自动评级、违约概率或投资建议');
    expect(postTrade).toContain('不得将其视为自动生成的金融结论');
  });
});
