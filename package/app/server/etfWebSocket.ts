import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';

// ETF 产品静态数据
const ETF_PRODUCTS = [
  { id: 'SPY', name: 'SPDR S&P 500 ETF', nav: 524.82, marketCap: 520000, sector: '大盘股', currency: 'USD', exchange: 'NYSE' },
  { id: 'QQQ', name: 'Invesco QQQ Trust', nav: 448.35, marketCap: 220000, sector: '科技股', currency: 'USD', exchange: 'NASDAQ' },
  { id: 'IWM', name: 'iShares Russell 2000', nav: 198.42, marketCap: 65000, sector: '小盘股', currency: 'USD', exchange: 'NYSE' },
  { id: 'GLD', name: 'SPDR Gold Shares', nav: 218.65, marketCap: 58000, sector: '黄金', currency: 'USD', exchange: 'NYSE' },
  { id: 'TLT', name: 'iShares 20+ Year Treasury', nav: 88.24, marketCap: 42000, sector: '长期国债', currency: 'USD', exchange: 'NASDAQ' },
  { id: 'HYG', name: 'iShares HY Corp Bond', nav: 76.18, marketCap: 18000, sector: '高收益债', currency: 'USD', exchange: 'NYSE' },
  { id: 'EEM', name: 'iShares MSCI Emerging Markets', nav: 41.52, marketCap: 22000, sector: '新兴市场', currency: 'USD', exchange: 'NYSE' },
  { id: 'XLF', name: 'Financial Select Sector SPDR', nav: 42.38, marketCap: 38000, sector: '金融', currency: 'USD', exchange: 'NYSE' },
  { id: 'ARKK', name: 'ARK Innovation ETF', nav: 48.92, marketCap: 8500, sector: '创新科技', currency: 'USD', exchange: 'NYSE' },
  { id: 'KWEB', name: 'KraneShares CSI China Internet', nav: 28.74, marketCap: 5200, sector: '中国互联网', currency: 'USD', exchange: 'NYSE' },
];

const MARKET_MAKERS = ['Goldman Sachs', 'JP Morgan', 'Citadel', 'Virtu', 'Jane Street', 'Two Sigma'];

interface ETFQuote {
  id: string;
  name: string;
  nav: number;
  marketPrice: number;
  premium: number;       // 溢价率 (%)
  bidPrice: number;
  askPrice: number;
  bidSize: number;
  askSize: number;
  volume: number;
  turnover: number;
  inflow: number;        // 资金净流入 (万)
  creationUnits: number; // 申购单数量
  redemptionUnits: number;
  bestMM: string;        // 最优做市商
  mmSpread: number;      // 做市商价差 (bps)
  ts: number;
  alert?: {
    level: 'CRITICAL' | 'WARNING' | 'INFO';
    message: string;
    threshold: number;
  };
}

interface MMQuote {
  etfId: string;
  dealer: string;
  bidPrice: number;
  askPrice: number;
  bidSize: number;
  askSize: number;
  spread: number;
  ts: number;
}

interface ETFWSMessage {
  type: 'quotes' | 'mm_quotes' | 'alert' | 'creation_order' | 'redemption_order' | 'heartbeat';
  data: any;
  ts: number;
}

// 当前 ETF 状态
const etfState: Record<string, ETFQuote> = {};
ETF_PRODUCTS.forEach(p => {
  const nav = p.nav;
  const premium = (Math.random() - 0.5) * 1.2; // -0.6% ~ +0.6%
  const marketPrice = nav * (1 + premium / 100);
  etfState[p.id] = {
    id: p.id,
    name: p.name,
    nav,
    marketPrice: parseFloat(marketPrice.toFixed(4)),
    premium: parseFloat(premium.toFixed(4)),
    bidPrice: parseFloat((marketPrice * 0.9998).toFixed(4)),
    askPrice: parseFloat((marketPrice * 1.0002).toFixed(4)),
    bidSize: Math.floor(Math.random() * 50000 + 10000),
    askSize: Math.floor(Math.random() * 50000 + 10000),
    volume: Math.floor(Math.random() * 5000000 + 500000),
    turnover: Math.floor(Math.random() * 500000000 + 50000000),
    inflow: parseFloat(((Math.random() - 0.4) * 50000).toFixed(0)),
    creationUnits: Math.floor(Math.random() * 20),
    redemptionUnits: Math.floor(Math.random() * 15),
    bestMM: MARKET_MAKERS[Math.floor(Math.random() * MARKET_MAKERS.length)],
    mmSpread: parseFloat((Math.random() * 3 + 0.5).toFixed(2)),
    ts: Date.now(),
  };
});

// 做市商报价状态
const mmQuotes: MMQuote[] = [];

function generateMMQuotes(etfId: string): MMQuote[] {
  const etf = etfState[etfId];
  if (!etf) return [];
  return MARKET_MAKERS.map(dealer => {
    const spread = Math.random() * 0.04 + 0.01;
    const mid = etf.marketPrice;
    return {
      etfId,
      dealer,
      bidPrice: parseFloat((mid * (1 - spread / 200)).toFixed(4)),
      askPrice: parseFloat((mid * (1 + spread / 200)).toFixed(4)),
      bidSize: Math.floor(Math.random() * 100000 + 10000),
      askSize: Math.floor(Math.random() * 100000 + 10000),
      spread: parseFloat((spread * 10000).toFixed(2)),
      ts: Date.now(),
    };
  });
}

function updateETFState(): { updated: ETFQuote[]; alerts: any[] } {
  const updated: ETFQuote[] = [];
  const alerts: any[] = [];

  ETF_PRODUCTS.forEach(p => {
    const prev = etfState[p.id];
    // 随机游走
    const navDelta = (Math.random() - 0.5) * 0.002;
    const premiumDelta = (Math.random() - 0.5) * 0.08;
    const newNav = parseFloat((prev.nav * (1 + navDelta)).toFixed(4));
    const newPremium = parseFloat(Math.max(-2, Math.min(2, prev.premium + premiumDelta)).toFixed(4));
    const newMarketPrice = parseFloat((newNav * (1 + newPremium / 100)).toFixed(4));

    let alert: ETFQuote['alert'] | undefined;
    // 溢折价预警阈值
    if (Math.abs(newPremium) >= 0.8) {
      const level = Math.abs(newPremium) >= 1.2 ? 'CRITICAL' : 'WARNING';
      alert = {
        level,
        message: `${p.id} ${newPremium > 0 ? '溢价' : '折价'} ${Math.abs(newPremium).toFixed(3)}%，超过阈值 ${Math.abs(newPremium) >= 1.2 ? '1.2%' : '0.8%'}，建议${newPremium > 0 ? '赎回套利' : '申购套利'}`,
        threshold: Math.abs(newPremium) >= 1.2 ? 1.2 : 0.8,
      };
      alerts.push({ etfId: p.id, ...alert, premium: newPremium, nav: newNav, marketPrice: newMarketPrice, ts: Date.now() });
    }

    etfState[p.id] = {
      ...prev,
      nav: newNav,
      marketPrice: newMarketPrice,
      premium: newPremium,
      bidPrice: parseFloat((newMarketPrice * 0.9998).toFixed(4)),
      askPrice: parseFloat((newMarketPrice * 1.0002).toFixed(4)),
      bidSize: Math.floor(Math.random() * 50000 + 10000),
      askSize: Math.floor(Math.random() * 50000 + 10000),
      volume: prev.volume + Math.floor(Math.random() * 10000),
      inflow: parseFloat(((Math.random() - 0.4) * 5000 + prev.inflow).toFixed(0)),
      bestMM: MARKET_MAKERS[Math.floor(Math.random() * MARKET_MAKERS.length)],
      mmSpread: parseFloat((Math.random() * 3 + 0.5).toFixed(2)),
      ts: Date.now(),
      alert,
    };
    updated.push(etfState[p.id]);
  });

  return { updated, alerts };
}

function broadcast(clients: Set<WebSocket>, msg: ETFWSMessage) {
  const payload = JSON.stringify(msg);
  clients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) ws.send(payload);
  });
}

export function registerETFWebSocket(server: Server) {
  const wss = new WebSocketServer({ noServer: true });
  const clients = new Set<WebSocket>();

  server.on('upgrade', (req, socket, head) => {
    if ((req.url ?? '').split('?')[0] !== '/ws/etf') return;
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });

  wss.on('connection', (ws) => {
    clients.add(ws);
    console.log('[ETF-WS] Client connected, total:', clients.size);

    // 发送初始快照
    ws.send(JSON.stringify({
      type: 'quotes',
      data: Object.values(etfState),
      ts: Date.now(),
    }));
    // 发送初始做市商报价
    const allMM: MMQuote[] = [];
    ETF_PRODUCTS.forEach(p => allMM.push(...generateMMQuotes(p.id)));
    ws.send(JSON.stringify({ type: 'mm_quotes', data: allMM, ts: Date.now() }));

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'create_order' || msg.type === 'redeem_order') {
          const etf = etfState[msg.etfId];
          if (etf) {
            const isCreate = msg.type === 'create_order';
            if (isCreate) etfState[msg.etfId].creationUnits += msg.units || 1;
            else etfState[msg.etfId].redemptionUnits += msg.units || 1;
            ws.send(JSON.stringify({
              type: isCreate ? 'creation_order' : 'redemption_order',
              data: { etfId: msg.etfId, units: msg.units || 1, status: 'ACCEPTED', ts: Date.now() },
              ts: Date.now(),
            }));
          }
        }
      } catch {}
    });

    ws.on('close', () => {
      clients.delete(ws);
      console.log('[ETF-WS] Client disconnected');
    });
    ws.on('error', () => clients.delete(ws));
  });

  // 每2秒推送行情更新
  setInterval(() => {
    if (clients.size === 0) return;
    const { updated, alerts } = updateETFState();
    broadcast(clients, { type: 'quotes', data: updated, ts: Date.now() });
    if (alerts.length > 0) {
      broadcast(clients, { type: 'alert', data: alerts, ts: Date.now() });
    }
  }, 2000);

  // 每5秒更新做市商报价
  setInterval(() => {
    if (clients.size === 0) return;
    const allMM: MMQuote[] = [];
    ETF_PRODUCTS.forEach(p => allMM.push(...generateMMQuotes(p.id)));
    broadcast(clients, { type: 'mm_quotes', data: allMM, ts: Date.now() });
  }, 5000);

  // 心跳
  setInterval(() => {
    broadcast(clients, { type: 'heartbeat', data: null, ts: Date.now() });
  }, 30000);

  console.log('[ETF-WS] WebSocket server registered at /ws/etf');
}
