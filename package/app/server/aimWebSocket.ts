/**
 * AIM买方OMS WebSocket服务
 * 委托状态机：PENDING → PARTIAL → FILLED / CANCELLED / REJECTED
 * 每2秒推进状态，每5秒可能新增委托，每30秒心跳
 */
import { WebSocketServer, WebSocket } from 'ws';
import { Server as HttpServer } from 'http';

export type OrderStatus = 'PENDING' | 'PARTIAL' | 'FILLED' | 'CANCELLED' | 'REJECTED';

export interface Order {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  qty: number;
  filled: number;
  price: number;
  avgPx: number;
  status: OrderStatus;
  algo: string;
  urgency: 'HIGH' | 'MED' | 'LOW';
  trader: string;
  account: string;
  time: string;
  pnl: number;
  slippage: number;
  venue: string;
  updatedAt: number;
  _isNew?: boolean;
}

export interface WsMessage {
  type: 'ORDER_UPDATE' | 'ORDER_SNAPSHOT' | 'EXECUTION_REPORT' | 'RISK_ALERT' | 'HEARTBEAT';
  payload: unknown;
  ts: number;
}

const SYMBOLS = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA', 'META', 'AMZN', 'JPM', 'V', 'BRK.B'];
const ALGOS = ['VWAP', 'TWAP', 'IS', 'POV', 'DMA', 'SNIPER'];
const TRADERS = ['Zhang Wei', 'Li Ming', 'Wang Fang', 'Chen Jie', 'Liu Yang'];
const ACCOUNTS = ['FUND-A', 'FUND-B', 'FUND-C', 'FUND-D', 'ARB-1'];
const VENUES = ['NASDAQ', 'NYSE', 'ARCA', 'BATS', 'IEX'];

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

function genId(): string {
  const d = new Date();
  const date = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
  return `ORD-${date}-${String(Math.floor(Math.random()*9000)+1000)}`;
}

function makeOrder(overrides: Partial<Order> = {}): Order {
  const price = +(Math.random() * 900 + 50).toFixed(2);
  const qty = Math.round((Math.random() * 50000 + 5000) / 100) * 100;
  const now = new Date();
  return {
    id: genId(),
    symbol: pick(SYMBOLS),
    side: Math.random() > 0.5 ? 'BUY' : 'SELL',
    qty, filled: 0, price, avgPx: 0,
    status: 'PENDING',
    algo: pick(ALGOS),
    urgency: pick(['HIGH', 'MED', 'LOW'] as const),
    trader: pick(TRADERS),
    account: pick(ACCOUNTS),
    time: `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`,
    pnl: 0, slippage: 0,
    venue: pick(VENUES),
    updatedAt: Date.now(),
    ...overrides,
  };
}

const orderBook = new Map<string, Order>();
for (let i = 0; i < 12; i++) { const o = makeOrder(); orderBook.set(o.id, o); }

function tickOrder(order: Order): Order | null {
  if (['FILLED','CANCELLED','REJECTED'].includes(order.status)) return null;
  const r = Math.random();
  if (order.status === 'PENDING') {
    if (r < 0.05) return { ...order, status: 'CANCELLED', updatedAt: Date.now() };
    if (r < 0.38) {
      const fillQty = Math.round(order.qty * (Math.random() * 0.4 + 0.1));
      const slippage = +(Math.random() * 0.4 - 0.2).toFixed(3);
      return { ...order, status: 'PARTIAL', filled: fillQty, avgPx: +(order.price*(1+slippage/100)).toFixed(2), slippage, pnl: Math.round(fillQty*Math.abs(slippage)*10), updatedAt: Date.now() };
    }
    return null;
  }
  if (order.status === 'PARTIAL') {
    if (r < 0.08) return { ...order, status: 'CANCELLED', updatedAt: Date.now() };
    if (r < 0.48) {
      const remaining = order.qty - order.filled;
      const add = Math.round(remaining * (Math.random() * 0.6 + 0.2));
      const newFilled = Math.min(order.filled + add, order.qty);
      const slippage = +(Math.random() * 0.4 - 0.2).toFixed(3);
      return { ...order, status: newFilled >= order.qty ? 'FILLED' : 'PARTIAL', filled: newFilled, avgPx: +(order.price*(1+slippage/100)).toFixed(2), slippage, pnl: Math.round(newFilled*Math.abs(slippage)*10), updatedAt: Date.now() };
    }
    return null;
  }
  return null;
}

let wss: WebSocketServer | null = null;

function broadcast(msg: WsMessage) {
  if (!wss) return;
  const data = JSON.stringify(msg);
  wss.clients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(data); });
}

export function registerAIMWebSocket(server: HttpServer, options: { simulation?: boolean } = {}) {
  const simulation = options.simulation === true;
  wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    if ((req.url ?? '').split('?')[0] !== '/ws/aim') return;
    wss!.handleUpgrade(req, socket, head, (ws) => wss!.emit('connection', ws, req));
  });

  wss.on('connection', (ws) => {
    console.log('[AIM-WS] Client connected, total:', wss!.clients.size);
    // 生产默认不发送随机订单；仅显式测试模式提供历史模拟快照。
    ws.send(JSON.stringify({ type: 'ORDER_SNAPSHOT', payload: simulation ? Array.from(orderBook.values()) : [], ts: Date.now() } as WsMessage));

    ws.on('message', (raw) => {
      if (!simulation) return;
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'NEW_ORDER' && msg.payload) {
          const o = makeOrder({ ...msg.payload, id: genId(), status: 'PENDING', filled: 0, avgPx: 0, pnl: 0, slippage: 0, time: new Date().toTimeString().slice(0,8), updatedAt: Date.now() });
          orderBook.set(o.id, o);
          broadcast({ type: 'ORDER_UPDATE', payload: { ...o, _isNew: true }, ts: Date.now() });
        }
        if (msg.type === 'CANCEL_ORDER' && msg.payload?.orderId) {
          const order = orderBook.get(msg.payload.orderId);
          if (order && !['FILLED','CANCELLED','REJECTED'].includes(order.status)) {
            const cancelled = { ...order, status: 'CANCELLED' as OrderStatus, updatedAt: Date.now() };
            orderBook.set(order.id, cancelled);
            broadcast({ type: 'ORDER_UPDATE', payload: cancelled, ts: Date.now() });
          }
        }
      } catch {}
    });

    ws.on('close', () => console.log('[AIM-WS] Client disconnected'));
    ws.on('error', (e) => console.error('[AIM-WS] Error:', e.message));
  });

  if (!simulation) {
    console.log('[AIM-WS] Real execution feed is not configured; simulation disabled.');
    return;
  }

  // 状态机 tick
  setInterval(() => {
    orderBook.forEach((order) => {
      const updated = tickOrder(order);
      if (!updated) return;
      orderBook.set(updated.id, updated);
      broadcast({ type: 'ORDER_UPDATE', payload: updated, ts: Date.now() });
      if (updated.status === 'FILLED' || updated.status === 'PARTIAL') {
        broadcast({ type: 'EXECUTION_REPORT', payload: { orderId: updated.id, symbol: updated.symbol, side: updated.side, execQty: updated.filled, execPx: updated.avgPx, status: updated.status, pnl: updated.pnl, slippage: updated.slippage, venue: updated.venue, ts: Date.now() }, ts: Date.now() });
      }
      if (updated.status === 'FILLED' && Math.abs(updated.slippage) > 0.25) {
        broadcast({ type: 'RISK_ALERT', payload: { level: 'WARNING', message: `${updated.symbol} 委托 ${updated.id} 滑点超限：${updated.slippage > 0 ? '+' : ''}${updated.slippage}bps`, orderId: updated.id, ts: Date.now() }, ts: Date.now() });
      }
    });
  }, 2000);

  // 新增委托
  setInterval(() => {
    if (Math.random() < 0.4 && orderBook.size < 30) {
      const o = makeOrder();
      orderBook.set(o.id, o);
      broadcast({ type: 'ORDER_UPDATE', payload: { ...o, _isNew: true }, ts: Date.now() });
    }
  }, 5000);

  // 心跳
  setInterval(() => broadcast({ type: 'HEARTBEAT', payload: { time: Date.now() }, ts: Date.now() }), 30000);

  console.log('[AIM-WS] WebSocket server registered at /ws/aim');
}

export function getOrderBook(): Order[] { return Array.from(orderBook.values()); }
