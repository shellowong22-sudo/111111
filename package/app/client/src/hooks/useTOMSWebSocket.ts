/**
 * useTOMSWebSocket
 * 连接 /ws/toms，管理卖方债券委托实时状态、RFQ、做市商报价、风险预警。
 * 支持桌面通知（Notification API）和应用内 toast。
 * 与 AIM 买方联动：可发送 AIM_BUY_ORDER 触发 TOMS 自动生成对应卖单。
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { toast } from 'sonner';

export type BondOrderStatus = 'PENDING' | 'PARTIAL' | 'FILLED' | 'CANCELLED' | 'REJECTED';
export type RFQStatus = 'OPEN' | 'QUOTED' | 'TRADED' | 'EXPIRED';

export interface BondOrder {
  id: string;
  isin: string;
  issuer: string;
  coupon: number;
  maturity: string;
  side: 'BUY' | 'SELL';
  faceValue: number;
  filled: number;
  price: number;
  yieldToMaturity: number;
  spread: number;
  status: BondOrderStatus;
  algo: string;
  trader: string;
  account: string;
  time: string;
  pnl: number;
  dv01: number;
  duration: number;
  rating: string;
  venue: 'VOICE' | 'ELECTRONIC' | 'RFQ' | 'DARK';
  updatedAt: number;
  _isNew?: boolean;
  timeline: { status: BondOrderStatus; ts: number; note: string }[];
}

export interface RFQRequest {
  id: string;
  isin: string;
  issuer: string;
  side: 'BUY' | 'SELL';
  faceValue: number;
  status: RFQStatus;
  bidPrice?: number;
  askPrice?: number;
  bidYield?: number;
  askYield?: number;
  dealers: string[];
  bestDealer?: string;
  createdAt: number;
  expiresAt: number;
}

export interface MarketMakerQuote {
  isin: string;
  issuer: string;
  bidPrice: number;
  askPrice: number;
  bidYield: number;
  askYield: number;
  spread: number;
  size: number;
  dealer: string;
  ts: number;
}

export interface TOMSRiskAlert {
  level: 'INFO' | 'WARNING' | 'CRITICAL';
  type: 'DURATION' | 'CONCENTRATION' | 'CREDIT' | 'LIQUIDITY' | 'LIMIT';
  message: string;
  value: number;
  limit: number;
  ts: number;
}

export type ConnectionStatus = 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR';

interface UseTOMSWebSocketReturn {
  orders: BondOrder[];
  rfqList: RFQRequest[];
  quotes: MarketMakerQuote[];
  riskAlerts: TOMSRiskAlert[];
  connectionStatus: ConnectionStatus;
  latencyMs: number;
  lastMessageAt: number | null;
  reconnectCount: number;
  notificationPermission: NotificationPermission;
  requestNotificationPermission: () => void;
  cancelOrder: (orderId: string) => void;
  submitOrder: (params: {
    isin: string; issuer: string; side: 'BUY' | 'SELL';
    faceValue: number; price: number;
  }) => void;
  sendAIMLinkOrder: (aimOrderId: string) => void;
}

export function useTOMSWebSocket(): UseTOMSWebSocketReturn {
  const [orders, setOrders] = useState<BondOrder[]>([]);
  const [rfqList, setRFQList] = useState<RFQRequest[]>([]);
  const [quotes, setQuotes] = useState<MarketMakerQuote[]>([]);
  const [riskAlerts, setRiskAlerts] = useState<TOMSRiskAlert[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('CONNECTING');
  const [latencyMs, setLatencyMs] = useState(0);
  const [lastMessageAt, setLastMessageAt] = useState<number | null>(null);
  const [reconnectCount, setReconnectCount] = useState(0);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pingTs = useRef<number>(0);

  const showDesktopNotification = useCallback((title: string, body: string, icon?: string) => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        const n = new Notification(title, {
          body,
          icon: icon || '/favicon.ico',
          tag: `toms-${Date.now()}`,
          requireInteraction: false,
        });
        setTimeout(() => n.close(), 6000);
      } catch (e) { /* ignore */ }
    }
  }, []);

  const requestNotificationPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') return;
    const perm = await Notification.requestPermission();
    setNotificationPermission(perm);
    if (perm === 'granted') {
      toast.success('桌面通知已开启', { description: '债券委托状态变更将实时推送到桌面' });
    }
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/toms`);
    wsRef.current = ws;
    setConnectionStatus('CONNECTING');

    ws.onopen = () => {
      setConnectionStatus('CONNECTED');
      // 心跳延迟检测
      pingTimer.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          pingTs.current = Date.now();
          ws.send(JSON.stringify({ type: 'PING' }));
        }
      }, 10000);
    };

    ws.onmessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data as string);
        if (typeof msg.ts === 'number') {
          const receivedAt = Date.now();
          setLastMessageAt(receivedAt);
          setLatencyMs(Math.max(0, receivedAt - msg.ts));
        }

        if (msg.type === 'PONG') {
          setLatencyMs(Date.now() - pingTs.current);
          return;
        }

        if (msg.type === 'INIT') {
          setOrders(msg.data.orders || []);
          setRFQList(msg.data.rfqList || []);
          setQuotes(msg.data.quotes || []);
          return;
        }

        if (msg.type === 'ORDER_UPDATE') {
          const updated: BondOrder = msg.data;
          setOrders(prev => prev.map(o => o.id === updated.id ? updated : o));

          const statusLabels: Record<BondOrderStatus, string> = {
            PENDING: '待成交', PARTIAL: '部分成交', FILLED: '全部成交',
            CANCELLED: '已撤单', REJECTED: '已拒绝',
          };
          const label = statusLabels[updated.status] || updated.status;

          if (updated.status === 'FILLED') {
            const pnlStr = updated.pnl >= 0 ? `+$${updated.pnl.toLocaleString()}` : `-$${Math.abs(updated.pnl).toLocaleString()}`;
            toast.success(`债券委托全成交 ${updated.issuer}`, {
              description: `${updated.side} ${(updated.faceValue / 1000000).toFixed(1)}M @ ${updated.price} | P&L ${pnlStr}`,
            });
            showDesktopNotification(
              `✅ TOMS 全成交 ${updated.issuer}`,
              `${updated.side} ${(updated.faceValue / 1000000).toFixed(1)}M @ ${updated.price} | P&L ${pnlStr}`
            );
          } else if (updated.status === 'PARTIAL') {
            toast.info(`债券委托部分成交 ${updated.issuer}`, {
              description: `已成交 ${(updated.filled / 1000000).toFixed(1)}M / ${(updated.faceValue / 1000000).toFixed(1)}M`,
            });
            showDesktopNotification(
              `⚡ TOMS 部分成交 ${updated.issuer}`,
              `已成交 ${(updated.filled / 1000000).toFixed(1)}M / ${(updated.faceValue / 1000000).toFixed(1)}M`
            );
          } else if (updated.status === 'CANCELLED') {
            toast.warning(`债券委托已撤单 ${updated.issuer}`, {
              description: `${updated.side} ${(updated.faceValue / 1000000).toFixed(1)}M @ ${updated.price}`,
            });
            showDesktopNotification(
              `🚫 TOMS 撤单 ${updated.issuer}`,
              `${updated.side} ${(updated.faceValue / 1000000).toFixed(1)}M @ ${updated.price}`
            );
          } else if (updated.status === 'REJECTED') {
            toast.error(`债券委托被拒绝 ${updated.issuer}`, {
              description: `${updated.side} ${(updated.faceValue / 1000000).toFixed(1)}M`,
            });
          }
          return;
        }

        if (msg.type === 'NEW_ORDER') {
          const newOrder: BondOrder = msg.data;
          setOrders(prev => [newOrder, ...prev].slice(0, 60));
          return;
        }

        if (msg.type === 'RFQ_UPDATE') {
          const rfq: RFQRequest = msg.data;
          setRFQList(prev => prev.map(r => r.id === rfq.id ? rfq : r));
          if (rfq.status === 'QUOTED') {
            toast.info(`RFQ 已报价 ${rfq.issuer}`, {
              description: `Bid ${rfq.bidPrice?.toFixed(4)} / Ask ${rfq.askPrice?.toFixed(4)} | 最优: ${rfq.bestDealer}`,
            });
          }
          return;
        }

        if (msg.type === 'NEW_RFQ') {
          const rfq: RFQRequest = msg.data;
          setRFQList(prev => [rfq, ...prev].slice(0, 30));
          return;
        }

        if (msg.type === 'QUOTE_UPDATE') {
          const quote: MarketMakerQuote = msg.data;
          setQuotes(prev => {
            const idx = prev.findIndex(q => q.isin === quote.isin);
            if (idx >= 0) { const next = [...prev]; next[idx] = quote; return next; }
            return [quote, ...prev].slice(0, 20);
          });
          return;
        }

        if (msg.type === 'RISK_ALERT') {
          const alert: TOMSRiskAlert = msg.data;
          setRiskAlerts(prev => [alert, ...prev].slice(0, 20));
          const icons = { INFO: 'ℹ️', WARNING: '⚠️', CRITICAL: '🚨' };
          if (alert.level === 'CRITICAL') {
            toast.error(`${icons[alert.level]} TOMS风险预警 [${alert.type}]`, { description: alert.message });
            showDesktopNotification(
              `🚨 TOMS 风险预警 [${alert.type}]`,
              alert.message
            );
          } else if (alert.level === 'WARNING') {
            toast.warning(`${icons[alert.level]} TOMS风险提示 [${alert.type}]`, { description: alert.message });
            showDesktopNotification(
              `⚠️ TOMS 风险提示 [${alert.type}]`,
              alert.message
            );
          } else {
            toast.info(`${icons[alert.level]} TOMS通知 [${alert.type}]`, { description: alert.message });
          }
          return;
        }

        if (msg.type === 'AIM_LINKED_ORDER') {
          const { linkedOrder, aimOrderId } = msg.data;
          setOrders(prev => [linkedOrder, ...prev].slice(0, 60));
          toast.info(`AIM联动：TOMS自动生成卖单`, {
            description: `对应AIM买单 ${aimOrderId} | ${linkedOrder.issuer} SELL ${(linkedOrder.faceValue / 1000000).toFixed(1)}M`,
          });
          return;
        }

      } catch (e) {
        console.error('[TOMS-WS] Message parse error:', e);
      }
    };

    ws.onclose = () => {
      setConnectionStatus('DISCONNECTED');
      setReconnectCount(prev => prev + 1);
      if (pingTimer.current) clearInterval(pingTimer.current);
      reconnectTimer.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      setConnectionStatus('ERROR');
    };
  }, [showDesktopNotification]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (pingTimer.current) clearInterval(pingTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const cancelOrder = useCallback((orderId: string) => {
    wsRef.current?.send(JSON.stringify({ type: 'CANCEL_ORDER', orderId }));
  }, []);

  const submitOrder = useCallback((params: {
    isin: string; issuer: string; side: 'BUY' | 'SELL';
    faceValue: number; price: number;
  }) => {
    wsRef.current?.send(JSON.stringify({ type: 'SUBMIT_ORDER', ...params }));
  }, []);

  const sendAIMLinkOrder = useCallback((aimOrderId: string) => {
    wsRef.current?.send(JSON.stringify({ type: 'AIM_BUY_ORDER', aimOrderId }));
  }, []);

  return {
    orders, rfqList, quotes, riskAlerts,
    connectionStatus, latencyMs, lastMessageAt, reconnectCount,
    notificationPermission,
    requestNotificationPermission,
    cancelOrder, submitOrder, sendAIMLinkOrder,
  };
}
