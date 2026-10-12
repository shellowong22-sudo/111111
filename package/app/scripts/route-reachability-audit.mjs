import { readFile } from "node:fs/promises";

const baseUrl = process.env.AUDIT_BASE_URL ?? "http://127.0.0.1:3000";
const appSource = await readFile(new URL("../client/src/App.tsx", import.meta.url), "utf8");
const routePattern = /<Route\s+path=\{?["']([^"']+)["']/g;
const paths = [...appSource.matchAll(routePattern)]
  .map((match) => match[1])
  .map((path) => path.replace(/:[A-Za-z0-9_]+/g, "audit"))
  .filter((path, index, items) => items.indexOf(path) === index);

const results = await Promise.all(paths.map(async (path) => {
  const response = await fetch(new URL(path, baseUrl));
  return { path, status: response.status };
}));

const failures = results.filter((result) => result.status !== 200);
console.log(JSON.stringify({ baseUrl, checked: results.length, failures }, null, 2));
if (failures.length) process.exitCode = 1;
