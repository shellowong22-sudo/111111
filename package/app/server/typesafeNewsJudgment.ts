import { setTimeout as wait } from "node:timers/promises";
import { z } from "zod";

const TYPESAFE_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
const DUPLICATE_THRESHOLD = 0.92;
const MAX_DUPLICATE_CANDIDATES = 5;
const RETRYABLE_TYPESAFE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504, 529]);

const NEWS_CATEGORIES = {
  central_bank_policy: "央行与政策",
  company_specific: "公司动态",
  energy_transition: "能源与转型",
  market_economy: "市场与经济",
  institutional_research: "机构研究",
  general_publication: "公开要闻",
} as const;

type CategoryKey = keyof typeof NEWS_CATEGORIES;

export type TypeSafeNewsCandidate = {
  id: number;
  headline: string;
  excerpt?: string | null;
};

export type TypeSafeNewsJudgment = {
  category: (typeof NEWS_CATEGORIES)[CategoryKey];
  duplicateArticleId: number | null;
  duplicateProbability: number | null;
  routeConfidence: number | null;
  evaluatedBy: "typesafe" | "deterministic";
};

const routeAnswerSchema = z.object({
  type: z.literal("choice"),
  choice: z.enum(Object.keys(NEWS_CATEGORIES) as [CategoryKey, ...CategoryKey[]]),
  confidence: z.number().min(0).max(1),
  probabilities: z.record(z.string(), z.number()),
});

const duplicateAnswerSchema = z.object({
  type: z.literal("noul"),
  noul: z.number().min(0).max(1),
});

function publicText(value: string | null | undefined, maxLength: number) {
  return String(value ?? "")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

/** A stable fallback keeps automatic publication working without fabricating a judgment. */
export function deterministicNewsCategory(headline: string, excerpt?: string | null): TypeSafeNewsJudgment["category"] {
  const text = `${headline} ${excerpt ?? ""}`;
  if (/央行|中央银行|日本銀行|日銀|政策金利|金融政策|利率决议|利率決議|monetary policy|central bank|interest rate decision/i.test(text)) return NEWS_CATEGORIES.central_bank_policy;
  if (/新能源|清洁能源|清潔能源|脱碳|脫碳|气候|氣候|碳排|储能|儲能|renewable|decarbon|climate|energy transition/i.test(text)) return NEWS_CATEGORIES.energy_transition;
  if (/研究报告|研究報告|白皮书|白皮書|展望报告|展望報告|working paper|research paper|outlook report/i.test(text)) return NEWS_CATEGORIES.institutional_research;
  if (/公司|企业|企業|股份|财报|財報|业绩|業績|股东|股東|收购|收購|merger|acquisition|earnings|shareholder/i.test(text)) return NEWS_CATEGORIES.company_specific;
  if (/市场|市場|经济|經濟|通胀|通脹|就业|就業|汇率|匯率|债券|債券|股票|market|econom|inflation|employment|currency|bond|equity/i.test(text)) return NEWS_CATEGORIES.market_economy;
  return NEWS_CATEGORIES.general_publication;
}

function fallback(input: { headline: string; excerpt?: string | null }): TypeSafeNewsJudgment {
  return {
    category: deterministicNewsCategory(input.headline, input.excerpt),
    duplicateArticleId: null,
    duplicateProbability: null,
    routeConfidence: null,
    evaluatedBy: "deterministic",
  };
}

function requestBody(input: { headline: string; excerpt?: string | null; candidates: TypeSafeNewsCandidate[] }) {
  const candidates = input.candidates.slice(0, MAX_DUPLICATE_CANDIDATES).map(candidate => ({
    headline: publicText(candidate.headline, 700),
    excerpt: publicText(candidate.excerpt, 900),
  }));
  const questions: Record<string, unknown> = {
    category: {
      type: "choice",
      instructions: "Which single professional financial-news category best describes `article`? Select only by the supplied title and excerpt. Do not infer facts that are absent.",
      criteria: {
        central_bank_policy: "Central-bank announcements, monetary-policy decisions, interest-rate policy, financial-stability notices, or official policy speeches.",
        company_specific: "A named company's operations, earnings, financing, governance, transactions, products, or securities.",
        energy_transition: "Energy markets, electricity, clean energy, climate finance, emissions, decarbonization, or energy transition.",
        market_economy: "Market movements, securities, foreign exchange, commodities, macroeconomic releases, inflation, employment, trade, or growth.",
        institutional_research: "An institution's research paper, analytical report, outlook, survey, or substantive commentary rather than a routine announcement.",
        general_publication: "A factual public announcement that does not clearly fit another option.",
      },
    },
  };
  for (const [index, candidate] of candidates.entries()) {
    questions[`duplicate_${index}`] = {
      type: "noul",
      instructions: {
        candidate,
        question: "Do `article` and `candidate` report the same underlying announcement or event, even if translated or paraphrased? Similar subject matter alone is not a duplicate.",
      },
      criteria: {
        true: "They are two versions of the same specific announcement or event.",
        false: "They concern different events, releases, dates, decisions, or developments.",
      },
    };
  }
  return {
    model: process.env.TYPESAFE_MODEL?.trim() || "jev-latest",
    state: {
      article: {
        headline: publicText(input.headline, 700),
        excerpt: publicText(input.excerpt, 1_200),
      },
    },
    questions,
  };
}

/**
 * TypeSafe supplies bounded semantic judgments; code owns routing and the
 * duplicate threshold. Only public title/excerpt text is sent. URLs, provider
 * names, credentials, internal ids, and ingestion metadata are excluded.
 */
export async function judgePublicNewsWithTypeSafe(input: {
  headline: string;
  excerpt?: string | null;
  candidates?: TypeSafeNewsCandidate[];
}): Promise<TypeSafeNewsJudgment> {
  const apiKey = process.env.TYPESAFE_API_KEY?.trim();
  if (!apiKey) return fallback(input);
  const candidateRows = (input.candidates ?? []).slice(0, MAX_DUPLICATE_CANDIDATES);
  const body = requestBody({ ...input, candidates: candidateRows });
  let response: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      response = await fetch(TYPESAFE_ENDPOINT, {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({ model: body.model, state: body.state, questions: body.questions }),
        signal: AbortSignal.timeout(8_000),
      });
      if (response.ok || !RETRYABLE_TYPESAFE_STATUS.has(response.status)) break;
    } catch {
      response = null;
    }
    if (attempt < 2) await wait(250 * 2 ** attempt);
  }
  if (!response?.ok) return fallback(input);
  try {
    const payload = await response.json() as { answers?: Record<string, unknown> };
    const route = routeAnswerSchema.safeParse(payload.answers?.category);
    if (!route.success) return fallback(input);
    let duplicateArticleId: number | null = null;
    let duplicateProbability: number | null = null;
    for (const [index, candidate] of candidateRows.entries()) {
      const answer = duplicateAnswerSchema.safeParse(payload.answers?.[`duplicate_${index}`]);
      if (!answer.success) continue;
      if (duplicateProbability === null || answer.data.noul > duplicateProbability) {
        duplicateProbability = answer.data.noul;
        duplicateArticleId = answer.data.noul >= DUPLICATE_THRESHOLD ? candidate.id : null;
      }
    }
    return {
      category: NEWS_CATEGORIES[route.data.choice],
      duplicateArticleId,
      duplicateProbability,
      routeConfidence: route.data.confidence,
      evaluatedBy: "typesafe",
    };
  } catch {
    return fallback(input);
  }
}

export const TYPESAFE_NEWS_DUPLICATE_THRESHOLD = DUPLICATE_THRESHOLD;
