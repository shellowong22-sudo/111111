import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";

type FederalRegisterApiRow = {
  document_number?: string;
  title?: string;
  abstract?: string | null;
  type?: string;
  publication_date?: string;
  effective_on?: string | null;
  agencies?: Array<{ name?: string }>;
};

export type FederalRegisterDocument = {
  documentNumber: string;
  title: string;
  abstract: string | null;
  documentType: string | null;
  publicationDate: string | null;
  effectiveOn: string | null;
  agencies: string[];
  sourceReference: string;
};

type FederalRegisterResponse = { results?: FederalRegisterApiRow[] };
type FederalRegisterResult = {
  status: "available" | "unavailable";
  query: string;
  retrievedAt: Date;
  documents: FederalRegisterDocument[];
  limitation: string;
};
type CachedResult = { at: number; data: FederalRegisterResult };
const documentCache = new Map<string, CachedResult>();

export function normalizeFederalRegisterDocument(row: FederalRegisterApiRow): FederalRegisterDocument | null {
  const documentNumber = row.document_number?.trim();
  const title = row.title?.trim();
  if (!documentNumber || !title) return null;
  const agencies = (row.agencies ?? []).flatMap((agency) => agency.name?.trim() ? [agency.name.trim()] : []).slice(0, 8);
  return {
    documentNumber: documentNumber.slice(0, 80),
    title: title.slice(0, 600),
    abstract: row.abstract?.replace(/\s+/g, " ").trim().slice(0, 2_400) || null,
    documentType: row.type?.trim().slice(0, 80) || null,
    publicationDate: row.publication_date?.trim().slice(0, 20) || null,
    effectiveOn: row.effective_on?.trim().slice(0, 20) || null,
    agencies,
    sourceReference: `Federal Register API · ${documentNumber.slice(0, 80)}`,
  };
}

export async function getFederalRegisterDocuments(query: string, limit: number): Promise<FederalRegisterResult> {
  const normalizedQuery = query.trim().replace(/\s+/g, " ");
  const cacheKey = `${normalizedQuery.toLowerCase()}:${limit}`;
  const cached = documentCache.get(cacheKey);
  if (cached && Date.now() - cached.at < 5 * 60_000) return cached.data;

  const url = new URL("https://www.federalregister.gov/api/v1/documents.json");
  url.searchParams.set("per_page", String(limit));
  url.searchParams.set("order", "newest");
  url.searchParams.set("conditions[term]", normalizedQuery);

  let data: FederalRegisterResult;
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "Finance Hub official evidence terminal contact@finance-hub.local" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) throw new Error(`FEDERAL_REGISTER_HTTP_${response.status}`);
    const payload = await response.json() as FederalRegisterResponse;
    const documents = (payload.results ?? []).flatMap((row) => {
      const document = normalizeFederalRegisterDocument(row);
      return document ? [document] : [];
    }).slice(0, limit);
    data = {
      status: "available",
      query: normalizedQuery,
      retrievedAt: new Date(),
      documents,
      limitation: "仅展示本次从 Federal Register 公共 API 实际读取的文件编号、标题、机构、发布日期与受限摘要。FederalRegister.gov 是信息性 XML 资源；法律研究应以官方版本核验，终端不生成法律结论、法规状态推断或市场影响预测。",
    };
  } catch {
    data = {
      status: "unavailable",
      query: normalizedQuery,
      retrievedAt: new Date(),
      documents: [],
      limitation: "当前无法读取 Federal Register 公共 API；终端保持真实空状态，不以静态文件、第三方网页或推测性政策摘要替代。",
    };
  }
  documentCache.set(cacheKey, { at: Date.now(), data });
  return data;
}

export const industryGroupOfficialRouter = router({
  getFederalRegisterDocuments: publicProcedure
    .input(z.object({ query: z.string().trim().min(2).max(160), limit: z.number().int().min(1).max(24).default(12) }))
    .query(({ input }) => getFederalRegisterDocuments(input.query, input.limit)),
});
