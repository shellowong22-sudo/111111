/**
 * useSSENotifications - SSE 实时通知推送 Hook
 * 建立到 /api/notifications/stream 的 SSE 连接，实时接收新通知和未读数更新
 */
import { useEffect, useRef, useCallback, useState } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

interface SSENotification {
  id: number;
  title: string;
  content: string;
  type: string;
}

interface SSEMessage {
  type: 'new_notification' | 'unread_count';
  notification?: SSENotification;
  count?: number;
}

export function useSSENotifications() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const esRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const disposedRef = useRef(false);
  const reconnectCountRef = useRef(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [connected, setConnected] = useState(false);
  const [lastEventAt, setLastEventAt] = useState<number | null>(null);
  const [reconnectCount, setReconnectCount] = useState(0);

  const connect = useCallback(() => {
    if (!user || disposedRef.current) return;
    // Close existing connection
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }

    const es = new EventSource('/api/notifications/stream', { withCredentials: true });
    esRef.current = es;

    es.onopen = () => {
      if (disposedRef.current || esRef.current !== es) return;
      reconnectCountRef.current = 0;
      setReconnectCount(0);
      setConnected(true);
    };

    es.onmessage = (event) => {
      try {
        const msg: SSEMessage = JSON.parse(event.data);
        setLastEventAt(Date.now());
        if (msg.type === 'unread_count' && typeof msg.count === 'number') {
          setUnreadCount(msg.count);
        } else if (msg.type === 'new_notification' && msg.notification) {
          // Update unread count
          setUnreadCount(prev => prev + 1);
          // Show toast notification
          const typeLabels: Record<string, string> = {
            announcement: '📢 公告',
            system: '⚙️ 系统',
            alert: '⚠️ 警告',
            info: 'ℹ️ 通知',
          };
          const label = typeLabels[msg.notification.type] || '通知';
          toast(msg.notification.title, {
            description: msg.notification.content.replace(/<[^>]*>/g, '').slice(0, 80),
            duration: 5000,
          });
          // Invalidate notification list cache
          utils.notification.list.invalidate();
        }
      } catch {
        // Ignore parse errors (e.g. keep-alive pings)
      }
    };

    es.onerror = () => {
      if (disposedRef.current || esRef.current !== es) return;
      setConnected(false);
      es.close();
      esRef.current = null;
      // Exponential backoff reconnect (max 60s)
      const delay = Math.min(1000 * Math.pow(2, reconnectCountRef.current), 60000);
      reconnectCountRef.current += 1;
      setReconnectCount(reconnectCountRef.current);
      reconnectTimerRef.current = setTimeout(connect, delay);
    };
  }, [user, utils]);

  useEffect(() => {
    if (user) {
      disposedRef.current = false;
      connect();
    }
    return () => {
      disposedRef.current = true;
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      setConnected(false);
    };
  }, [user, connect]);

  return { unreadCount, setUnreadCount, connected, lastEventAt, reconnectCount };
}
