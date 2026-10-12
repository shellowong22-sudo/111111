import { ADMIN_DATA_MODULES, type AdminDataModule } from './adminDataModules';

export type ApiAllocationAccess = 'public_no_key' | 'optional_key' | 'licensed' | 'internal';
export type ApiAllocationStatus = 'public_adapter' | 'requires_key' | 'requires_license' | 'requires_user_data' | 'not_configured';
export type ApiAllocationKind = 'official_statistics' | 'public_market_eod' | 'public_rates' | 'public_news_cleaner' | 'licensed_market' | 'user_owned' | 'internal_operational';

export type ApiAllocation = {
  allocationId: string;
  moduleId: string;
  moduleName: string;
  path: string;
  dataContractId: string;
  adapterKind: ApiAllocationKind;
  provider: string;
  access: ApiAllocationAccess;
  status: ApiAllocationStatus;
  refreshBoundary: 'realtime' | 'end_of_day' | 'latest_release' | 'on_request' | 'user_event' | 'not_configured';
  ownedFields: string[];
  ownershipKey: string;
  limitation: string;
};

const safeId = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 72);

function classify(module: AdminDataModule): Omit<ApiAllocation, 'allocationId' | 'moduleId' | 'moduleName' | 'path' | 'dataContractId' | 'ownershipKey'> {
  const id = module.id.toLowerCase();
  const path = module.path.toLowerCase();
  if (id.startsWith('economic-') || path.startsWith('/econ-hub')) {
    return {
      adapterKind: 'official_statistics', provider: 'FRED · World Bank · BLS · Eurostat · IMF', access: 'public_no_key', status: 'public_adapter', refreshBoundary: 'latest_release',
      ownedFields: [`${module.id}.official_observation`, `${module.id}.period`, `${module.id}.revision`],
      limitation: '仅允许服务端按该经济功能的唯一统计序列读取；频率、修订和国家范围由序列定义，不生成市场预期。',
    };
  }
  if (id.startsWith('stock-') || id.startsWith('preferred-stock-') || id.startsWith('industry-group-') || ['equity-market', 'market', 'index-hub', 'forex-hub', 'commodity-market', 'energy-market', 'precious-metals', 'crypto-market'].includes(id)) {
    return {
      adapterKind: 'public_market_eod', provider: 'Stooq public CSV · SEC EDGAR filing facts', access: 'public_no_key', status: 'public_adapter', refreshBoundary: 'end_of_day',
      ownedFields: [`${module.id}.ohlcv`, `${module.id}.instrument`, `${module.id}.observed_at`],
      limitation: '公开市场适配器只提供可验证的日线或申报事实；不冒充实时 bid/ask、逐笔、订单簿或可执行报价。',
    };
  }
  if (id.startsWith('news-') || path.startsWith('/news-hub')) {
    return {
      adapterKind: 'public_news_cleaner', provider: '官方 RSS/Atom · 服务端正文清洗', access: 'public_no_key', status: 'public_adapter', refreshBoundary: 'on_request',
      ownedFields: [`${module.id}.article_key`, `${module.id}.headline`, `${module.id}.published_at`, `${module.id}.dedupe_hash`],
      limitation: '只读取已登记且可验证的发布源；每个新闻分片拥有独立去重键，不把总新闻流复制到所有子页。',
    };
  }
  if (id.startsWith('mm-') || path.startsWith('/money-market') || /money-market|interest-rates|yield-curve|curve|bond-market/.test(path)) {
    return {
      adapterKind: 'public_rates', provider: 'FRED · NY Fed Markets API · U.S. Treasury Fiscal Data', access: 'public_no_key', status: 'public_adapter', refreshBoundary: 'latest_release',
      ownedFields: [`${module.id}.rate`, `${module.id}.tenor`, `${module.id}.observation_date`],
      limitation: '仅按该功能绑定的官方利率序列读取；不把国债参照曲线标记为市政债估值、报价或成交。',
    };
  }
  if (module.domain === '交易与工作流' || module.domain === '衍生品' || /emsx|order|trade|execution|rfq|option|derivative|moso|nceo|boom|deal|mbwd/.test(`${id} ${path}`)) {
    return {
      adapterKind: 'licensed_market', provider: '授权交易/衍生品供应商适配器', access: 'licensed', status: 'requires_license', refreshBoundary: 'realtime',
      ownedFields: [`${module.id}.quote`, `${module.id}.trade`, `${module.id}.liquidity`],
      limitation: '逐笔行情、RFQ、库存、期权链和执行字段需要合法许可；未配置时保持未接入，不用其他模块数据替代。',
    };
  }
  if (module.domain === '基金与组合' || module.domain === '系统数据' || module.managementCapability === '统一目录配置') {
    return {
      adapterKind: 'user_owned', provider: '用户账户/内部工作流', access: 'internal', status: 'requires_user_data', refreshBoundary: 'user_event',
      ownedFields: [`${module.id}.user_input`, `${module.id}.account_state`, `${module.id}.audit_event`],
      limitation: '该功能依赖用户账户、组合或内部工作流；后端不编造持仓、订单、权限或模型结果。',
    };
  }
  return {
    adapterKind: 'internal_operational', provider: '受控服务端适配器', access: 'internal', status: 'not_configured', refreshBoundary: 'not_configured',
    ownedFields: [`${module.id}.observation`, `${module.id}.status`],
    limitation: '尚未登记与该功能口径匹配的合法数据适配器；保持未接入，不将相邻模块的内容写入。',
  };
}

export const API_ALLOCATIONS: readonly ApiAllocation[] = ADMIN_DATA_MODULES.map(module => {
  const classified = classify(module);
  const key = safeId(module.id);
  return {
    allocationId: `allocation.${key}`,
    moduleId: module.id,
    moduleName: module.name,
    path: module.path,
    dataContractId: `module.${key}.unique-observation`,
    ownershipKey: `frontend:${module.id}`,
    ...classified,
  };
});

export function assertApiAllocationRegistry() {
  if (API_ALLOCATIONS.length !== ADMIN_DATA_MODULES.length) throw new Error('API_ALLOCATION_MODULE_COUNT_MISMATCH');
  const unique = (values: string[]) => new Set(values).size === values.length;
  if (!unique(API_ALLOCATIONS.map(item => item.moduleId))) throw new Error('API_ALLOCATION_MODULE_DUPLICATE');
  if (!unique(API_ALLOCATIONS.map(item => item.dataContractId))) throw new Error('API_ALLOCATION_CONTRACT_DUPLICATE');
  if (!unique(API_ALLOCATIONS.map(item => item.ownershipKey))) throw new Error('API_ALLOCATION_OWNER_DUPLICATE');
  return true;
}

export function apiAllocationForModule(moduleId: string) {
  return API_ALLOCATIONS.find(item => item.moduleId === moduleId) ?? null;
}

export function summarizeApiAllocations() {
  const count = (status: ApiAllocationStatus) => API_ALLOCATIONS.filter(item => item.status === status).length;
  return {
    total: API_ALLOCATIONS.length,
    publicAdapter: count('public_adapter'),
    requiresKey: count('requires_key'),
    requiresLicense: count('requires_license'),
    requiresUserData: count('requires_user_data'),
    notConfigured: count('not_configured'),
    uniqueContracts: new Set(API_ALLOCATIONS.map(item => item.dataContractId)).size,
    boundary: '每个既有前端功能拥有一个唯一数据合同和所有权键；分配不等于查询成功。只有实际请求产生带观察期的记录后，后台才计为已验证。',
  };
}
