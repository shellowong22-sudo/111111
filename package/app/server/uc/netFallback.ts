/**
 * 全站出网兜底：让终端里所有“直接 fetch 公开数据”的旧接口在本机网络下也能拿到数据。
 *
 *  1. 规范化：Yahoo query2 → query1、补浏览器 UA；港股 5 位代码转 4 位；纳斯达克接口补浏览器请求头
 *  2. Node 直连失败（fetch failed / 连接被重置）时，自动改用系统 curl 重试（Windows 自带 curl.exe），
 *     并记住这个主机 30 分钟内直接走 curl，不再白等超时
 *  3. 本机完全连不上的公开 CSV（如 FRED）：经公开网页读取服务转取，结果缓存 6 小时
 *  4. 同一 URL 的公开 GET 请求合并、短缓存，避免几十个面板同时打同一个上游
 *
 * 只作用于无请求体的 GET；带凭证或 POST 的请求原样直连。
 */
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const realFetch: typeof fetch = globalThis.fetch.bind(globalThis);
const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const CURL = process.platform === "win32" ? "curl.exe" : "curl";

type HostMode = { mode: "curl" | "dead"; until: number };
const hostMode = new Map<string, HostMode>();
const shortCache = new Map<string, { at: number; ttl: number; status: number; headers: [string, string][]; body: Buffer }>();
const inflight = new Map<string, Promise<{ status: number; headers: [string, string][]; body: Buffer }>>();
export const netStats = { direct: 0, curl: 0, mirror: 0, cached: 0, failed: 0 };

const TTL_RULES: Array<[RegExp, number]> = [
  [/fred\.stlouisfed\.org|alfred\.stlouisfed\.org/, 6 * 3600e3],
  [/api\.worldbank\.org|data-api\.ecb\.europa\.eu|api\.bls\.gov|fiscaldata\.treasury\.gov|home\.treasury\.gov|federalreserve\.gov|data\.sec\.gov/, 30 * 60e3],
  [/news\.google\.com|feeds\.finance\.yahoo\.com|rss\./, 3 * 60e3],
  [/api\.nasdaq\.com/, 60e3],
];
const ttlFor = (url: string) => TTL_RULES.find(([re]) => re.test(url))?.[1] ?? 0;

function rewrite(url: URL, headers: Headers) {
  if (url.hostname === "query2.finance.yahoo.com") url.hostname = "query1.finance.yahoo.com";
  if (url.hostname.endsWith("finance.yahoo.com")) {
    const ua = headers.get("user-agent") ?? "";
    if (!/Mozilla\/5\.0 \((Windows|Macintosh|X11)/.test(ua)) headers.set("user-agent", BROWSER_UA);
    // 港股 00700.HK → 0700.HK
    url.pathname = url.pathname.replace(/\/(0\d{4})\.HK\b/i, (_, c: string) => `/${c.slice(1)}.HK`);
  }
  if (url.hostname === "api.nasdaq.com") {
    headers.set("user-agent", BROWSER_UA);
    if (!headers.has("accept")) headers.set("accept", "application/json, text/plain, */*");
    headers.set("accept-language", "en-US,en;q=0.9");
    headers.set("origin", "https://www.nasdaq.com");
    headers.set("referer", "https://www.nasdaq.com/");
  }
  if (url.hostname === "data.sec.gov" || url.hostname === "www.sec.gov") {
    if (!/@/.test(headers.get("user-agent") ?? "")) headers.set("user-agent", "Ucheer Terminal research@ucheer.local");
  }
  if (!headers.has("user-agent")) headers.set("user-agent", BROWSER_UA);
}

async function viaCurl(url: string, headers: Headers, timeoutSec = 25) {
  const dir = await mkdtemp(path.join(tmpdir(), "uc-net-"));
  const out = path.join(dir, "body");
  const args = ["-s", "-L", "--compressed", "-m", String(timeoutSec), "-o", out, "-w", "%{http_code}|%{content_type}"];
  headers.forEach((v, k) => {
    if (k !== "accept-encoding" && k !== "connection" && k !== "host") args.push("-H", `${k}: ${v}`);
  });
  args.push(url);
  try {
    const meta = await new Promise<string>((resolve, reject) => {
      execFile(CURL, args, { windowsHide: true, timeout: (timeoutSec + 5) * 1000, maxBuffer: 1024 * 1024 }, (error, stdout) => {
        if (error && !stdout) reject(error);
        else resolve(String(stdout));
      });
    });
    const [code, type] = meta.split("|");
    const status = Number(code);
    if (!status) throw new Error("curl 无响应");
    const body = await readFile(out).catch(() => Buffer.alloc(0));
    return { status, headers: [["content-type", type || "application/octet-stream"]] as [string, string][], body };
  } finally {
    void rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/** FRED 等本机连不上的公开 CSV：经公开网页读取服务转取，只取出 CSV 正文 */
async function fredSeriesViaReader(id: string): Promise<Map<string, string>> {
  // FRED 的纯文本数据页（text/plain）可以经网页读取服务转取
  const res = await realFetch(`https://r.jina.ai/https://fred.stlouisfed.org/data/${encodeURIComponent(id)}.txt`, { headers: { "X-Return-Format": "text", "User-Agent": BROWSER_UA }, signal: AbortSignal.timeout(40_000) });
  if (!res.ok) throw new Error(`mirror HTTP ${res.status}`);
  const text = await res.text();
  const out = new Map<string, string>();
  for (const m of text.matchAll(/^(\d{4}-\d{2}-\d{2})\s+(-?[\d.]+|\.)\s*$/gm)) out.set(m[1], m[2] === "." ? "" : m[2]);
  if (out.size < 2) throw new Error("mirror 没有返回数据行");
  return out;
}

async function viaMirror(url: string) {
  const u = new URL(url);
  const ids = (u.searchParams.get("id") ?? "").split(",").map((x) => x.trim()).filter(Boolean).slice(0, 6);
  if (!ids.length) throw new Error("缺少序列代码");
  const cosd = u.searchParams.get("cosd");
  const series = await Promise.all(ids.map((id) => fredSeriesViaReader(id)));
  const dates = [...new Set(series.flatMap((m) => [...m.keys()]))].filter((d) => !cosd || d >= cosd).sort();
  const lines = [`observation_date,${ids.join(",")}`, ...dates.map((d) => [d, ...series.map((m) => m.get(d) ?? "")].join(","))];
  return { status: 200, headers: [["content-type", "text/csv"]] as [string, string][], body: Buffer.from(lines.join("\n") + "\n", "utf8") };
}
const MIRRORABLE = /^https:\/\/(fred|alfred)\.stlouisfed\.org\/graph\/(fred|alfred)graph\.csv/;

const isNetworkError = (e: unknown) => {
  const err = e as { name?: string; message?: string; cause?: { code?: string } };
  return err?.name === "TypeError" || /fetch failed|ECONNRESET|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|UND_ERR|socket|TLS|certificate/i.test(`${err?.message ?? ""} ${err?.cause?.code ?? ""}`) || err?.name === "TimeoutError";
};

async function resolveGet(url: string, headers: Headers) {
  const host = new URL(url).hostname;
  const state = hostMode.get(host);
  const mirrorable = MIRRORABLE.test(url);
  if (state && state.until > Date.now()) {
    if (state.mode === "dead") {
      if (mirrorable) return { ...(await viaMirror(url)), via: "mirror" as const };
      throw new TypeError(`fetch failed（${host} 本机网络不可达，稍后自动重试）`);
    }
    try {
      return { ...(await viaCurl(url, headers)), via: "curl" as const };
    } catch (error) {
      if (mirrorable) return { ...(await viaMirror(url)), via: "mirror" as const };
      throw error;
    }
  }
  try {
    const res = await realFetch(url, { headers, signal: AbortSignal.timeout(20_000), redirect: "follow" });
    const body = Buffer.from(await res.arrayBuffer());
    return { status: res.status, headers: [...res.headers.entries()] as [string, string][], body, via: "direct" as const };
  } catch (error) {
    if (!isNetworkError(error)) throw error;
    // 直连失败：curl 重试
    try {
      const r = await viaCurl(url, headers, 20);
      hostMode.set(host, { mode: "curl", until: Date.now() + 30 * 60e3 });
      return { ...r, via: "curl" as const };
    } catch {
      hostMode.set(host, { mode: "dead", until: Date.now() + 10 * 60e3 });
      if (mirrorable) return { ...(await viaMirror(url)), via: "mirror" as const };
      throw error;
    }
  }
}

function toResponse(r: { status: number; headers: [string, string][]; body: Buffer }, url: string) {
  const headers = new Headers(r.headers.filter(([k]) => !/^(content-encoding|content-length|transfer-encoding)$/i.test(k)));
  const res = new Response(r.status === 204 || r.status === 304 ? null : new Uint8Array(r.body), { status: r.status, headers });
  Object.defineProperty(res, "url", { value: url });
  return res;
}

let installed = false;
export function installNetFallback() {
  if (installed || typeof globalThis.fetch !== "function") return;
  installed = true;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    const rawUrl = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (method !== "GET" || init?.body || !/^https?:\/\//i.test(rawUrl) || /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])/i.test(rawUrl)) {
      return realFetch(input as RequestInfo, init);
    }
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    if (headers.has("authorization") || headers.has("cookie")) return realFetch(input as RequestInfo, init);
    const url = new URL(rawUrl);
    rewrite(url, headers);
    const href = url.href;
    const ttl = ttlFor(href);
    const hit = shortCache.get(href);
    if (hit && Date.now() - hit.at < hit.ttl) {
      netStats.cached += 1;
      return toResponse(hit, href);
    }
    let job = inflight.get(href);
    if (!job) {
      job = resolveGet(href, headers).then((r) => {
        netStats[r.via] += 1;
        if (ttl && r.status >= 200 && r.status < 300) {
          shortCache.set(href, { at: Date.now(), ttl, ...r });
          if (shortCache.size > 800) shortCache.delete(shortCache.keys().next().value!);
        }
        return r;
      }).catch((error) => {
        netStats.failed += 1;
        if (hit) return hit; // 上游失败时用过期缓存顶上
        throw error;
      }).finally(() => inflight.delete(href));
      inflight.set(href, job);
    }
    const signal = init?.signal ?? (input instanceof Request ? input.signal : null);
    if (!signal) return toResponse(await job, href);
    if (signal.aborted) throw signal.reason ?? new DOMException("Aborted", "AbortError");
    return toResponse(await new Promise<Awaited<typeof job>>((resolve, reject) => {
      const onAbort = () => reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
      signal.addEventListener("abort", onAbort, { once: true });
      job!.then(resolve, reject).finally(() => signal.removeEventListener("abort", onAbort));
    }), href);
  }) as typeof fetch;
}

export function netHealth() {
  return {
    stats: { ...netStats },
    hosts: [...hostMode.entries()].filter(([, v]) => v.until > Date.now()).map(([host, v]) => ({ host, mode: v.mode, until: v.until })),
  };
}

installNetFallback();
