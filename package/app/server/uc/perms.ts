/**
 * 佑诚管理后台角色与权限（需求 4.6）。
 *
 * - 系统管理员默认拥有全部权限；在“权限管理”里给某人设置角色后，以设置为准。
 * - 非系统管理员只要被加入成员，也能进入数据工作台，能做什么由角色决定。
 * - 数据源可见范围：可以限定某个成员只能看到 / 操作指定的数据源。
 */
import { sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { parseJson, query } from "./store";

export const UC_PERMISSIONS = [
  { key: "manageSources", label: "管理数据源（新增 / 编辑 / 删除 / 运行）" },
  { key: "editRules", label: "配置清洗、去重、脱敏规则" },
  { key: "buildModules", label: "搭建与编辑模块" },
  { key: "publish", label: "推送到前端 / 下线 / 回滚" },
  { key: "review", label: "审核数据版本" },
  { key: "viewRaw", label: "查看脱敏前原值" },
  { key: "manageMembers", label: "管理成员与权限" },
] as const;
export type UcPermKey = (typeof UC_PERMISSIONS)[number]["key"];
export type UcPerms = Record<UcPermKey, boolean> & { sourceIds: number[] | "all" };

const ALL: Record<UcPermKey, boolean> = { manageSources: true, editRules: true, buildModules: true, publish: true, review: true, viewRaw: true, manageMembers: true };
const NONE: Record<UcPermKey, boolean> = { manageSources: false, editRules: false, buildModules: false, publish: false, review: false, viewRaw: false, manageMembers: false };

export const UC_ROLES = [
  { key: "admin", label: "管理员", perms: { ...ALL } },
  { key: "developer", label: "开发者", perms: { ...NONE, editRules: true, buildModules: true, publish: true } },
  { key: "source_admin", label: "数据源管理员", perms: { ...NONE, manageSources: true, editRules: true, review: true, viewRaw: true } },
  { key: "reviewer", label: "审核员", perms: { ...NONE, review: true, viewRaw: true } },
  { key: "viewer", label: "只读", perms: { ...NONE } },
] as const;
export type UcRoleKey = (typeof UC_ROLES)[number]["key"];

type Ctx = { user?: { id: number; role?: string | null; name?: string | null; email?: string | null } | null };

export async function permsFor(ctx: Ctx): Promise<{ role: UcRoleKey | "none"; perms: UcPerms }> {
  const user = ctx.user;
  if (!user) return { role: "none", perms: { ...NONE, sourceIds: [] } };
  let row: { uc_role: string; perms_json: string } | undefined;
  try {
    [row] = await query<{ uc_role: string; perms_json: string }>(sql`SELECT uc_role, perms_json FROM uc_members WHERE user_id = ${user.id}`);
  } catch {
    row = undefined;
  }
  if (!row) {
    if (user.role === "admin") return { role: "admin", perms: { ...ALL, sourceIds: "all" } };
    return { role: "none", perms: { ...NONE, sourceIds: [] } };
  }
  const role = (UC_ROLES.find((r) => r.key === row!.uc_role)?.key ?? "viewer") as UcRoleKey;
  const base = UC_ROLES.find((r) => r.key === role)!.perms;
  const custom = parseJson<Partial<Record<UcPermKey, boolean>> & { sourceIds?: number[] | "all" }>(row.perms_json, {});
  const merged = { ...base } as Record<UcPermKey, boolean>;
  for (const p of UC_PERMISSIONS) if (typeof custom[p.key] === "boolean") merged[p.key] = custom[p.key]!;
  return { role, perms: { ...merged, sourceIds: custom.sourceIds ?? "all" } };
}

export async function requirePerm(ctx: Ctx, key: UcPermKey) {
  const { perms } = await permsFor(ctx);
  if (!perms[key]) {
    const label = UC_PERMISSIONS.find((p) => p.key === key)?.label ?? key;
    throw new TRPCError({ code: "FORBIDDEN", message: `当前角色没有“${label}”的权限` });
  }
  return perms;
}

export function canSeeSource(perms: UcPerms, sourceId: number) {
  return perms.sourceIds === "all" || perms.sourceIds.includes(sourceId);
}

export async function requireSourceAccess(ctx: Ctx, sourceId: number) {
  const { perms } = await permsFor(ctx);
  if (!canSeeSource(perms, sourceId)) throw new TRPCError({ code: "FORBIDDEN", message: "没有该数据源的访问权限" });
  return perms;
}

export async function requireDatasetAccess(ctx: Ctx, datasetId: number) {
  const [d] = await query<{ source_id: number }>(sql`SELECT source_id FROM uc_datasets WHERE id = ${datasetId}`);
  if (!d) throw new TRPCError({ code: "NOT_FOUND", message: "数据集不存在" });
  return requireSourceAccess(ctx, d.source_id);
}
