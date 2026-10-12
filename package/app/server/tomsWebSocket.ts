/**
 * TOMS 卖方债券 WebSocket 服务
 * 路径: /ws/toms
 * 功能：
 *   - 债券委托状态机：PENDING → PARTIAL → FILLED / CANCELLED / REJECTED
 *   - 与 AIM 买方联动：每次 AIM 提交买单，TOMS 自动生成对应卖单
 *   - RFQ 报价流：每 8 秒新增一条 RFQ 请求
 *   - 做市商报价推送：每 3 秒更新 bid/ask 价差
 *   - 风险预警：当持仓集中度/久期偏移超阈值时推送
 */
import { WebSocketServer, WebSocket } from 'ws';
import { Server as HttpServer } from 'http';

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
  price: number;        // clean price
  yieldToMaturity: number;
  spread: number;       // OAS bps
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
  // 状态变更时间线
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
  spread: number;       // bps
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

interface TOMSMessage {
  type: 'INIT' | 'ORDER_UPDATE' | 'NEW_ORDER' | 'RFQ_UPDATE' | 'NEW_RFQ' | 'QUOTE_UPDATE' | 'RISK_ALERT' | 'HEARTBEAT' | 'ORDER_ACCEPTED' | 'ORDER_CANCELLED' | 'AIM_LINKED_ORDER';
  data: any;
}

// ─── 债券品种池 ────────────────────────────────────────────────────────────────
const BOND_UNIVERSE = [
  { isin: 'US912796ZT08', issuer: 'US Treasury', coupon: 4.25, maturity: '2026-03-31', rating: 'AAA', duration: 1.8 },
  { isin: 'US912810TM57', issuer: 'US Treasury', coupon: 4.50, maturity: '2033-11-15', rating: 'AAA', duration: 8.2 },
  { isin: 'US912810TL74', issuer: 'US Treasury', coupon: 3.875, maturity: '2043-08-15', rating: 'AAA', duration: 16.4 },
  { isin: 'US38141GXZ20', issuer: 'Goldman Sachs', coupon: 5.15, maturity: '2028-05-22', rating: 'A+', duration: 4.1 },
  { isin: 'US46625HKA83', issuer: 'JPMorgan Chase', coupon: 4.80, maturity: '2030-07-25', rating: 'A+', duration: 5.8 },
  { isin: 'US166764BG18', issuer: 'Chevron', coupon: 3.90, maturity: '2029-11-07', rating: 'AA-', duration: 5.2 },
  { isin: 'US037833DV79', issuer: 'Apple Inc', coupon: 4.10, maturity: '2028-08-08', rating: 'AA+', duration: 4.4 },
  { isin: 'US594918BW84', issuer: 'Microsoft', coupon: 3.75, maturity: '2032-04-27', rating: 'AAA', duration: 7.9 },
  { isin: 'XS2345678901', issuer: 'Deutsche Bank', coupon: 5.50, maturity: '2027-06-15', rating: 'BBB+', duration: 3.1 },
  { isin: 'XS1234567890', issuer: 'BNP Paribas', coupon: 4.75, maturity: '2029-09-20', rating: 'A-', duration: 5.6 },
];

const TRADERS = ['Li Wei', 'Zhang Min', 'Wang Hui', 'Chen Bo', 'Liu Fang'];
const ACCOUNTS = ['BOND-A', 'BOND-B', 'CREDIT-1', 'RATES-1', 'PROP-2'];
const ALGOS = ['VWAP', 'TWAP', 'IS', 'DARK', 'VOICE'];
const DEALERS = ['Goldman Sachs', 'JPMorgan', 'Morgan Stanley', 'Barclays', 'Deutsche Bank'];

function genId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;
}

function genBondOrder(overrides?: Partial<BondOrder>): BondOrder {
  const bond = BOND_UNIVERSE[Math.floor(Math.random() * BOND_UNIVERSE.length)];
  const side = Math.random() > 0.5 ? 'BUY' : 'SELL';
  const faceValue = Math.round((Math.random() * 9 + 1) * 1000000 / 100000) * 100000; // 100K-10M
  const price = 95 + Math.random() * 10;
  const ytm = bond.coupon / price * 100 + (Math.random() - 0.5) * 0.5;
  const spread = Math.round((Math.random() * 200 - 50));
  const now = Date.now();
  const ts = now - Math.floor(Math.random() * 3600000);
  const timeStr = new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const status: BondOrderStatus = (['FILLED', 'PARTIAL', 'PENDING', 'CANCELLED'] as BondOrderStatus[])[Math.floor(Math.random() * 4)];
  const filled = status === 'FILLED' ? faceValue : status === 'PARTIAL' ? Math.round(faceValue * (0.2 + Math.random() * 0.6)) : 0;
  const pnl = filled > 0 ? Math.round((Math.random() - 0.4) * filled * 0.002) : 0;
  const dv01 = Math.round(faceValue * bond.duration * 0.0001);

  const timeline: BondOrder['timeline'] = [{ status: 'PENDING', ts: ts, note: '委托已接收' }];
  if (status === 'PARTIAL' || status === 'FILLED') {
    timeline.push({ status: 'PARTIAL', ts: ts + 30000, note: `已成交 ${Math.round(filled * 0.4 / 100000) * 100000 / 1000}K` });
  }
  if (status === 'FILLED') {
    timeline.push({ status: 'FILLED', ts: ts + 90000, note: '委托全部成交' });
  }
  if (status === 'CANCELLED') {
    timeline.push({ status: 'CANCELLED', ts: ts + 60000, note: '交易员主动撤单' });
  }

  return {
    id: genId('BOND'),
    isin: bond.isin,
    issuer: bond.issuer,
    coupon: bond.coupon,
    maturity: bond.maturity,
    side,
    faceValue,
    filled,
    price: parseFloat(price.toFixed(4)),
    yieldToMaturity: parseFloat(ytm.toFixed(4)),
    spread,
    status,
    algo: ALGOS[Math.floor(Math.random() * ALGOS.length)],
    trader: TRADERS[Math.floor(Math.random() * TRADERS.length)],
    account: ACCOUNTS[Math.floor(Math.random() * ACCOUNTS.length)],
    time: timeStr,
    pnl,
    dv01,
    duration: bond.duration,
    rating: bond.rating,
    venue: (['VOICE', 'ELECTRONIC', 'RFQ', 'DARK'] as BondOrder['venue'][])[Math.floor(Math.random() * 4)],
    updatedAt: ts,
    timeline,
    ...overrides,
  };
}

function genRFQ(): RFQRequest {
  const bond = BOND_UNIVERSE[Math.floor(Math.random() * BOND_UNIVERSE.length)];
  const side = Math.random() > 0.5 ? 'BUY' : 'SELL';
  const faceValue = Math.round((Math.random() * 5 + 1) * 1000000);
  const basePrice = 97 + Math.random() * 6;
  const now = Date.now();
  const dealerCount = Math.floor(Math.random() * 3) + 2;
  const selectedDealers = [...DEALERS].sort(() => Math.random() - 0.5).slice(0, dealerCount);
  const status: RFQStatus = (['OPEN', 'QUOTED', 'TRADED', 'EXPIRED'] as RFQStatus[])[Math.floor(Math.random() * 4)];
  return {
    id: genId('RFQ'),
    isin: bond.isin,
    issuer: bond.issuer,
    side,
    faceValue,
    status,
    bidPrice: status !== 'OPEN' ? parseFloat((basePrice - 0.25).toFixed(4)) : undefined,
    askPrice: status !== 'OPEN' ? parseFloat((basePrice + 0.25).toFixed(4)) : undefined,
    bidYield: status !== 'OPEN' ? parseFloat((bond.coupon / (basePrice - 0.25) * 100).toFixed(4)) : undefined,
    askYield: status !== 'OPEN' ? parseFloat((bond.coupon / (basePrice + 0.25) * 100).toFixed(4)) : undefined,
    dealers: selectedDealers,
    bestDealer: status === 'TRADED' ? selectedDealers[0] : undefined,
    createdAt: now - Math.floor(Math.random() * 600000),
    expiresAt: now + 300000,
  };
}

function genQuote(): MarketMakerQuote {
  const bond = BOND_UNIVERSE[Math.floor(Math.random() * BOND_UNIVERSE.length)];
  const midPrice = 97 + Math.random() * 6;
  const halfSpread = 0.1 + Math.random() * 0.4;
  return {
    isin: bond.isin,
    issuer: bond.issuer,
    bidPrice: parseFloat((midPrice - halfSpread).toFixed(4)),
    askPrice: parseFloat((midPrice + halfSpread).toFixed(4)),
    bidYield: parseFloat((bond.coupon / (midPrice - halfSpread) * 100).toFixed(4)),
    askYield: parseFloat((bond.coupon / (midPrice + halfSpread) * 100).toFixed(4)),
    spread: parseFloat((halfSpread * 2 * 100).toFixed(1)),
    size: Math.round((Math.random() * 9 + 1) * 1000000),
    dealer: DEALERS[Math.floor(Math.random() * DEALERS.length)],
    ts: Date.now(),
  };
}

function genRiskAlert(): TOMSRiskAlert {
  const alerts: Omit<TOMSRiskAlert, 'ts'>[] = [
    { level: 'WARNING', type: 'DURATION', message: '组合久期 8.4 年，超过基准久期 ±1 年限制', value: 8.4, limit: 7.5 },
    { level: 'CRITICAL', type: 'CONCENTRATION', message: 'US Treasury 集中度达 42%，超过单发行人 40% 上限', value: 42, limit: 40 },
    { level: 'WARNING', type: 'CREDIT', message: 'BBB 级债券占比 18%，接近 20% 上限', value: 18, limit: 20 },
    { level: 'INFO', type: 'LIQUIDITY', message: '5 笔委托流动性评分低于 3，建议拆单执行', value: 5, limit: 0 },
    { level: 'WARNING', type: 'LIMIT', message: '日内 DV01 净暴露 $48K，接近 $50K 限额', value: 48000, limit: 50000 },
  ];
  const alert = alerts[Math.floor(Math.random() * alerts.length)];
  return { ...alert, ts: Date.now() };
}

// ─── WebSocket 服务注册 ────────────────────────────────────────────────────────
export function registerTOMSWebSocket(server: HttpServer) {
  const wss = new WebSocketServer({ noServer: true });
  console.log('[TOMS-WS] WebSocket server registered at /ws/toms');

  server.on('upgrade', (req, socket, head) => {
    if ((req.url ?? '').split('?')[0] !== '/ws/toms') return;
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });

  // 内存状态
  let orders: BondOrder[] = Array.from({ length: 18 }, () => genBondOrder());
  let rfqList: RFQRequest[] = Array.from({ length: 8 }, () => genRFQ());
  let quotes: MarketMakerQuote[] = Array.from({ length: 10 }, () => genQuote());
  const clients = new Set<WebSocket>();

  function broadcast(msg: TOMSMessage) {
    const payload = JSON.stringify(msg);
    clients.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) ws.send(payload);
    });
  }

  // ── 委托状态推进（每 3 秒）
  setInterval(() => {
    const pending = orders.filter(o => o.status === 'PENDING' || o.status === 'PARTIAL');
    if (pending.length === 0) return;
    const order = pending[Math.floor(Math.random() * pending.length)];
    const prev = order.status;
    const rand = Math.random();

    if (order.status === 'PENDING') {
      if (rand < 0.5) {
        order.status = 'PARTIAL';
        order.filled = Math.round(order.faceValue * (0.2 + Math.random() * 0.4));
        order.updatedAt = Date.now();
        order.timeline.push({ status: 'PARTIAL', ts: Date.now(), note: `已成交 ${(order.filled / 1000000).toFixed(1)}M` });
      } else if (rand < 0.65) {
        order.status = 'CANCELLED';
        order.updatedAt = Date.now();
        order.timeline.push({ status: 'CANCELLED', ts: Date.now(), note: '交易员主动撤单' });
      }
    } else if (order.status === 'PARTIAL') {
      if (rand < 0.55) {
        order.status = 'FILLED';
        order.filled = order.faceValue;
        order.pnl = Math.round((Math.random() - 0.4) * order.faceValue * 0.002);
        order.updatedAt = Date.now();
        order.timeline.push({ status: 'FILLED', ts: Date.now(), note: '委托全部成交' });
      } else if (rand < 0.7) {
        order.status = 'CANCELLED';
        order.updatedAt = Date.now();
        order.timeline.push({ status: 'CANCELLED', ts: Date.now(), note: '剩余部分撤单' });
      }
    }

    if (order.status !== prev) {
      broadcast({ type: 'ORDER_UPDATE', data: order });
    }
  }, 3000);

  // ── 新增债券委托（每 7 秒）
  setInterval(() => {
    const newOrder = genBondOrder({ status: 'PENDING', filled: 0, pnl: 0, _isNew: true });
    orders.unshift(newOrder);
    if (orders.length > 60) orders = orders.slice(0, 60);
    broadcast({ type: 'NEW_ORDER', data: newOrder });
    setTimeout(() => {
      newOrder._isNew = false;
    }, 3000);
  }, 7000);

  // ── RFQ 状态更新（每 5 秒）
  setInterval(() => {
    const openRFQ = rfqList.filter(r => r.status === 'OPEN');
    if (openRFQ.length > 0) {
      const rfq = openRFQ[Math.floor(Math.random() * openRFQ.length)];
      const bond = BOND_UNIVERSE.find(b => b.isin === rfq.isin) || BOND_UNIVERSE[0];
      const basePrice = 97 + Math.random() * 6;
      rfq.status = 'QUOTED';
      rfq.bidPrice = parseFloat((basePrice - 0.25).toFixed(4));
      rfq.askPrice = parseFloat((basePrice + 0.25).toFixed(4));
      rfq.bidYield = parseFloat((bond.coupon / (basePrice - 0.25) * 100).toFixed(4));
      rfq.askYield = parseFloat((bond.coupon / (basePrice + 0.25) * 100).toFixed(4));
      rfq.bestDealer = rfq.dealers[0];
      broadcast({ type: 'RFQ_UPDATE', data: rfq });
    }
    // 新增 RFQ
    if (Math.random() < 0.4) {
      const newRFQ = genRFQ();
      newRFQ.status = 'OPEN';
      rfqList.unshift(newRFQ);
      if (rfqList.length > 30) rfqList = rfqList.slice(0, 30);
      broadcast({ type: 'NEW_RFQ', data: newRFQ });
    }
  }, 5000);

  // ── 做市商报价更新（每 2 秒）
  setInterval(() => {
    const quote = genQuote();
    const idx = quotes.findIndex(q => q.isin === quote.isin);
    if (idx >= 0) quotes[idx] = quote;
    else { quotes.unshift(quote); if (quotes.length > 20) quotes = quotes.slice(0, 20); }
    broadcast({ type: 'QUOTE_UPDATE', data: quote });
  }, 2000);

  // ── 风险预警（每 20 秒，随机触发）
  setInterval(() => {
    if (Math.random() < 0.4) {
      const alert = genRiskAlert();
      broadcast({ type: 'RISK_ALERT', data: alert });
    }
  }, 20000);

  // ── 心跳（每 30 秒）
  setInterval(() => {
    broadcast({ type: 'HEARTBEAT', data: { ts: Date.now(), orderCount: orders.length } });
  }, 30000);

  wss.on('connection', (ws: WebSocket) => {
    clients.add(ws);
    console.log(`[TOMS-WS] Client connected, total: ${clients.size}`);

    // 发送初始快照
    ws.send(JSON.stringify({
      type: 'INIT',
      data: { orders, rfqList, quotes },
    }));

    ws.on('message', (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString());
        // 处理撤单请求
        if (msg.type === 'CANCEL_ORDER') {
          const order = orders.find(o => o.id === msg.orderId);
          if (order && (order.status === 'PENDING' || order.status === 'PARTIAL')) {
            order.status = 'CANCELLED';
            order.updatedAt = Date.now();
            order.timeline.push({ status: 'CANCELLED', ts: Date.now(), note: '用户手动撤单' });
            broadcast({ type: 'ORDER_UPDATE', data: order });
            ws.send(JSON.stringify({ type: 'ORDER_CANCELLED', data: { orderId: msg.orderId, success: true } }));
          }
        }
        // 处理新委托提交
        if (msg.type === 'SUBMIT_ORDER') {
          const bond = BOND_UNIVERSE.find(b => b.isin === msg.isin) || BOND_UNIVERSE[0];
          const newOrder = genBondOrder({
            isin: msg.isin || bond.isin,
            issuer: msg.issuer || bond.issuer,
            side: msg.side || 'SELL',
            faceValue: msg.faceValue || 1000000,
            price: msg.price || 98.5,
            status: 'PENDING',
            filled: 0,
            pnl: 0,
            _isNew: true,
            timeline: [{ status: 'PENDING', ts: Date.now(), note: '委托已接收' }],
          });
          orders.unshift(newOrder);
          broadcast({ type: 'NEW_ORDER', data: newOrder });
          ws.send(JSON.stringify({ type: 'ORDER_ACCEPTED', data: { orderId: newOrder.id, success: true } }));
        }
        // AIM 买方联动：当 AIM 提交买单时，TOMS 自动生成对应卖单
        if (msg.type === 'AIM_BUY_ORDER') {
          const linkedOrder = genBondOrder({
            side: 'SELL',
            status: 'PENDING',
            filled: 0,
            pnl: 0,
            _isNew: true,
            timeline: [{ status: 'PENDING', ts: Date.now(), note: `AIM联动：对应买方委托 ${msg.aimOrderId}` }],
          });
          orders.unshift(linkedOrder);
          broadcast({ type: 'AIM_LINKED_ORDER', data: { linkedOrder, aimOrderId: msg.aimOrderId } });
        }
      } catch (e) {
        console.error('[TOMS-WS] Message parse error:', e);
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
      console.log(`[TOMS-WS] Client disconnected`);
    });

    ws.on('error', (err) => {
      console.error('[TOMS-WS] WebSocket error:', err.message);
      clients.delete(ws);
    });
  });

  return wss;
}
