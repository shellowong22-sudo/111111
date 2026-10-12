import {
  FINCEPT_CAPABILITIES,
  FINCEPT_PLACEHOLDER_SLOT_GROUPS,
  FINCEPT_PLACEHOLDER_SLOT_BINDINGS,
} from "../shared/finceptCapabilityCatalog";
import {
  FINCEPT_TERMINAL_ARCHIVE_AUDIT,
  FINCEPT_TERMINAL_ARCHIVE_CATEGORIES,
  FINCEPT_TERMINAL_FRONTEND_SURFACES,
} from "../shared/finceptTerminalAudit";
import {
  listManagedPublicDatasetStates,
  MANAGED_PUBLIC_DATASETS,
} from "./adminPublicDatasetIngestion";
import { FINMIND_MODULE_BINDINGS } from "../shared/finmindModuleBindings";
import { readArchivedPublicDataset } from "./archivedPublicDataset";
import {
  getFinceptProfessionalApplicationCoverage,
} from "../shared/finceptProfessionalApplicationCoverage";

type RuntimeState = {
  lastStatus?: string | null;
  lastSuccessAt?: Date | string | null;
  lastAttemptAt?: Date | string | null;
  lastError?: string | null;
};

export type FinceptRuntimeBinding = {
  id: string;
  category: string;
  moduleId: string;
  frontendPath: string;
  datasetIds: string[];
  dataContractIds: string[];
  origin: "archive_direct" | "existing_platform" | "mixed";
  status: "verified" | "configured_unverified" | "blocked";
  observedAt: string | null;
  lastError: string | null;
  note: string;
};

/**
 * The archive has hundreds of Python functions, but the application must only
 * report a live binding when an existing server adapter and an existing
 * persistent dataset contract are both present.  This prevents a script
 * inventory from being mistaken for a running market-data service.
 */
const RUNTIME_BINDINGS: ReadonlyArray<{
  id: string;
  capabilityId: string;
  datasetIds: string[];
  origin: FinceptRuntimeBinding["origin"];
  note: string;
}> = [
  {
    id: "equities",
    capabilityId: "stocks",
    datasetIds: [
      "fincept-twse-equity-snapshot",
      "fincept-twse-equity-valuation",
      "fincept-nasdaq-screener",
      "fincept-nasdaq-earnings-calendar",
      "fincept-nasdaq-dividend-calendar",
      "fincept-nasdaq-ipo-calendar",
      "akshare-cn-stock-snapshot",
      "akshare-cn-stock-directory",
      "akshare-hk-stock-snapshot",
      "akshare-us-stock-snapshot",
    ],
    origin: "archive_direct",
    note: "股票行情和日频估值分别进入 EQS 的行情与市盈率筛选；不复制到指数、基金或新闻。",
  },
  {
    id: "indices",
    capabilityId: "indices",
    datasetIds: [
      "fincept-twse-taiex-snapshot",
      "fincept-cboe-volatility-history",
      "fincept-cboe-index-snapshot",
      "akshare-cn-index-snapshot",
      "akshare-global-index-snapshot",
      "akshare-global-sox-index",
    ],
    origin: "archive_direct",
    note: "指数只进入 WEI/指数中心；成分与价格不跨模块复制。",
  },
  {
    id: "commodities",
    capabilityId: "commodities",
    datasetIds: [
      "fincept-nbp-gold-reference",
      "eia-us-ng-storage",
      "eia-us-commercial-crude-inventory",
      "eia-us-refinery-utilization",
      "fred-wti-oil",
      "akshare-global-shipping-bdi",
    ],
    origin: "mixed",
    note: "黄金 PLN/克参考价直接适配；已有能源观察继续进入 COMM，两个口径不混用。",
  },
  {
    id: "futures",
    capabilityId: "futures",
    datasetIds: [
      "akshare-futures-snapshot",
      "akshare-cn-futures-snapshot",
      "akshare-cn-futures-inventory",
      "finmind:finmind-tw-futures-daily",
      "fincept-cftc-disaggregated-weekly",
    ],
    origin: "existing_platform",
    note: "期货只进入已有商品期货/衍生品面板；没有授权逐笔报价时显示真实空态。",
  },
  {
    id: "options",
    capabilityId: "options",
    datasetIds: ["akshare-options-snapshot", "finmind:finmind-tw-options-daily"],
    origin: "existing_platform",
    note: "期权只进入 MOSO/期权链；不把期权链复制到期货或股票。",
  },
  {
    id: "funds-etf",
    capabilityId: "funds",
    datasetIds: ["akshare-etf-snapshot", "akshare-fund-snapshot"],
    origin: "existing_platform",
    note: "基金与 ETF 只进入基金浏览既有页面；缺少真实观察时保持空态，不填充样例。",
  },
  {
    id: "forex",
    capabilityId: "forex",
    datasetIds: [
      "fincept-nbp-usdpln-reference",
      "fincept-nbp-fx-basket",
      "fincept-cnb-fx-basket",
      "fincept-boi-fx-basket",
      "hkma-daily-exchange-rates",
      "bank-of-canada-usdcad",
      "fred-usd-eur",
    ],
    origin: "mixed",
    note: "USD/PLN、NBP A 表货币对与 CNB/CZK 货币对分别归档，其他已有外汇合同继续按独立货币对进入外汇中心。",
  },
  {
    id: "crypto",
    capabilityId: "crypto",
    datasetIds: ["fred-bitcoin-usd", "fincept-coingecko-markets"],
    origin: "existing_platform",
    note: "加密资产使用 FRED 比特币参考历史和新增 CoinGecko 日频市场快照；两者均以公开观察归档，不标记为交易所逐笔实时。",
  },
  {
    id: "news",
    capabilityId: "news",
    datasetIds: ["akshare-news-publication"],
    origin: "existing_platform",
    note: "新闻只进入新闻与研究既有标签页；文章按内容指纹去重。",
  },
  {
    id: "macro",
    capabilityId: "macro",
    datasetIds: [
      "akshare-economic-gdp",
      "akshare-economic-cpi",
      "akshare-economic-pmi",
      "bls-us-cpi",
      "us-real-gdp",
      "us-unemployment",
      "world-bank-global-gdp",
      "imf-world-gdp-growth",
      "eurostat-eu27-unemployment",
      "fincept-nasdaq-economic-calendar",
    ],
    origin: "existing_platform",
    note: "宏观与经济观察只进入经济分析既有数据槽；发布周期不标为实时行情。",
  },
];

function iso(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function datasetById(id: string) {
  return MANAGED_PUBLIC_DATASETS.find(dataset => dataset.id === id) ?? null;
}

function contractForDatasetId(id: string) {
  const managed = datasetById(id);
  if (managed) return managed.dataContractId;
  if (id.startsWith("finmind:")) {
    return (
      FINMIND_MODULE_BINDINGS.find(binding => `finmind:${binding.id}` === id)
        ?.dataContractId ?? null
    );
  }
  return null;
}

function toBinding(
  definition: (typeof RUNTIME_BINDINGS)[number],
  stateById: Map<string, RuntimeState>
): FinceptRuntimeBinding {
  const capability = FINCEPT_CAPABILITIES.find(
    item => item.id === definition.capabilityId
  );
  const category = FINCEPT_TERMINAL_ARCHIVE_CATEGORIES.find(
    item => item.id === definition.id
  );
  const states = definition.datasetIds
    .map(id => stateById.get(id))
    .filter((state): state is RuntimeState => Boolean(state));
  const successful = states.filter(state =>
    ["available", "succeeded"].includes(String(state.lastStatus))
  );
  const last = successful
    .map(state => iso(state.lastSuccessAt))
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? null;
  const latestError =
    states
      .map(state => state.lastError)
      .find(value => typeof value === "string" && value.trim()) ?? null;
  const status: FinceptRuntimeBinding["status"] = successful.length
    ? "verified"
    : definition.datasetIds.some(id => Boolean(contractForDatasetId(id)))
      ? "configured_unverified"
      : "blocked";
  return {
    id: definition.id,
    category: category?.label ?? capability?.category ?? definition.id,
    moduleId: capability?.moduleId ?? "unmapped",
    frontendPath: capability?.frontendPath ?? "/",
    datasetIds: definition.datasetIds,
    dataContractIds: definition.datasetIds.flatMap(id => {
      const contract = contractForDatasetId(id);
      return contract ? [String(contract)] : [];
    }),
    origin: definition.origin,
    status,
    observedAt: last,
    lastError: latestError,
    note: definition.note,
  };
}

export async function getFinceptTerminalStatus() {
  const states = await listManagedPublicDatasetStates();
  const stateById = new Map<string, RuntimeState>(
    states.map(state => [
      state.datasetId,
      {
        lastStatus: state.lastStatus,
        lastSuccessAt: state.lastSuccessAt,
        lastAttemptAt: state.lastAttemptAt,
        lastError: state.lastError,
      },
    ])
  );
  const archiveByContract = new Map<
    string,
    Promise<Awaited<ReturnType<typeof readArchivedPublicDataset>>>
  >();
  const readContractArchive = async (contract: string) => {
    const cached = archiveByContract.get(contract);
    if (cached) return cached;
    const archivePromise = readArchivedPublicDataset(contract, 1);
    archiveByContract.set(contract, archivePromise);
    return archivePromise;
  };
  // The durable observation ledger is authoritative for a prior successful
  // collection even when the optional scheduler-state table is empty (for
  // example after a restart or when the app runs without a database).
  const archiveChecks = await Promise.all(
    RUNTIME_BINDINGS.flatMap(definition =>
      definition.datasetIds.map(async datasetId => {
        const contract = contractForDatasetId(datasetId);
        if (!contract) return null;
        const archived = await readContractArchive(contract);
        // Calendar contracts may contain future event dates.  The runtime
        // status must report when the source was read, not the event's
        // scheduled date; eventDate remains in the row payload.
        const latest = archived.observations.at(-1)?.retrievedAt ?? null;
        return archived.available && latest
          ? { datasetId, latest }
          : null;
      })
    )
  );
  const verifiedDatasets = new Set(archiveChecks.flatMap(check => check ? [check.datasetId] : []));
  for (const check of archiveChecks) {
    if (!check) continue;
    const current = stateById.get(check.datasetId);
    if (
      !current ||
      !["available", "succeeded"].includes(String(current.lastStatus))
    ) {
      stateById.set(check.datasetId, {
        ...(current ?? {}),
        lastStatus: "succeeded",
        lastSuccessAt: check.latest,
      });
    }
  }
  const bindings = RUNTIME_BINDINGS.map(binding =>
    toBinding(binding, stateById)
  );
  const verifiedCount = bindings.filter(
    binding => binding.status === "verified"
  ).length;
  const directBindings = bindings.filter(
    binding => binding.origin === "archive_direct"
  );
  const existingPlatformBindings = bindings.filter(
    binding => binding.origin === "existing_platform"
  );
  const mixedBindings = bindings.filter(binding => binding.origin === "mixed");
  const directVerifiedCount = directBindings.filter(
    binding => binding.status === "verified"
  ).length;
  const directDatasetChecks = MANAGED_PUBLIC_DATASETS
    .filter(dataset => dataset.id.startsWith("fincept-"))
    .map(dataset => ({
      id: dataset.id,
      label: dataset.label,
      dataContractId: dataset.dataContractId,
      moduleId: dataset.moduleId,
      status: verifiedDatasets.has(dataset.id) ? "verified" as const : "configured_unverified" as const,
      observedAt: archiveChecks.find(check => check?.datasetId === dataset.id)?.latest ?? null,
    }));
  const placeholderBindings = await Promise.all(
    FINCEPT_PLACEHOLDER_SLOT_BINDINGS.map(async binding => {
      const contract = binding.dataContractId;
      if (!contract) {
        return {
          ...binding,
          status: "blocked" as const,
          observedAt: null,
          retrievedAt: null,
          source: null,
          reason: "未建立唯一数据合同",
        };
      }
      const archive = await readContractArchive(contract);
      const latest = archive.observations.at(-1);
      return {
        ...binding,
        status: archive.available ? "verified" as const : "configured_unverified" as const,
        observedAt: latest?.date ?? null,
        retrievedAt: latest?.retrievedAt ?? null,
        source: latest?.source ?? null,
        reason: archive.available
          ? "已有页面、唯一合同和真实归档观察已核验"
          : "合同已登记，但当前没有可核验观察",
      };
    }),
  );
  const existingPlatformVerifiedCount = existingPlatformBindings.filter(
    binding => binding.status === "verified"
  ).length;
  const mixedVerifiedCount = mixedBindings.filter(binding => binding.status === "verified").length;
  const configuredCount = bindings.filter(
    binding => binding.status !== "blocked"
  ).length;
  return {
    archive: {
      ...FINCEPT_TERMINAL_ARCHIVE_AUDIT,
      /**
       * These are archive facts, not live connection counts.  Keeping them in
       * the response lets the admin page explain why a large Qt/API inventory
       * does not equal a large number of runnable integrations.
      */
      apiConnectorScriptCount: FINCEPT_TERMINAL_ARCHIVE_AUDIT.pythonScriptCount,
      totalPythonScriptCount:
        FINCEPT_TERMINAL_ARCHIVE_AUDIT.pythonScriptTotalCount,
      qtFrontendFileCount: FINCEPT_TERMINAL_ARCHIVE_AUDIT.qtScreenFileCount,
      qtServiceFileCount: FINCEPT_TERMINAL_ARCHIVE_AUDIT.qtServiceFileCount,
    },
    categoryAudit: FINCEPT_TERMINAL_ARCHIVE_CATEGORIES,
    frontendSurfaces: FINCEPT_TERMINAL_FRONTEND_SURFACES,
    placeholderSlots: FINCEPT_PLACEHOLDER_SLOT_GROUPS,
    placeholderSlotCount: FINCEPT_PLACEHOLDER_SLOT_GROUPS.reduce(
      (total, group) => total + group.positions.length,
      0
    ),
    placeholderBindings,
    /**
     * Professional applications are intentionally reported in a separate
     * registry.  They are not numbered ZIP slot replacements and are not
     * marked live unless their own account/market data source is verified.
     */
    professionalApplications: getFinceptProfessionalApplicationCoverage(),
    replacedPlaceholderSlotCount: placeholderBindings.filter(item => item.status === "verified").length,
    bindings,
    boundCount: configuredCount,
    verifiedCount,
    directBindingCount: directBindings.length,
    directVerifiedCount,
    directDatasetChecks,
    directDatasetCount: directDatasetChecks.length,
    directDatasetVerifiedCount: directDatasetChecks.filter(check => check.status === "verified").length,
    existingPlatformBindingCount: existingPlatformBindings.length,
    existingPlatformVerifiedCount,
    mixedBindingCount: mixedBindings.length,
    mixedVerifiedCount,
    blockedCount: bindings.length - configuredCount,
    archiveOnlyScriptCount:
      FINCEPT_TERMINAL_ARCHIVE_AUDIT.pythonScriptCount -
      FINCEPT_TERMINAL_ARCHIVE_CATEGORIES.reduce(
        (total, category) => total + category.scriptCount,
        0
      ),
    credentialHintScriptCount:
      FINCEPT_TERMINAL_ARCHIVE_AUDIT.scriptsWithCredentialHints,
    status:
      verifiedCount === bindings.length
        ? "verified"
        : verifiedCount > 0
          ? "partial"
          : "not_verified",
    policy:
      "压缩包代码只作为能力清单；只有已有服务端适配器、唯一数据合同和真实成功状态才显示为已验证。未验证、缺密钥或依赖缺失的脚本不会向前端推送。列出的旧编号槽位保持原样，除非以后出现可验证的前端合同。",
    refreshedAt: new Date().toISOString(),
  };
}
