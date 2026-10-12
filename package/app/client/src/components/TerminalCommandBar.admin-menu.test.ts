import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./TerminalCommandBar.tsx", import.meta.url), "utf8");

describe("TerminalCommandBar 管理员入口", () => {
  it("无论认证角色为何均显示原始管理后台菜单项", () => {
    expect(source).toContain("onClick={() => navigate('/admin')}");
    expect(source).toContain("管理后台");
    expect(source).not.toContain("{user?.role === 'admin' && (");
  });
});
