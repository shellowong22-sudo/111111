import { ENV } from "./env";

export type DataApiCallOptions = {
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
  pathParams?: Record<string, unknown>;
  formData?: Record<string, unknown>;
  timeoutMs?: number;
};

type StandaloneEndpoint = {
  url: string;
  method?: "GET" | "POST";
  headers?: Record<string, string>;
};

function getStandaloneEndpoint(apiId: string): StandaloneEndpoint {
  let endpoints: Record<string, StandaloneEndpoint>;
  try {
    endpoints = JSON.parse(ENV.dataApiEndpointsJson) as Record<string, StandaloneEndpoint>;
  } catch {
    throw new Error("DATA_API_ENDPOINTS_JSON must be valid JSON");
  }
  const endpoint = endpoints[apiId];
  if (!endpoint?.url || !/^https:\/\//.test(endpoint.url)) {
    throw new Error(`Standalone data API endpoint not configured for ${apiId}`);
  }
  return endpoint;
}

function addQuery(url: URL, query?: Record<string, unknown>) {
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }
}

export async function callDataApi(
  apiId: string,
  options: DataApiCallOptions = {},
): Promise<unknown> {
  const endpoint = getStandaloneEndpoint(apiId);
  let target = endpoint.url;
  for (const [key, value] of Object.entries(options.pathParams ?? {})) {
    target = target.replace(`{${key}}`, encodeURIComponent(String(value)));
  }
  const url = new URL(target);
  addQuery(url, options.query);
  const method = endpoint.method ?? (options.body || options.formData ? "POST" : "GET");
  const headers: Record<string, string> = { accept: "application/json", ...endpoint.headers };
  if (ENV.dataApiApiKey) headers.authorization = `Bearer ${ENV.dataApiApiKey}`;
  let body: BodyInit | undefined;
  if (options.formData) {
    const form = new FormData();
    for (const [key, value] of Object.entries(options.formData)) form.append(key, String(value));
    body = form;
  } else if (options.body) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(options.body);
  }
  const response = await fetch(url, {
    method,
    headers,
    body,
    signal: AbortSignal.timeout(Math.min(30_000, Math.max(1_000, options.timeoutMs ?? 10_000))),
  });
  if (!response.ok) throw new Error(`Data API request failed (${response.status} ${response.statusText})`);
  const text = await response.text();
  try { return JSON.parse(text); } catch { return text; }
}
