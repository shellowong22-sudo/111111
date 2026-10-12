/**
 * 预置数据源：把系统已有的数据接口一次性接入数据工作台，并推送到前端对应页面。
 *
 *  - 实时行情（板块报价 → 实时行情K线模块，每分钟入库一次，前端每 3 秒跳动）
 *  - 主要指数 / 商品 / 汇率日 K（K 线模块）
 *  - 17 个公开数据适配器（交易所、央行、交易委员会等）
 *  - 若干无需密钥的宏观数据脚本
 *
 * 每个预置项只安装一次（记录在操作日志里）；管理员删除后不会被自动装回，可在数据源页“补齐预置数据源”。
 * 安装在后台逐个进行，失败只记告警，不影响系统运行。
 */
import { sql } from "drizzle-orm";
import { audit, exec, query, raiseAlert } from "./store";
import { runSource } from "./pipeline";
import { createModuleForDataset } from "./modules";
import { ADAPTERS, type SourceConfig } from "./runners";

type Preset = { key: string; name: string; slot: string; interval: number; config: SourceConfig };

const market = (key: string, name: string, slot: string, board: string): Preset => ({
  key, name, slot, interval: 15, config: { kind: "market", mode: "quotes", board, symbols: [] },
});
const kline = (key: string, name: string, slot: string, symbol: string): Preset => ({
  key, name, slot, interval: 60, config: { kind: "market", mode: "kline", symbol, period: "1d", limit: 240 },
});
const script = (key: string, name: string, slot: string, scriptName: string, command: string, args: string[] = []): Preset => ({
  key, name, slot, interval: 1440, config: { kind: "script", script: scriptName, command, args, env: {} },
});

export const PRESETS: Preset[] = [
  market("mkt-global", "全球主要指数（实时）", "eq.index", "global"),
  market("mkt-cn", "A股核心行情（实时）", "eq.stocks", "cn"),
  market("mkt-hk", "港股核心行情（实时）", "eq.stocks", "hk"),
  market("mkt-us", "美股核心行情（实时）", "eq.stocks", "us"),
  market("mkt-eu", "欧股核心行情（实时）", "eq.stocks", "eu"),
  market("mkt-apac", "亚太核心行情（实时）", "eq.stocks", "apac"),
  market("mkt-futures", "全球期货（实时）", "eq.derivatives", "futures"),
  market("mkt-fx", "外汇与数字货币（实时）", "eq.fx", "fx"),
  market("mkt-commodity", "大宗商品（实时）", "eq.commodity", "commodity"),
  market("mkt-etf", "基金与 ETF（实时）", "eq.index", "etf"),
  market("mkt-board", "我的看板 · 全球市场（实时）", "tool.board", "global"),
  kline("k-sse", "上证指数 日K", "eq.index", "000001.SH"),
  kline("k-csi300", "沪深300 日K", "eq.index", "000300.SH"),
  kline("k-spx", "标普500 日K", "eq.index", "^GSPC"),
  kline("k-hsi", "恒生指数 日K", "eq.index", "^HSI"),
  kline("k-gold", "COMEX黄金 日K", "eq.commodity", "GC"),
  kline("k-wti", "WTI原油 日K", "eq.commodity", "CL"),
  kline("k-cnh", "美元/离岸人民币 日K", "eq.fx", "USDCNH"),
  kline("k-dxy", "美元指数 日K", "eq.fx", "DXY"),
  kline("k-zn", "美国10年期国债期货 日K", "fi.rates", "ZN"),
  ...ADAPTERS.map((a) => ({ key: `ad-${a.id}`, name: a.label, slot: a.slot, interval: 240, config: { kind: "adapter", adapter: a.id } as SourceConfig })),
  script("sc-fiscal-rates", "美国国债平均利率", "fi.rates", "fiscal_data", "avg-interest-rates"),
  script("sc-fiscal-debt", "美国国债总额", "macro.data", "fiscal_data", "debt-to-penny"),
];

let installing = false;

export async function installedPresetKeys(): Promise<Set<string>> {
  const rows = await query<{ target: string }>(sql`SELECT DISTINCT target FROM uc_audit WHERE action = '预置数据源'`);
  return new Set(rows.map((r) => r.target.replace(/^preset:/, "")));
}

/** 安装尚未安装过的预置数据源。force=true 时把已删除的也装回。 */
export async function installPresets(options: { force?: boolean; keys?: string[] } = {}) {
  if (installing) return { started: false, pending: 0 };
  installing = true;
  try {
    const done = await installedPresetKeys();
    const existingNames = new Set((await query<{ name: string }>(sql`SELECT name FROM uc_sources`)).map((r) => r.name));
    const todo = PRESETS.filter((p) => (!options.keys || options.keys.includes(p.key)) && (options.force ? !existingNames.has(p.name) : !done.has(p.key) && !existingNames.has(p.name)));
    void (async () => {
      for (const p of todo) {
        let sourceId = 0;
        try {
          const { insertId } = await exec(sql`INSERT INTO uc_sources (name, kind, config_json, slot_id, interval_minutes)
            VALUES (${p.name}, ${p.config.kind}, ${JSON.stringify(p.config)}, ${p.slot}, ${p.interval})`);
          sourceId = insertId;
          await audit({ name: "系统" }, "预置数据源", `preset:${p.key}`, `${p.name} → ${p.slot}`);
          const result = await runSource(sourceId, "manual");
          for (const d of result.datasets) await createModuleForDataset(d.datasetId, { slotId: p.slot, publish: true, name: p.name });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.warn(`[uc] 预置数据源「${p.name}」暂未接通：${message}`);
          if (sourceId) await raiseAlert("preset", `source:${sourceId}`, `预置数据源「${p.name}」首次运行未成功，将按计划自动重试：${message.slice(0, 300)}`, "info");
        }
      }
      installing = false;
    })();
    return { started: true, pending: todo.length };
  } catch (error) {
    installing = false;
    throw error;
  }
}

/** 定时运行成功但还没有模块的预置数据源：补建模块并推送（首次失败、之后成功的情况） */
export async function attachModulesForPresets() {
  const rows = await query<{ dataset_id: number; slot_id: string; name: string }>(sql`SELECT d.id AS dataset_id, s.slot_id, s.name FROM uc_datasets d
    JOIN uc_sources s ON s.id = d.source_id
    WHERE d.published_version > 0 AND NOT EXISTS (SELECT 1 FROM uc_modules m WHERE m.dataset_id = d.id)
      AND s.name IN (${sql.join(PRESETS.map((p) => sql`${p.name}`), sql`, `)})`);
  for (const r of rows) {
    try {
      await createModuleForDataset(r.dataset_id, { slotId: r.slot_id, publish: true, name: r.name });
    } catch {
      /* 下一轮再试 */
    }
  }
}
