import { createHash } from "node:crypto";
import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { parseFredObservations } from "../fredObservationParser";
import {
  listPreferredResearchAudit,
  listPreferredResearchEvidence,
  listPreferredResearchPackages,
  removePreferredResearchEvidence,
  savePreferredResearchEvidence,
  savePreferredResearchPackage,
  submitPreferredResearchPackage,
} from "../preferredStockResearchDb";
import {
  DIVIDEND_TYPES,
  PAYMENT_FREQUENCIES,
  buildTermCoverageReport,
  getPreferredTermCoverage,
  importPreferredTerms,
  listPreferredTermImportBatches,
  listPreferredTerms,
  validatePreferredTermRows,
} from "../preferredStockTermImport";

const SEC_HEADERS = {
  "User-Agent": "Finance Hub research contact@finance-hub.local",
  Accept: "application/json,text/plain,*/*",
};
const SEC_TICKER_URL = "https://www.sec.gov/files/company_tickers.json";
const FRED_SERIES = [
  { id: "DGS2", label: "2 年期国债参照", group: "rate" },
  { id: "DGS5", label: "5 年期国债参照", group: "rate" },
  { id: "DGS10", label: "10 年期国债参照", group: "rate" },
  { id: "DGS30", label: "30 年期国债参照", group: "rate" },
  { id: "BAMLC0A0CM", label: "投资级综合 OAS", group: "credit" },
  { id: "BAMLC0A4CBBB", label: "BBB 公司债 OAS", group: "credit" },
  { id: "BAMLH0A0HYM2", label: "高收益综合 OAS", group: "credit" },
] as const;

type TickerRecord = { cik_str: number; ticker: string; title: string };
type FredObservation = {
  id: string;
  indicatorId: string;
  source: "FRED";
  unit: "%";
  realtime: false;
  frequency: "daily";
  label: string;
  group: "rate" | "credit";
  observationDate: string | null;
  value: number | null;
  changeBps: number | null;
  history: Array<{ date: string; value: number }>;
  quality: ReturnType<typeof parseFredObservations>["quality"];
  status: "available" | "unavailable";
  limitation: string;
};
let issuerCache: { at: number; rows: TickerRecord[] } | null = null;
let environmentCache: {
  at: number;
  value: Awaited<ReturnType<typeof getMarketEnvironment>>;
} | null = null;
let activeEnvironment: Promise<
  Awaited<ReturnType<typeof getMarketEnvironment>>
> | null = null;

function normalizeCik(value: string | number) {
  return String(value).replace(/\D/g, "").padStart(10, "0").slice(-10);
}

export function parseFredCsv(
  csv: string,
  definition: (typeof FRED_SERIES)[number]
): FredObservation {
  const { history: rows, quality } = parseFredObservations(csv, definition.id);
  const latest = rows.at(-1) ?? null;
  const previous = rows.at(-2) ?? null;
  return {
    id: definition.id,
    indicatorId: `fred:${definition.id}`,
    source: "FRED",
    unit: "%",
    realtime: false,
    frequency: "daily",
    label: definition.label,
    group: definition.group,
    observationDate: latest?.date ?? null,
    value: latest?.value ?? null,
    changeBps:
      latest && previous
        ? Number(((latest.value - previous.value) * 100).toFixed(1))
        : null,
    history: rows.slice(-180),
    quality,
    status: latest ? "available" : "unavailable",
    limitation:
      definition.group === "rate"
        ? "公开日度期限利率参照，不是优先股个券收益率、可执行报价或估值结论。"
        : "指数级公司债信用环境参照，不等同于单只优先股利差、评级或违约概率。",
  };
}

async function fetchFred(
  definition: (typeof FRED_SERIES)[number]
): Promise<FredObservation> {
  try {
    const response = await fetch(
      `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${definition.id}`,
      { signal: AbortSignal.timeout(8_000) }
    );
    if (!response.ok) throw new Error(`FRED_${response.status}`);
    return parseFredCsv(await response.text(), definition);
  } catch {
    return {
      ...parseFredCsv("", definition),
      limitation:
        "当前无法读取公开历史序列；系统不以缓存样本、随机路径或替代报价填充。",
    };
  }
}

async function getMarketEnvironment() {
  const startedAt = Date.now();
  const series = await Promise.all(FRED_SERIES.map(fetchFred));
  const retrievedAt = new Date().toISOString();
  return {
    asOf: retrievedAt,
    retrievedAt,
    schemaVersion: 1,
    observationMode: "historical" as const,
    refreshAfterMs: 30_000,
    latencyMs: Date.now() - startedAt,
    series,
    sourceStatus: series.every(item => item.status === "available")
      ? ("available" as const)
      : series.some(item => item.status === "available")
        ? ("partial" as const)
        : ("unavailable" as const),
    sourceLabel: "FRED 公开历史观察",
    sourceBoundary:
      "仅展示实际读取的历史利率和指数级 OAS；不构造优先股个券行情、收益率、信用利差或成交。",
  };
}

async function cachedMarketEnvironment() {
  const now = Date.now();
  if (environmentCache && now - environmentCache.at < 30_000)
    return environmentCache.value;
  if (activeEnvironment) return activeEnvironment;
  activeEnvironment = getMarketEnvironment()
    .then(value => {
      environmentCache = { at: Date.now(), value };
      return value;
    })
    .finally(() => {
      activeEnvironment = null;
    });
  return activeEnvironment;
}

async function getIssuers() {
  if (issuerCache && Date.now() - issuerCache.at < 6 * 60 * 60 * 1000)
    return issuerCache.rows;
  const response = await fetch(SEC_TICKER_URL, {
    headers: SEC_HEADERS,
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`SEC_TICKERS_${response.status}`);
  const raw = (await response.json()) as Record<string, TickerRecord>;
  const rows = Object.values(raw).filter(
    row => row?.ticker && row?.title && Number.isFinite(row?.cik_str)
  );
  issuerCache = { at: Date.now(), rows };
  return rows;
}

async function getIssuerFilings(cik: string) {
  const response = await fetch(
    `https://data.sec.gov/submissions/CIK${normalizeCik(cik)}.json`,
    { headers: SEC_HEADERS, signal: AbortSignal.timeout(10_000) }
  );
  if (!response.ok) throw new Error(`SEC_SUBMISSIONS_${response.status}`);
  const body = (await response.json()) as any;
  const recent = body?.filings?.recent ?? {};
  const forms: string[] = recent.form ?? [];
  const dates: string[] = recent.filingDate ?? [];
  const accessions: string[] = recent.accessionNumber ?? [];
  const docs: string[] = recent.primaryDocument ?? [];
  const filings = forms
    .map((form, index) => ({
      form,
      filingDate: dates[index] ?? null,
      accessionNumber: accessions[index] ?? null,
      primaryDocument: docs[index] ?? null,
      category: /^(424B|S-3|8-A)/.test(form)
        ? "security_terms"
        : form === "8-K"
          ? "event"
          : /^10-(K|Q)$/.test(form)
            ? "financial_report"
            : "other",
    }))
    .filter(item =>
      [
        "424B2",
        "424B3",
        "424B5",
        "S-3",
        "8-A12B",
        "8-K",
        "10-K",
        "10-Q",
      ].includes(item.form)
    )
    .slice(0, 60);
  return {
    issuer: {
      cik: normalizeCik(body.cik),
      name: body.name ?? null,
      tickers: Array.isArray(body.tickers) ? body.tickers : [],
      exchanges: Array.isArray(body.exchanges) ? body.exchanges : [],
      sic: body.sic ?? null,
      sicDescription: body.sicDescription ?? null,
    },
    filings,
    retrievedAt: new Date().toISOString(),
    sourceStatus: "available" as const,
    sourceBoundary:
      "仅展示 SEC 实际返回的主体目录和申报元数据；条款与正文需通过终端内证据摘录核验，不等同于实时价格、成交或完整优先证券目录。",
  };
}

function plainText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

async function getFilingExcerpt(input: {
  cik: string;
  accessionNumber: string;
  primaryDocument: string;
  keyword: string;
}) {
  const cik = normalizeCik(input.cik);
  const accession = input.accessionNumber.replace(/\D/g, "");
  if (!accession || !input.primaryDocument)
    throw new Error("SEC_FILING_IDENTIFIER_REQUIRED");
  const sourceUrl = `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accession}/${encodeURIComponent(input.primaryDocument)}`;
  const response = await fetch(sourceUrl, {
    headers: SEC_HEADERS,
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`SEC_FILING_${response.status}`);
  const text = plainText(await response.text());
  const token = input.keyword.trim().toLowerCase();
  const first = text.toLowerCase().indexOf(token);
  const excerpt =
    first < 0
      ? null
      : text.slice(
          Math.max(0, first - 420),
          Math.min(text.length, first + token.length + 900)
        );
  return {
    status: excerpt ? ("available" as const) : ("not_found" as const),
    excerpt,
    keyword: input.keyword.trim(),
    retrievedAt: new Date().toISOString(),
    sourceUrl,
    sourceLabel: "SEC EDGAR 申报正文",
    sourceBoundary: excerpt
      ? "终端内仅展示关键词附近的受限长度原文片段；请按原始披露口径理解，未对法律条款作重述或解释。"
      : "该关键词未在当前可读取主文件正文中命中；系统不以推断性条款摘要替代。",
  };
}

function evidenceFingerprint(input: {
  sourceUrl: string;
  title: string;
  sourceInstitution: string;
  documentDate?: string | null;
  evidenceExtracts: Array<{ quotedText: string }>;
}) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        sourceUrl: input.sourceUrl.trim(),
        title: input.title.trim(),
        sourceInstitution: input.sourceInstitution.trim(),
        documentDate: input.documentDate ?? null,
        extracts: input.evidenceExtracts.map(item => item.quotedText.trim()),
      })
    )
    .digest("hex");
}

const documentType = z.enum([
  "prospectus",
  "annual_report",
  "quarterly_report",
  "current_report",
  "security_registration",
  "other_official",
]);
const evidenceExtract = z.object({
  label: z.string().trim().max(120).default("核验证据"),
  quotedText: z.string().trim().min(1).max(6000),
  note: z.string().trim().max(4000).default(""),
});
const termImportRow = z.object({
  securityIdentifier: z.string().nullable().optional(),
  issuerName: z.string().nullable().optional(),
  securityName: z.string().nullable().optional(),
  cik: z.string().nullable().optional(),
  dividendType: z.string().nullable().optional(),
  couponRatePct: z.union([z.string(), z.number()]).nullable().optional(),
  paymentFrequency: z.string().nullable().optional(),
  referenceIndex: z.string().nullable().optional(),
  spreadBps: z.union([z.string(), z.number()]).nullable().optional(),
  resetFrequency: z.string().nullable().optional(),
  firstCallDate: z.string().nullable().optional(),
  maturityDate: z.string().nullable().optional(),
  liquidationPreference: z
    .union([z.string(), z.number()])
    .nullable()
    .optional(),
  sourceReference: z.string().nullable().optional(),
  asOfDate: z.string().nullable().optional(),
});

export const preferredStockResearchRouter = router({
  searchIssuers: publicProcedure
    .input(
      z.object({
        query: z.string().trim().min(1).max(80),
        limit: z.number().int().min(1).max(30).default(12),
      })
    )
    .query(async ({ input }) => {
      try {
        const token = input.query.toLowerCase();
        const cikToken = token.replace(/\D/g, "");
        const rows = await getIssuers();
        return {
          status: "available" as const,
          results: rows
            .filter(
              row =>
                row.ticker.toLowerCase().includes(token) ||
                row.title.toLowerCase().includes(token) ||
                (cikToken.length > 0 &&
                  normalizeCik(row.cik_str).includes(cikToken))
            )
            .slice(0, input.limit)
            .map(row => ({
              cik: normalizeCik(row.cik_str),
              ticker: row.ticker,
              name: row.title,
            })),
          limitation:
            "SEC 上市主体目录用于主体识别；结果不表示优先股个券覆盖、实时证券状态或可交易性。",
        };
      } catch {
        return {
          status: "unavailable" as const,
          results: [],
          limitation:
            "当前无法读取 SEC 主体目录；系统不显示缓存样本或替代发行主体。",
        };
      }
    }),
  getIssuerFilings: publicProcedure
    .input(
      z.object({
        cik: z
          .string()
          .trim()
          .regex(/^\d{1,10}$/),
      })
    )
    .query(async ({ input }) => {
      try {
        return await getIssuerFilings(input.cik);
      } catch {
        return {
          issuer: null,
          filings: [],
          retrievedAt: new Date().toISOString(),
          sourceStatus: "unavailable" as const,
          sourceBoundary:
            "当前无法读取 SEC 申报目录；系统不以示例发行人、虚构条款或历史缓存替代。",
        };
      }
    }),
  getFilingExcerpt: publicProcedure
    .input(
      z.object({
        cik: z
          .string()
          .trim()
          .regex(/^\d{1,10}$/),
        accessionNumber: z.string().trim().min(10).max(32),
        primaryDocument: z.string().trim().min(1).max(240),
        keyword: z.string().trim().min(2).max(80),
      })
    )
    .query(async ({ input }) => {
      try {
        return await getFilingExcerpt(input);
      } catch {
        return {
          status: "unavailable" as const,
          excerpt: null,
          keyword: input.keyword,
          retrievedAt: new Date().toISOString(),
          sourceUrl: null,
          sourceLabel: "SEC EDGAR 申报正文",
          sourceBoundary:
            "当前无法读取该主文件或提取正文；系统不显示缓存条款、虚构摘录或第三方页面内容。",
        };
      }
    }),
  getMarketEnvironment: publicProcedure.query(cachedMarketEnvironment),
  listPackages: protectedProcedure.query(({ ctx }) =>
    listPreferredResearchPackages(ctx.user.id)
  ),
  savePackage: protectedProcedure
    .input(
      z.object({
        packageId: z.number().int().positive().optional(),
        name: z.string().trim().min(2).max(160),
        issuerName: z.string().trim().min(2).max(240),
        cik: z
          .string()
          .trim()
          .regex(/^\d{1,10}$/)
          .nullable()
          .optional(),
      })
    )
    .mutation(({ ctx, input }) =>
      savePreferredResearchPackage(ctx.user.id, input)
    ),
  listEvidence: protectedProcedure
    .input(z.object({ packageId: z.number().int().positive() }))
    .query(({ ctx, input }) =>
      listPreferredResearchEvidence(ctx.user.id, input.packageId)
    ),
  saveEvidence: protectedProcedure
    .input(
      z.object({
        packageId: z.number().int().positive(),
        sourceUrl: z.string().url().max(2000),
        title: z.string().trim().min(2).max(240),
        sourceInstitution: z.string().trim().min(2).max(160),
        documentType,
        documentDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .nullable()
          .optional(),
        evidenceExtracts: z.array(evidenceExtract).min(1).max(24),
        retrievedAt: z.date().optional(),
      })
    )
    .mutation(({ ctx, input }) =>
      savePreferredResearchEvidence(ctx.user.id, {
        ...input,
        documentFingerprint: evidenceFingerprint(input),
        retrievedAt: input.retrievedAt ?? new Date(),
      })
    ),
  removeEvidence: protectedProcedure
    .input(
      z.object({
        packageId: z.number().int().positive(),
        evidenceId: z.number().int().positive(),
      })
    )
    .mutation(({ ctx, input }) =>
      removePreferredResearchEvidence(
        ctx.user.id,
        input.packageId,
        input.evidenceId
      )
    ),
  listAudit: protectedProcedure
    .input(z.object({ packageId: z.number().int().positive() }))
    .query(({ ctx, input }) =>
      listPreferredResearchAudit(ctx.user.id, input.packageId)
    ),
  submitPackage: protectedProcedure
    .input(
      z.object({
        packageId: z.number().int().positive(),
        note: z.string().trim().max(500).nullable().optional(),
      })
    )
    .mutation(({ ctx, input }) =>
      submitPreferredResearchPackage(ctx.user.id, input.packageId, input.note)
    ),
  previewTermImport: protectedProcedure
    .input(z.object({ rows: z.array(termImportRow).min(1).max(2_000) }))
    .mutation(({ input }) => {
      const validation = validatePreferredTermRows(input.rows);
      const accepted = validation.flatMap(row =>
        row.normalized ? [row.normalized] : []
      );
      return {
        totalRows: input.rows.length,
        acceptedRows: accepted.length,
        rejectedRows: validation.filter(row => row.errors.length).length,
        warningRows: validation.filter(row => row.warnings.length).length,
        validation,
        coverage: buildTermCoverageReport(accepted),
      };
    }),
  importTerms: protectedProcedure
    .input(
      z.object({
        sourceFilename: z.string().trim().min(1).max(240),
        rows: z.array(termImportRow).min(1).max(2_000),
      })
    )
    .mutation(({ ctx, input }) =>
      importPreferredTerms(ctx.user.id, input.sourceFilename, input.rows)
    ),
  listTerms: protectedProcedure
    .input(
      z
        .object({
          dividendType: z.enum(DIVIDEND_TYPES).optional(),
          issuerQuery: z.string().trim().max(120).optional(),
          asOfStart: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional(),
          asOfEnd: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional(),
          limit: z.number().int().min(1).max(1_000).default(500),
        })
        .default({ limit: 500 })
    )
    .query(({ ctx, input }) => listPreferredTerms(ctx.user.id, input)),
  getTermCoverage: protectedProcedure.query(({ ctx }) =>
    getPreferredTermCoverage(ctx.user.id)
  ),
  listTermImportBatches: protectedProcedure.query(({ ctx }) =>
    listPreferredTermImportBatches(ctx.user.id)
  ),
});
