import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const map = readFileSync(`${root}/recovery-evidence/econ-29-one-to-one-extension-map-2026-08-26.md`, 'utf8');
const bridge = readFileSync(`${root}/client/src/components/econ/EconOneToOneExtensionBridge.tsx`, 'utf8');
const realData = readFileSync(`${root}/server/routers/econ29Data.ts`, 'utf8');

describe('经济中心 29 项一对一扩展映射审计', () => {
  it('包含连续 1–29 编号，且每项映射均有唯一的输入、输出与禁止复用定义', () => {
    const functionalRows = map.match(/^\| (?:[1-9]|1\d|2\d)\. /gm) ?? [];
    expect(functionalRows).toHaveLength(29);
    expect(map).toContain('真实输入与按钮动作');
    expect(map).toContain('终端内输出 / 可视化');
    expect(map).toContain('明确禁止复用');
  });

  it('逐项补全原状态来源、空状态、失败状态和文字边界字段，并写明 29/29 计数规则', () => {
    const contractRows = map.match(/^\| (?:[1-9]|1\d|2\d) \|/gm) ?? [];
    expect(contractRows).toHaveLength(29);
    expect(map).toContain('真实输入源 / 接口或原状态来源');
    expect(map).toContain('空状态');
    expect(map).toContain('失败状态');
    expect(map).toContain('文字边界（不得出现）');
    expect(map).toContain('编号连续为 1–29，共 29 行');
    expect(map).toContain('data-econ-extension-id');
    expect(bridge).toContain('data-econ-extension-id={spec.id}');
    expect(bridge).toContain('const SPECS: ExtensionSpec[]');
    expect((bridge.match(/id: '\d{2}'/g) ?? [])).toHaveLength(29);
    expect(bridge).toContain("[role=\"tabpanel\"][data-state=\"active\"]");
    expect(bridge).toContain("return (activePanel?.textContent ?? '').replace");
    expect(bridge).not.toContain('activePanel?.textContent ?? preserved?.textContent');
    expect(bridge).toContain('尚未读取当前原视图');
    expect(bridge).toContain('directions: { positive:');
    expect(bridge).toContain('const fragments = text.split');
    expect(bridge).toContain('function SpecOutputVisual');
    expect(bridge).toContain('data-econ-extension-visual={`spec-${spec.id}`}');
    expect(bridge).toContain("case '01':");
    expect(bridge).toContain("case '24':");
    expect(bridge).toContain("case '29':");
    expect(bridge).toContain('return [...new Set(pmiValues)]');
    expect(bridge).toContain('深链参数');
    expect(bridge).toContain('原筛选控件');
    expect(bridge).toContain('第一次原视图文本作为基线');
    expect(bridge).toContain('当前视图文本指纹');
    expect(bridge).toContain('const ACTION_LABELS');
    expect(bridge).toContain("type OperationState = 'idle' | 'loading' | 'success' | 'empty' | 'error'");
    expect(bridge).toContain("operationState === 'loading'");
    expect(bridge).toContain('操作完成：官方结果已在右侧可视化');
  });

  it('29 项均有唯一动作标签，并暴露加载、成功、空和失败反馈状态', () => {
    const labelsBlock = bridge.match(/const ACTION_LABELS: Record<string, string> = \{([\s\S]*?)\n\};/)?.[1] ?? '';
    const outputBlock = bridge.match(/function SpecOutputVisual\([\s\S]*?\n}\n\nexport default function EconOneToOneExtensionBridge/)?.[0] ?? '';
    const ids = [...labelsBlock.matchAll(/'([0-9]{2})':/g)].map((match) => match[1]);
    const labels = [...labelsBlock.matchAll(/'([0-9]{2})': '([^']+)'/g)].map((match) => match[2]);
    const outputIds = [...outputBlock.matchAll(/case '([0-9]{2})':/g)].map((match) => match[1]);
    expect(ids).toHaveLength(29);
    expect(new Set(ids).size).toBe(29);
    expect(new Set(labels).size).toBe(29);
    expect(outputIds).toHaveLength(29);
    expect(new Set(outputIds).size).toBe(29);
    expect(outputIds).toEqual(Array.from({ length: 29 }, (_, index) => String(index + 1).padStart(2, '0')));
    expect(bridge).toContain("setOperationState('loading')");
    expect(bridge).toContain("setOperationState('success')");
    expect(bridge).toContain("setOperationState('empty')");
    expect(bridge).toContain("setOperationState('error')");
    expect(bridge).toContain('setAttemptAt(new Date())');
    expect(bridge).toContain('原状态来源：{spec.sourceName}');
    expect(bridge).toContain('本次操作时刻：{attemptAt ? attemptAt.toLocaleTimeString()');
    expect(bridge).toContain('focus-visible:ring-2 focus-visible:ring-cyan-400');
    expect(bridge).toContain('focus-visible:border-cyan-400');
    expect(bridge).toContain('role="status"');
    expect(bridge).toContain('aria-live="polite"');
    expect(bridge).toContain('function operationDetails');
    expect(bridge).toContain("'01': [{ label: '首个时刻'");
    expect(bridge).toContain("'16': [{ label: '查询文本'");
    expect(bridge).toContain("'28': [{ label: '基线状态'");
    expect(bridge).toContain("'29': [{ label: '文本指纹'");
  });

  it('29 项成功视觉均以真实数据或明确本地行为回执为主，不以 ZIP DOM 统计充当结果', () => {
    const outputBlock = bridge.match(/function SpecOutputVisual\([\s\S]*?\n}\n\nexport default function EconOneToOneExtensionBridge/)?.[0] ?? '';
    const ids = Array.from({ length: 29 }, (_, index) => String(index + 1).padStart(2, '0'));
    for (const id of ids) {
      const next = String(Number(id) + 1).padStart(2, '0');
      const block = id === '29' ? outputBlock.match(/case '29':[\s\S]*?default:/)?.[0] ?? '' : outputBlock.match(new RegExp(`case '${id}':[\\s\\S]*?case '${next}':`))?.[0] ?? '';
      expect(block, `第 ${id} 项缺少真实回执门控`).toMatch(/receipt\??\.(available|facts|evidence)/);
    }
    expect(bridge).toContain('function stableViewFingerprint');
    expect(bridge).not.toContain('真实数据来源：{receipt.source}');
    expect(bridge).toContain('内容定位已留档');
    expect(bridge).toContain('不以 ZIP 原视图、缓存猜测或固定数值替代');
  });

  it('按编号调用真实数据契约，后端保留来源审计但终端仅展示观察期、研究用途和不可用边界', () => {
    expect(bridge).toContain('trpc.econ29Data.getProfile.useMutation');
    expect(bridge).toContain('dataProfileMutation.mutateAsync({');
    expect(bridge).toContain('id: spec.id,');
    expect(bridge).toContain('真实数据读取请求失败：');
    expect(bridge).not.toContain('真实数据来源：{receipt.source}');
    expect(bridge).not.toMatch(/href=\{receipt\.sourceUrl\}|window\.open\(receipt\.sourceUrl/);
    expect(bridge).toContain('内容定位已留档');
    expect(bridge).toContain('观察期：{receipt.observedAt ??');
    expect(bridge).toContain('研究用途：{receipt.researchUse}');
    expect(bridge).toContain('边界：{receipt.boundary}');
    expect(realData).toContain('const ECON29_IDS = ["01"');
    expect((realData.match(/case "\d{2}":/g) ?? [])).toHaveLength(29);
    expect(realData).toContain('getEconomicCalendarOfficialObservations');
    expect(realData).toContain('getMoneyMarketSnapshot');
    expect(realData).toContain('readLatestTreasuryParYield');
    expect(realData).toContain('getOfficialNewsFeed');
    expect(realData).toContain('fetchSovereignMacroData');
    expect(realData).toContain('readLatestUsManufacturingPmi');
    expect(realData).toContain('readLatestBlsMacroReleases');
    expect(realData).toContain('inspectOfficialPolicyDocument');
    expect(realData).toContain('async function fedReleaseChainProfile()');
    expect(realData).toContain('async function fedMaterialsWindowProfile()');
    expect(realData).toContain('async function fedDocumentProfile');
    expect(realData).toContain('async function sourceFreshnessProfile()');
    expect(realData).toContain('BOJ_TANKAN_LARGE_MANUFACTURING');
    expect(realData).toContain('短观 DI');
    expect(realData).toContain('.mutation(({ input }) => readEcon29DataProfile(input.id, input))');
  });

  it('将第 04 项作为美国财政部 TIC 月度流量模块，而不是原 WFII 文本或短端利率代理', () => {
    const ticVisual = bridge.match(/case '04':[\s\S]*?case '05':/)?.[0] ?? '';
    expect(bridge).toContain('TIC 跨境流剖面');
    expect(ticVisual).toContain('TIC / MONTHLY FLOW SPLIT');
    expect(ticVisual).toContain('不使用原视图字符或保留图形代替');
    expect(realData).toContain('async function ticProfile()');
    expect(realData).toContain('netTicInflowBillions');
    expect(realData).toContain('privateInflowBillions');
    expect(realData).toContain('officialInflowBillions');
  });

  it('将第 02、03、05、07、08、11、12、14 项的专属视觉锁定为真实数据回执，而不是原视图统计', () => {
    const visual = (id: string, next: string) => bridge.match(new RegExp(`case '${id}':[\\s\\S]*?case '${next}':`))?.[0] ?? '';
    const module02 = visual('02', '03');
    const module03 = visual('03', '04');
    const module05 = visual('05', '06');
    const module07 = visual('07', '08');
    const module08 = visual('08', '09');
    const module11 = visual('11', '12');
    const module12 = visual('12', '13');
    const module14 = visual('14', '15');
    expect(module02).toContain('BLS / CPI-U OBSERVATION LADDER');
    expect(module03).toContain('EU27 / TRADE BALANCE SPLIT');
    expect(module05).toContain('BLS / PRIVATE WAGE CHECK');
    expect(module07).toContain('FED G.17 / INDPRO ACTUAL');
    expect(module08).toContain('ONS / MONTHLY GDP RELEASE');
    expect(module11).toContain('SOFR / IORB / ON RRP DEFINITIONS');
    expect(module12).toContain('BLS JOLTS / ACTUAL CHANGE');
    expect(module14).toContain('官方观察覆盖');
    for (const block of [module02, module03, module05, module07, module08, module11, module12, module14]) {
      expect(block).toContain('receipt?.available');
    }
    expect(realData).toContain('async function tradeProfile()');
    expect(realData).toContain('async function financialConditionsProfile()');
    expect(realData).toContain('BLS_CES0500000003');
    expect(realData).toContain('BLS_JTS000000000000000JOL');
    expect(realData).toContain('FED_INDPRO');
    expect(realData).toContain('ONS_GDP_MONTHLY_INDEX');
  });

  it('将第 15–17 项锁定为财政部日期链、央行官方目录和实际观察，而不是日期令牌、文本查找或方向符号', () => {
    const visual = (id: string, next: string) => bridge.match(new RegExp(`case '${id}':[\\s\\S]*?case '${next}':`))?.[0] ?? '';
    const module15 = visual('15', '16');
    const module16 = visual('16', '17');
    const module17 = visual('17', '18');
    expect(module15).toContain('TREASURY / BILL ISSUE-TO-MATURITY');
    expect(module16).toContain('OFFICIAL CENTRAL-BANK SOURCE DIRECTORY');
    expect(module17).toContain('CENTRAL-BANK / ACTUAL OBSERVATION LADDER');
    for (const block of [module15, module16, module17]) {
      expect(block).toContain('receipt?.available');
    }
    expect(bridge).toContain("'16': '读取央行官方目录'");
    expect(bridge).not.toContain("spec.id === '16' && !input.trim()");
    expect(realData).toContain('async function auctionProfile()');
    expect(realData).toContain('function policyDirectoryProfile()');
    expect(realData).toContain('async function rateLadderProfile()');
  });

  it('将第 25–29 项锁定为可审计的原行为合同与不同官方观察，不用令牌计数冒充研究结果', () => {
    const visual = (id: string, next: string) => bridge.match(new RegExp(`case '${id}':[\\s\\S]*?case '${next}':`))?.[0] ?? '';
    const module25 = visual('25', '26');
    const module26 = visual('26', '27');
    const module27 = visual('27', '28');
    const module28 = visual('28', '29');
    const module29 = bridge.match(/case '29':[\s\S]*?default:/)?.[0] ?? '';
    expect(bridge).toContain('function stableViewFingerprint');
    expect(module25).toContain('ZIP / DEEP-LINK CONTRACT');
    expect(module26).toContain('EUROSTAT / EA20 RETAIL ACTUAL');
    expect(module27).toContain('BOJ / TANKAN MANUFACTURING DI');
    expect(module28).toContain('ONS / EMPLOYMENT + VIEW BASELINE');
    expect(module29).toContain('ONS / REGULAR PAY + VIEW RECEIPT');
    expect(module29).toContain('FNV-1a /');
    expect(module25).toContain('receipt?.facts.map');
    for (const block of [module26, module27, module28, module29]) {
      expect(block).toContain('receipt?.available');
    }
    expect(realData).toContain('EUROSTAT_RETAIL_EA20');
    expect(realData).toContain('BOJ_TANKAN_LARGE_MANUFACTURING');
    expect(realData).toContain('ONS_EMPLOYMENT_16_PLUS');
    expect(realData).toContain('ONS_AWE_REGULAR_PAY');
    expect(realData).toContain('本地 URL · ZIP 原标签集合');
  });

  it('为第 01、06、10、18、19、21 项锁定不同官方时间、材料、原文和时效工作流', () => {
    const module01 = bridge.match(/case '01':[\s\S]*?case '02':/)?.[0] ?? '';
    const module06 = bridge.match(/case '06':[\s\S]*?case '07':/)?.[0] ?? '';
    const module10 = bridge.match(/case '10':[\s\S]*?case '11':/)?.[0] ?? '';
    const module18 = bridge.match(/case '18':[\s\S]*?case '19':/)?.[0] ?? '';
    const module19 = bridge.match(/case '19':[\s\S]*?case '20':/)?.[0] ?? '';
    const module21 = bridge.match(/case '21':[\s\S]*?case '22':/)?.[0] ?? '';
    expect(bridge).toContain("const [releaseZone, setReleaseZone] = useState<'Asia/Shanghai' | 'UTC' | 'America/New_York'>('Asia/Shanghai')");
    expect(bridge).toContain("...(spec.id === '01' ? { releaseZone } : {})");
    expect(module01).toContain('BLS / RELEASE TIME CONVERSION');
    expect(module06).toContain('FED / OFFICIAL RELEASE CHAIN');
    expect(module10).toContain('FOMC / MATERIAL DATE WINDOW');
    expect(module18).toContain('FOMC / MINUTES EVIDENCE');
    expect(module19).toContain('FOMC / STATEMENT EVIDENCE');
    expect(module21).toContain('OFFICIAL RSS / FRESHNESS LEDGER');
    expect(realData).toContain('case "01": return blsReleaseTimingProfile(options)');
    expect(realData).toContain('case "06": return fedReleaseChainProfile()');
    expect(realData).toContain('case "10": return fedMaterialsWindowProfile()');
    expect(realData).toContain('case "18": return fedDocumentProfile("18", "minutes")');
    expect(realData).toContain('case "19": return fedDocumentProfile("19", "statement")');
    expect(realData).toContain('case "21": return sourceFreshnessProfile()');
    expect(realData).toContain('releaseZone: z.enum(["Asia/Shanghai", "UTC", "America/New_York"])');
  });
});
