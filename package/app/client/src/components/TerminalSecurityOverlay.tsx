import { useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';

const EVENT_COOLDOWN_MS = 30_000;
const warningEventByDeterrence = {
  copy_blocked: 'copy_warning_shown',
  cut_blocked: 'cut_warning_shown',
} as const;

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"], [data-security-allow-copy="true"]'));
}

export default function TerminalSecurityOverlay() {
  const auth = useAuth();
  const [location] = useLocation();
  const mutation = trpc.terminalSecurity.recordDeterrenceEvent.useMutation();
  const isTerminalSurface = !location.startsWith('/admin') && location !== '/secure-admin';
  trpc.terminalSecurity.watermarkConfig.useQuery(undefined, { enabled: auth.isAuthenticated && isTerminalSurface, staleTime: 30_000, refetchInterval: auth.isAuthenticated && isTerminalSurface ? 60_000 : false });
  const lastEventAt = useRef<Record<string, number>>({});
  const noticeShown = useRef<Record<string, boolean>>({});

  useEffect(() => {
    if (!auth.isAuthenticated || !isTerminalSurface) return;
    const report = (eventType: 'copy_blocked' | 'cut_blocked') => { const now = Date.now(); if (now - (lastEventAt.current[eventType] ?? 0) < EVENT_COOLDOWN_MS) return; lastEventAt.current[eventType] = now; mutation.mutate({ eventType, routePath: location }); if (!noticeShown.current[eventType]) { noticeShown.current[eventType] = true; toast.warning(eventType === 'copy_blocked' ? '已阻止复制终端展示内容' : '已阻止剪切终端展示内容', { description: '为保护内部金融资料，本次操作已被限制并记入最小化安全事件。编辑输入框不受影响；此提示可关闭。', duration: 8_000, action: { label: '知道了', onClick: () => toast.dismiss() } }); mutation.mutate({ eventType: warningEventByDeterrence[eventType], routePath: location }); } };
    const blockCopy = (event: ClipboardEvent) => { if (isEditableTarget(event.target)) return; event.preventDefault(); report('copy_blocked'); };
    const blockCut = (event: ClipboardEvent) => { if (isEditableTarget(event.target)) return; event.preventDefault(); report('cut_blocked'); };
    document.addEventListener('copy', blockCopy); document.addEventListener('cut', blockCut);
    return () => { document.removeEventListener('copy', blockCopy); document.removeEventListener('cut', blockCut); };
  }, [auth.isAuthenticated, isTerminalSurface, location, mutation]);

  return null;
}
