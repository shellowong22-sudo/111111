/**
 * Market WebSocket 服务
 * 仅提供数据库快照。该旧入口不生成或广播合成 tick。
 */
import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { getAllMarketData } from './db';

export interface MarketTickMessage {
  type: 'MARKET_TICK' | 'MARKET_SNAPSHOT' | 'HEARTBEAT';
  payload: MarketTick[] | HeartbeatPayload;
  ts: number;
}

export interface MarketTick {
  symbol: string;
  price: number;
  changeVal: number;
  changePct: number;
  volume: number;
  tickDir: 'up' | 'down' | 'neutral';
  market: string;
}

interface HeartbeatPayload {
  count: number;
  uptime: number;
}

interface PriceState {
  symbol: string;
  price: number;
  basePrice: number;
  changeVal: number;
  changePct: number;
  volume: number;
  market: string;
}

// 全局价格状态
const priceState = new Map<string, PriceState>();
let startTime = Date.now();

/** 初始化价格状态（从数据库加载） */
async function initPriceState() {
  try {
    const data = await getAllMarketData();
    for (const item of data) {
      const basePrice = parseFloat(item.price as string) || 100;
      priceState.set(item.symbol, {
        symbol: item.symbol,
        price: basePrice,
        basePrice,
        changeVal: parseFloat(item.changeVal as string) || 0,
        changePct: parseFloat(item.changePct as string) || 0,
        volume: parseInt(item.volume as string) || 0,
        market: item.market,
      });
    }
    console.log(`[MARKET-WS] Initialized ${priceState.size} symbols`);
  } catch (e) {
    console.error('[MARKET-WS] Failed to init price state:', e);
  }
}

function broadcast(wss: WebSocketServer, msg: MarketTickMessage) {
  const data = JSON.stringify(msg);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

export function registerMarketWebSocket(server: Server) {
  const wss = new WebSocketServer({ noServer: true });
  server.on('upgrade', (req, socket, head) => {
    if ((req.url ?? '').split('?')[0] !== '/ws/market') return;
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });
  startTime = Date.now();

  // 初始化价格状态
  initPriceState();

  // 每 30 秒心跳
  const heartbeatTimer = setInterval(() => {
    if (wss.clients.size === 0) return;
    broadcast(wss, {
      type: 'HEARTBEAT',
      payload: {
        count: wss.clients.size,
        uptime: Math.floor((Date.now() - startTime) / 1000),
      },
      ts: Date.now(),
    });
  }, 30000);

  wss.on('connection', (ws) => {
    // 新连接时发送当前快照
    if (priceState.size > 0) {
      const snapshot: MarketTick[] = Array.from(priceState.values()).map(s => ({
        symbol: s.symbol,
        price: s.price,
        changeVal: s.changeVal,
        changePct: s.changePct,
        volume: s.volume,
        tickDir: 'neutral' as const,
        market: s.market,
      }));
      ws.send(JSON.stringify({
        type: 'MARKET_SNAPSHOT',
        payload: snapshot,
        ts: Date.now(),
      }));
    }

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        // 支持客户端发送 PING
        if (msg.type === 'PING') {
          ws.send(JSON.stringify({ type: 'PONG', ts: Date.now() }));
        }
      } catch { /* ignore */ }
    });

    ws.on('error', () => { /* ignore */ });
  });

  wss.on('close', () => {
    clearInterval(heartbeatTimer);
  });

  console.log('[MARKET-WS] WebSocket server registered at /ws/market');
}
