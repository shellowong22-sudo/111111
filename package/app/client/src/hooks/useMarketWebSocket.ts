/**
 * useMarketWebSocket
 * 连接 /ws/market WebSocket，接收实时行情 tick 并维护价格状态 Map。
 * 支持连接状态检测、自动重连（指数退避）、心跳检测。
 */
import { useEffect, useRef, useState, useCallback } from 'react';

export interface MarketTick {
  symbol: string;
  price: number;
  changeVal: number;
  changePct: number;
  volume: number;
  tickDir: 'up' | 'down' | 'neutral';
  market: string;
}

export type WsStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface UseMarketWebSocketResult {
  /** symbol → 最新 tick 数据 */
  priceMap: Map<string, MarketTick>;
  /** WebSocket 连接状态 */
  status: WsStatus;
  /** 手动重连 */
  reconnect: () => void;
  /** 最近一条服务端消息到达时间 */
  lastMessageAt: number | null;
  /** 最近一条消息的端到端延迟（毫秒） */
  lastLatencyMs: number | null;
  /** 自动/手动重连次数 */
  reconnectCount: number;
}

const MAX_RECONNECT_DELAY = 30000;
const BASE_RECONNECT_DELAY = 1000;

function getWsUrl(): string {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws/market`;
}

export function useMarketWebSocket(): UseMarketWebSocketResult {
  const [priceMap, setPriceMap] = useState<Map<string, MarketTick>>(new Map());
  const [status, setStatus] = useState<WsStatus>('connecting');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectDelayRef = useRef(BASE_RECONNECT_DELAY);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectCountRef = useRef(0);
  const mountedRef = useRef(true);
  const [lastMessageAt, setLastMessageAt] = useState<number | null>(null);
  const [lastLatencyMs, setLastLatencyMs] = useState<number | null>(null);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

    setStatus('connecting');
    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      setStatus('connected');
      reconnectDelayRef.current = BASE_RECONNECT_DELAY;
    };

    ws.onmessage = (event) => {
      if (!mountedRef.current) return;
      try {
        const msg = JSON.parse(event.data);
        if (typeof msg.ts === 'number') {
          const receivedAt = Date.now();
          setLastMessageAt(receivedAt);
          setLastLatencyMs(Math.max(0, receivedAt - msg.ts));
        }
        if (msg.type === 'MARKET_TICK' || msg.type === 'MARKET_SNAPSHOT') {
          const ticks: MarketTick[] = msg.payload;
          setPriceMap(prev => {
            const next = new Map(prev);
            for (const tick of ticks) {
              next.set(tick.symbol, tick);
            }
            return next;
          });
        }
        // HEARTBEAT / PONG — 不需要处理
      } catch { /* ignore parse errors */ }
    };

    ws.onerror = () => {
      if (!mountedRef.current) return;
      setStatus('error');
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setStatus('disconnected');
      wsRef.current = null;
      // 指数退避重连
      const delay = Math.min(reconnectDelayRef.current, MAX_RECONNECT_DELAY);
      reconnectDelayRef.current = Math.min(delay * 2, MAX_RECONNECT_DELAY);
      reconnectCountRef.current += 1;
      reconnectTimerRef.current = setTimeout(() => {
        if (mountedRef.current) connect();
      }, delay);
    };
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null; // 防止触发重连
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  const reconnect = useCallback(() => {
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    reconnectDelayRef.current = BASE_RECONNECT_DELAY;
    connect();
  }, [connect]);

  return { priceMap, status, reconnect, lastMessageAt, lastLatencyMs, reconnectCount: reconnectCountRef.current };
}
