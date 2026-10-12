import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const extension = readFileSync(resolve(root, 'client/src/components/index/IndexDistinctExtension.tsx'), 'utf8');
const wrapper = readFileSync(resolve(root, 'client/src/components/index/IndexPreservedModule.tsx'), 'utf8');
const spec = readFileSync(resolve(root, 'audit/design/index-one-to-one-extension-spec.md'), 'utf8');
const mapping = readFileSync(resolve(root, 'audit/runtime/index-24-tab-mapping.tsv'), 'utf8');
const tabs = ['INDEX_HOME', 'SECF', 'HELP_INDX', 'WEI', 'WEIF', 'WBIX', 'GMM', 'IN', 'INP', 'CIX', 'CIXB', 'AGG', 'FDFD', 'OTHER_INDEX', 'RRG', 'WT', 'CIXN', 'CIXS', 'CIXR', 'CIXC', 'CIXX', 'CIXI', 'INDEX_DERIV', 'BBG'];
const missingTabs = tabs.filter((tab) => !extension.includes(tab) || !spec.includes(`| ${tab} |`));
const dispatches = [...extension.matchAll(/if \(moduleId === '([^']+)'\) return <([A-Za-z0-9_]+)/g)].map(([, tab, component]) => ({ tab, component }));
const dispatchMap = new Map(dispatches.map(({ tab, component }) => [tab, component]));
const missingDedicatedDispatch = tabs.filter((tab) => !dispatchMap.has(tab));
const duplicateDedicatedComponents = [...new Set(dispatches.map(({ component }) => component).filter((component) => dispatches.filter((entry) => entry.component === component).length > 1))];
const undefinedDedicatedComponents = dispatches.filter(({ component }) => !extension.includes(`function ${component}(`)).map(({ component }) => component);
const mappingRows = mapping.trim().split(/\n/).slice(1).map((line) => line.split('\t'));
const missingMappingTabs = tabs.filter((tab) => !mappingRows.some((row) => row[0] === tab));
const malformedMappingRows = mappingRows.filter((row) => row.length !== 5);
const externalDataCallMarkers = [...extension.matchAll(/\b(fetch|axios|trpc|dataApi|XMLHttpRequest|Math\.random)\b/g)].map((match) => match[1]);
const requiredTitles = ['指数观察优先级清单', '久期敏感度冲击台', '宏观传导图谱', '篮子权重漂移估算', '双腿价差阈值观察', '指数合约滚动日历'];
const missingDistinctTitles = requiredTitles.filter((title) => !extension.includes(title));
const visualMarkers = {
  INDEX_HOME: 'SESSION QUEUE', SECF: 'COVERAGE BOARD', HELP_INDX: 'VERSION TRACE', WEI: 'RELATIVE SCALE', WEIF: 'RULE TRIAL', WBIX: 'DURATION STRESS', GMM: 'TRANSMISSION MAP', IN: 'IDENTIFIER AUDIT', INP: 'SNAPSHOT CHECK', CIX: 'WEIGHT CLOSURE', CIXB: 'DRIFT MAP', AGG: 'BLEND DECOMPOSITION', FDFD: 'DISCLOSURE LEDGER', OTHER_INDEX: 'TYPE ROUTER', RRG: 'QUADRANT PATH', WT: 'METHOD CALENDAR', CIXN: 'CALCULATION TAPE', CIXS: 'SPREAD THRESHOLD', CIXR: 'RATIO LOG', CIXC: 'UNIT FLOW', CIXX: 'CSV SCHEMA', CIXI: 'CONTINUITY SCAN', INDEX_DERIV: 'ROLL CALENDAR', BBG: 'FIELD CONTRACT',
};
const missingVisualMarkers = Object.entries(visualMarkers).filter(([, marker]) => !extension.includes(marker)).map(([tab]) => tab);
const componentBody = (name) => {
  const start = extension.indexOf(`function ${name}(`);
  if (start < 0) return '';
  const after = extension.slice(start);
  const nextFunction = after.search(/\nfunction |\nexport default/);
  return nextFunction < 0 ? after : after.slice(0, nextFunction);
};
const taskInputResultFingerprints = {
  SECF: ['行业分类', '已人工核对', '待核对'],
  HELP_INDX: ['口径版本', '记录版本节点', '尚无版本节点'],
  WEI: ['指数 A 收益%', 'A − B', 'pp'],
  WEIF: ['命中数', '候选总数', '规则试算'],
  WBIX: ['修正久期', '金额', 'bp'],
  GMM: ['已观察驱动', '传导通道', '观察期限'],
  IN: ['指数代码', '字符格式可读', '需人工复核字符'],
  INP: ['观察日期', 'READY', '已核对'],
  CIX: ['成分, 权重%', '距 100%', '最大单项'],
  CIXB: ['成分,当前,目标', '篮子权重漂移估算', 'pp'],
  AGG: ['指数名,比例,收益', 'const contribution', '输入收益'],
  FDFD: ['因子或约束', '入账', '尚无披露记录'],
  OTHER_INDEX: ['指数名称', '指数类型分流器', '待人工归类'],
  RRG: ['起始象限', '结束象限', 'quadrants'],
  WT: ['权重方法', '加入日历', '复核：'],
  CIXN: ['左值', '压入算带', 'CALCULATION TAPE'],
  CIXS: ['腿 A', '人工阈值', '达到人工阈值'],
  CIXR: ['分子', '记录当前比率', 'vs 基准'],
  CIXC: ['人工换算系数', '来源单位', '目标单位'],
  CIXX: ['表头列', '样例行', '重复列'],
  CIXI: ['检测到', '跨日缺口', '缺口前后'],
  INDEX_DERIV: ['到期日', '距到期', '临近滚动'],
  BBG: ['字段集合', '预期来源', 'FIELD'],
};
const missingTaskInputResultFingerprints = Object.entries(taskInputResultFingerprints)
  .filter(([tab, markers]) => {
    const component = dispatchMap.get(tab);
    const body = component ? componentBody(component) : '';
    return markers.some((marker) => !body.includes(marker));
  })
  .map(([tab]) => tab);
const duplicateTaskInputResultFingerprints = Object.entries(taskInputResultFingerprints)
  .filter(([tab, markers]) => Object.entries(taskInputResultFingerprints).some(([otherTab, otherMarkers]) => tab !== otherTab && markers.join('|') === otherMarkers.join('|')))
  .map(([tab]) => tab);
const legacySharedTemplates = [...extension.matchAll(/^function (Shell|Generic|Matrix|Calculator|Weight|Dates)\(/gm)].map((match) => match[1]);
const result = {
  generatedAt: new Date().toISOString(),
  tabCount: tabs.length,
  missingTabs,
  dedicatedDispatchCount: dispatches.length,
  missingDedicatedDispatch,
  duplicateDedicatedComponents,
  undefinedDedicatedComponents,
  mappingRowCount: mappingRows.length,
  missingMappingTabs,
  malformedMappingRows: malformedMappingRows.length,
  externalDataCallMarkers,
  missingDistinctTitles,
  visualMarkerCount: Object.keys(visualMarkers).length - missingVisualMarkers.length,
  missingVisualMarkers,
  taskInputResultFingerprintCount: Object.keys(taskInputResultFingerprints).length - missingTaskInputResultFingerprints.length,
  missingTaskInputResultFingerprints,
  duplicateTaskInputResultFingerprints,
  legacySharedTemplates,
  oldUnifiedResearchLayerMounted: wrapper.includes('IndexResearchLayer'),
  originalWorkspacePreserved: wrapper.includes('data-preserved-index-workspace="true"'),
  eventArchivePreserved: wrapper.includes('IndexEventWorkspace'),
  officialWeightToolsPreserved: wrapper.includes('IndexOfficialWeightImportPanel'),
  distinctLayerMounted: wrapper.includes('IndexDistinctExtension'),
};
result.pass = result.tabCount === 24 && result.missingTabs.length === 0 && result.dedicatedDispatchCount === 24 && result.missingDedicatedDispatch.length === 0 && result.duplicateDedicatedComponents.length === 0 && result.undefinedDedicatedComponents.length === 0 && result.mappingRowCount === 24 && result.missingMappingTabs.length === 0 && result.malformedMappingRows === 0 && result.externalDataCallMarkers.length === 0 && result.missingDistinctTitles.length === 0 && result.visualMarkerCount === 24 && result.missingVisualMarkers.length === 0 && result.taskInputResultFingerprintCount === 23 && result.missingTaskInputResultFingerprints.length === 0 && result.duplicateTaskInputResultFingerprints.length === 0 && result.legacySharedTemplates.length === 0 && !result.oldUnifiedResearchLayerMounted && result.originalWorkspacePreserved && result.eventArchivePreserved && result.officialWeightToolsPreserved && result.distinctLayerMounted;
writeFileSync(resolve(root, 'audit/runtime/index-extension-uniqueness-audit.json'), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result));
