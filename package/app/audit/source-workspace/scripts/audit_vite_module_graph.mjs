import { mkdir, writeFile } from "node:fs/promises";

const origin = process.env.AUDIT_ORIGIN ?? "http://127.0.0.1:3000";
const outputDir = "/home/ubuntu/finance-hub-recovery/audit/runtime";
const maxModules = Number(process.env.AUDIT_MAX_MODULES ?? 700);
const seed = `${origin}/src/main.tsx?audit_module_graph=1`;
const queue = [seed];
const seen = new Set();
const records = [];

const isAuditableModule = (url) => {
  const parsed = new URL(url);
  return parsed.origin === origin && (parsed.pathname.startsWith("/src/") || (parsed.pathname.startsWith("/@fs/home/ubuntu/finance-hub-recovery/") && !parsed.pathname.includes("/node_modules/.vite/deps/")));
};

const getImports = (source, baseUrl) => {
  const matches = source.matchAll(/(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g);
  const urls = [];
  for (const match of matches) {
    const specifier = match[1] ?? match[2];
    if (!specifier || !(specifier.startsWith("/") || specifier.startsWith("."))) continue;
    try {
      const resolved = new URL(specifier, baseUrl).href;
      if (isAuditableModule(resolved)) urls.push(resolved);
    } catch {
      // Ignore unresolvable source literals; they are reported only if Vite requests them.
    }
  }
  return urls;
};

while (queue.length > 0 && seen.size < maxModules) {
  const current = queue.shift();
  if (!current || seen.has(current)) continue;
  seen.add(current);

  try {
    const response = await fetch(current, { redirect: "manual" });
    const contentType = response.headers.get("content-type") ?? "";
    const body = await response.text();
    const record = {
      url: current,
      status: response.status,
      contentType,
      bytes: Buffer.byteLength(body),
      location: response.headers.get("location"),
      looksLikeHtml: /^\s*<!doctype html|^\s*<html/i.test(body),
    };
    records.push(record);
    if (response.ok && contentType.includes("javascript") && !record.looksLikeHtml) {
      queue.push(...getImports(body, current));
    }
  } catch (error) {
    records.push({ url: current, status: "fetch-error", contentType: "", bytes: 0, location: null, looksLikeHtml: false, error: String(error) });
  }
}

const failures = records.filter((record) => record.status !== 200 || !record.contentType.includes("javascript") || record.looksLikeHtml || record.error);
await mkdir(outputDir, { recursive: true });
await writeFile(`${outputDir}/vite-module-graph.json`, JSON.stringify({ origin, maxModules, scanned: records.length, queued: queue.length, failures, records }, null, 2));
await writeFile(`${outputDir}/vite-module-graph.tsv`, [
  "status\tcontent_type\tbytes\tlooks_like_html\turl",
  ...records.map((record) => [record.status, record.contentType, record.bytes, record.looksLikeHtml, record.url].join("\t")),
].join("\n") + "\n");
console.log(JSON.stringify({ scanned: records.length, queued: queue.length, failures }, null, 2));
