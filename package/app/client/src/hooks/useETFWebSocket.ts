import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';

export interface ETFQuote {
  id: string;
  name: string;
  nav: number;
  marketPrice: number;
  premium: number;
  bidPrice: number;
  askPrice: number;
  bidSize: number;
  askSize: number;
  volume: number;
  turnover: number;
  inflow: number;
  creationUnits: number;
  redemptionUnits: number;
  bestMM: string;
  mmSpread: number;
  ts: number;
  alert?: {
    level: 'CRITICAL' | 'WARNING' | 'INFO';
    message: string;
    threshold: number;
  };
}

export interface MMQuote {
  etfId: string;
  dealer: string;
  bidPrice: number;
  askPrice: number;
  bidSize: number;
  askSize: number;
  spread: number;
  ts: number;
}

export interface ETFAlert {
  etfId: string;
  level: 'CRITICAL' | 'WARNING' | 'INFO';
  message: string;
  threshold: number;
  premium: number;
  nav: number;
  marketPrice: number;
  ts: number;
}

type ConnectionStatus = 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR';

export function useETFWebSocket() {
  const [quotes, setQuotes] = useState<ETFQuote[]>([]);
  const [mmQuotes, setMmQuotes] = useState<MMQuote[]>([]);
  const [alerts, setAlerts] = useState<ETFAlert[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('CONNECTING');
  const [latencyMs, setLatencyMs] = useState(0);
  const [lastMessageAt, setLastMessageAt] = useState<number | null>(null);
  const [reconnectCount, setReconnectCount] = useState(0);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingTs = useRef<number>(0);

  useEffect(() => {
    if ('Notification' in window) setNotificationPermission(Notification.permission);
  }, []);

  const requestNotificationPermission = useCallback(async () => {
    if (!('Notification' in window)) { toast.error('浏览器不支持桌面通知'); return; }
    const perm = await Notification.requestPermission();
    setNotificationPermission(perm);
    if (perm === 'granted') toast.success('桌面通知已开启，ETF溢折价预警将实时推送');
    else toast.warning('未授权桌面通知，仅显示应用内提醒');
  }, []);

  const showDesktopAlert = useCallback((alert: ETFAlert) => {
    if (notificationPermission === 'granted') {
      new Notification(`ETF${alert.level === 'CRITICAL' ? '⚠️ 严重预警' : '⚡ 预警'}: ${alert.etfId}`, {
        body: alert.message,
        icon: '/favicon.ico',
        tag: `etf-alert-${alert.etfId}`,
      });
    }
    if (alert.level === 'CRITICAL') {
      toast.error(`🚨 ${alert.etfId} 严重溢折价预警`, { description: alert.message, duration: 8000 });
    } else {
      toast.warning(`⚡ ${alert.etfId} 溢折价预警`, { description: alert.message, duration: 5000 });
    }
  }, [notificationPermission]);

  const connect = useCallback(() => {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${window.location.host}/ws/etf`);
    wsRef.current = ws;
    setConnectionStatus('CONNECTING');

    ws.onopen = () => {
      setConnectionStatus('CONNECTED');
      pingTs.current = Date.now();
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (typeof msg.ts === 'number') {
          const receivedAt = Date.now();
          setLastMessageAt(receivedAt);
          setLatencyMs(Math.max(0, receivedAt - msg.ts));
        }
        if (msg.type === 'quotes') {
          setQuotes(msg.data);
        } else if (msg.type === 'mm_quotes') {
          setMmQuotes(msg.data);
        } else if (msg.type === 'alert') {
          const newAlerts: ETFAlert[] = msg.data;
          setAlerts(prev => {
            const existing = new Set(prev.map(a => `${a.etfId}-${a.ts}`));
            const fresh = newAlerts.filter(a => !existing.has(`${a.etfId}-${a.ts}`));
            fresh.forEach(a => showDesktopAlert(a));
            return [...fresh, ...prev].slice(0, 50);
          });
        } else if (msg.type === 'heartbeat') {
          pingTs.current = Date.now();
        }
      } catch {}
    };

    ws.onclose = () => {
      setConnectionStatus('DISCONNECTED');
      setReconnectCount(prev => prev + 1);
      reconnectTimer.current = setTimeout(connect, 3000);
    };
    ws.onerror = () => {
      setConnectionStatus('ERROR');
      ws.close();
    };
  }, [showDesktopAlert]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const sendCreateOrder = useCallback((etfId: string, units: number = 1) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'create_order', etfId, units }));
    }
  }, []);

  const sendRedeemOrder = useCallback((etfId: string, units: number = 1) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'redeem_order', etfId, units }));
    }
  }, []);

  return {
    quotes,
    mmQuotes,
    alerts,
    connectionStatus,
    latencyMs,
    lastMessageAt,
    reconnectCount,
    notificationPermission,
    requestNotificationPermission,
    sendCreateOrder,
    sendRedeemOrder,
  };
}
