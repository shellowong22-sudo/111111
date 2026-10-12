import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';

// 联动总览数据结构
export interface MatchedOrder {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  qty: number;
  price: number;
  aimOrderId: string;
  tomsOrderId: string;
  matchedAt: number;
  status: 'MATCHED' | 'SETTLED' | 'FAILED';
  venue: string;
  latencyMs: number;
}

export interface LiquidityLevel {
  price: number;
  bidQty: number;
  askQty: number;
}

export interface LinkStats {
  totalOrders: number;
  matchedOrders: number;
  matchRate: number;         // %
  avgLatencyMs: number;
  totalVolume: number;
  aimFillRate: number;       // AIM成交率 %
  tomsFillRate: number;      // TOMS成交率 %
  crossSpread: number;       // 买卖价差 bps
  ts: number;
}

const SYMBOLS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'META', 'JPM', 'GS', 'BAC'];
const VENUES = ['NYSE', 'NASDAQ', 'BATS', 'IEX', 'DARK'];

let matchedOrders: MatchedOrder[] = [];
let orderIdCounter = 1;

function genId() { return `LNK-${String(orderIdCounter++).padStart(6, '0')}`; }

function generateInitialOrders(): MatchedOrder[] {
  const orders: MatchedOrder[] = [];
  for (let i = 0; i < 20; i++) {
    const symbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
    const basePrice = 100 + Math.random() * 400;
    const status = Math.random() > 0.2 ? (Math.random() > 0.1 ? 'SETTLED' : 'MATCHED') : 'FAILED';
    orders.push({
      id: genId(),
      symbol,
      side: Math.random() > 0.5 ? 'BUY' : 'SELL',
      qty: Math.floor(Math.random() * 5000 + 500),
      price: parseFloat(basePrice.toFixed(2)),
      aimOrderId: `AIM-${Math.floor(Math.random() * 99999).toString().padStart(5, '0')}`,
      tomsOrderId: `TOMS-${Math.floor(Math.random() * 99999).toString().padStart(5, '0')}`,
      matchedAt: Date.now() - Math.floor(Math.random() * 3600000),
      status,
      venue: VENUES[Math.floor(Math.random() * VENUES.length)],
      latencyMs: Math.floor(Math.random() * 80 + 5),
    });
  }
  return orders;
}

matchedOrders = generateInitialOrders();

function computeStats(): LinkStats {
  const matched = matchedOrders.filter(o => o.status !== 'FAILED').length;
  const total = matchedOrders.length;
  const avgLatency = total > 0 ? matchedOrders.reduce((s, o) => s + o.latencyMs, 0) / total : 0;
  const totalVol = matchedOrders.filter(o => o.status !== 'FAILED').reduce((s, o) => s + o.qty * o.price, 0);
  return {
    totalOrders: total,
    matchedOrders: matched,
    matchRate: total > 0 ? parseFloat(((matched / total) * 100).toFixed(1)) : 0,
    avgLatencyMs: parseFloat(avgLatency.toFixed(1)),
    totalVolume: Math.floor(totalVol),
    aimFillRate: parseFloat((78 + Math.random() * 15).toFixed(1)),
    tomsFillRate: parseFloat((72 + Math.random() * 18).toFixed(1)),
    crossSpread: parseFloat((1.2 + Math.random() * 2).toFixed(2)),
    ts: Date.now(),
  };
}

function generateLiquidityDepth(symbol: string): LiquidityLevel[] {
  const base = 100 + Math.random() * 300;
  const levels: LiquidityLevel[] = [];
  for (let i = 5; i >= 1; i--) {
    levels.push({
      price: parseFloat((base - i * 0.05).toFixed(2)),
      bidQty: Math.floor(Math.random() * 50000 * i + 5000),
      askQty: 0,
    });
  }
  for (let i = 1; i <= 5; i++) {
    levels.push({
      price: parseFloat((base + i * 0.05).toFixed(2)),
      bidQty: 0,
      askQty: Math.floor(Math.random() * 50000 * (6 - i) + 5000),
    });
  }
  return levels;
}

function broadcast(clients: Set<WebSocket>, msg: any) {
  const payload = JSON.stringify(msg);
  clients.forEach(ws => { if (ws.readyState === WebSocket.OPEN) ws.send(payload); });
}

export function registerAIMTOMSLinkWebSocket(server: Server) {
  const wss = new WebSocketServer({ noServer: true });
  const clients = new Set<WebSocket>();

  server.on('upgrade', (req, socket, head) => {
    if ((req.url ?? '').split('?')[0] !== '/ws/aim-toms-link') return;
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });

  wss.on('connection', (ws) => {
    clients.add(ws);
    console.log('[LINK-WS] Client connected, total:', clients.size);

    // 初始快照
    ws.send(JSON.stringify({ type: 'orders', data: matchedOrders, ts: Date.now() }));
    ws.send(JSON.stringify({ type: 'stats', data: computeStats(), ts: Date.now() }));
    ws.send(JSON.stringify({ type: 'depth', data: { symbol: 'AAPL', levels: generateLiquidityDepth('AAPL') }, ts: Date.now() }));

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'get_depth') {
          ws.send(JSON.stringify({ type: 'depth', data: { symbol: msg.symbol, levels: generateLiquidityDepth(msg.symbol) }, ts: Date.now() }));
        }
      } catch {}
    });

    ws.on('close', () => { clients.delete(ws); });
    ws.on('error', () => clients.delete(ws));
  });

  // 每3秒新增匹配委托
  setInterval(() => {
    if (clients.size === 0) return;
    const symbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
    const basePrice = 100 + Math.random() * 400;
    const newOrder: MatchedOrder = {
      id: genId(),
      symbol,
      side: Math.random() > 0.5 ? 'BUY' : 'SELL',
      qty: Math.floor(Math.random() * 5000 + 500),
      price: parseFloat(basePrice.toFixed(2)),
      aimOrderId: `AIM-${Math.floor(Math.random() * 99999).toString().padStart(5, '0')}`,
      tomsOrderId: `TOMS-${Math.floor(Math.random() * 99999).toString().padStart(5, '0')}`,
      matchedAt: Date.now(),
      status: Math.random() > 0.15 ? 'MATCHED' : 'FAILED',
      venue: VENUES[Math.floor(Math.random() * VENUES.length)],
      latencyMs: Math.floor(Math.random() * 80 + 5),
    };
    matchedOrders.unshift(newOrder);
    if (matchedOrders.length > 200) matchedOrders = matchedOrders.slice(0, 200);
    broadcast(clients, { type: 'new_order', data: newOrder, ts: Date.now() });
    broadcast(clients, { type: 'stats', data: computeStats(), ts: Date.now() });
  }, 3000);

  // 每5秒更新流动性深度
  setInterval(() => {
    if (clients.size === 0) return;
    const symbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
    broadcast(clients, { type: 'depth', data: { symbol, levels: generateLiquidityDepth(symbol) }, ts: Date.now() });
  }, 5000);

  // 每10秒将部分MATCHED→SETTLED
  setInterval(() => {
    matchedOrders.forEach(o => {
      if (o.status === 'MATCHED' && Date.now() - o.matchedAt > 8000) {
        o.status = 'SETTLED';
      }
    });
  }, 10000);

  console.log('[LINK-WS] WebSocket server registered at /ws/aim-toms-link');
}
