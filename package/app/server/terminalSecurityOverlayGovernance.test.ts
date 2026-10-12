import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const overlaySource = readFileSync(resolve(process.cwd(), 'client/src/components/TerminalSecurityOverlay.tsx'), 'utf8');

describe('终端安全覆盖层匿名会话治理', () => {
  it('只在已登录终端表面读取和轮询受保护的水印配置', () => {
    expect(overlaySource).toContain('enabled: auth.isAuthenticated && isTerminalSurface');
    expect(overlaySource).toContain('refetchInterval: auth.isAuthenticated && isTerminalSurface ? 60_000 : false');
  });

  it('继续保留已登录终端的复制与剪切最小化审计边界', () => {
    expect(overlaySource).toContain('if (!auth.isAuthenticated || !isTerminalSurface) return;');
    expect(overlaySource).toContain("mutation.mutate({ eventType, routePath: location })");
    expect(overlaySource).toContain("document.addEventListener('copy', blockCopy)");
    expect(overlaySource).toContain("document.addEventListener('cut', blockCut)");
  });

  it('不在终端边缘渲染用户、会话或当前 UTC 时间水印', () => {
    expect(overlaySource).not.toContain('data-terminal-security-watermark');
    expect(overlaySource).not.toContain('watermarkPositions');
    expect(overlaySource).not.toContain('sessionStartedAt');
    expect(overlaySource).not.toContain('currentAt');
    expect(overlaySource).not.toContain(' UTC');
    expect(overlaySource).toContain('return null;');
  });
});
