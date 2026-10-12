import { writeFile, mkdir } from "node:fs/promises";
import WebSocket from "ws";

const browserEndpoint = "http://127.0.0.1:9222/json";
const outputFile = "/home/ubuntu/finance-hub-recovery/audit/runtime/cdp-module-network-diagnosis.json";
const previewMarker = "3000-i120kvwn9efdscaj74gxl-6605cb8c.us3.manus.computer";

const targets = await fetch(browserEndpoint).then((response) => response.json());
const target = targets.find((item) => item.type === "page" && item.url.includes(previewMarker));
if (!target?.webSocketDebuggerUrl) {
  throw new Error("No active preview page target found in the local browser debugging session.");
}

const ws = new WebSocket(target.webSocketDebuggerUrl);
const events = [];
let nextId = 1;
const pending = new Map();

function send(method, params = {}) {
  const id = nextId++;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error(`CDP command timed out: ${method}`));
      }
    }, 10_000);
  });
}

await new Promise((resolve, reject) => {
  ws.once("open", resolve);
  ws.once("error", reject);
});

ws.on("message", (raw) => {
  const message = JSON.parse(String(raw));
  if (message.id && pending.has(message.id)) {
    const handler = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) handler.reject(new Error(message.error.message));
    else handler.resolve(message.result);
    return;
  }

  if (["Network.loadingFailed", "Network.responseReceived", "Runtime.exceptionThrown", "Runtime.consoleAPICalled", "Page.loadEventFired"].includes(message.method)) {
    events.push(message);
  }
});

await send("Network.enable");
await send("Runtime.enable");
await send("Page.enable");
ws.send(JSON.stringify({ id: nextId++, method: "Page.reload", params: { ignoreCache: true } }));
await new Promise((resolve) => setTimeout(resolve, 45_000));

const moduleResponses = events
  .filter((event) => event.method === "Network.responseReceived")
  .map((event) => event.params.response)
  .filter((response) => /\/(src|@fs)\//.test(response.url) || /javascript|typescript/.test(response.mimeType || ""));
const moduleFailures = events.filter((event) => event.method === "Network.loadingFailed");
const exceptions = events.filter((event) => event.method === "Runtime.exceptionThrown");
const consoleErrors = events.filter((event) => event.method === "Runtime.consoleAPICalled" && event.params.type === "error");
const nonJsResponses = moduleResponses.filter((response) => response.status >= 400 || !/javascript|typescript/.test(response.mimeType || ""));

await mkdir("/home/ubuntu/finance-hub-recovery/audit/runtime", { recursive: true });
await writeFile(outputFile, JSON.stringify({
  targetUrl: target.url,
  capturedAt: new Date().toISOString(),
  moduleResponseCount: moduleResponses.length,
  moduleFailures,
  exceptions,
  consoleErrors,
  nonJsResponses,
  sampleModuleResponses: moduleResponses.slice(0, 60),
}, null, 2));

console.log(JSON.stringify({
  moduleResponseCount: moduleResponses.length,
  moduleFailures: moduleFailures.length,
  exceptions: exceptions.length,
  consoleErrors: consoleErrors.length,
  nonJsResponses: nonJsResponses.length,
  outputFile,
}, null, 2));
ws.close();
