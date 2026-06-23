// fetch.js — All Alpaca API calls. Read-only. No POST/DELETE.

require('../env');

const API_KEY    = process.env.ALPACA_API_KEY;
const API_SECRET = process.env.ALPACA_API_SECRET;
const PAPER_URL  = 'https://paper-api.alpaca.markets/v2';
const DATA_URL   = 'https://data.alpaca.markets/v2';

if (!API_KEY || !API_SECRET) {
  throw new Error('Missing ALPACA_API_KEY / ALPACA_API_SECRET. Copy .env.example to .env and fill in your credentials.');
}

const HEADERS = {
  'APCA-API-KEY-ID':     API_KEY,
  'APCA-API-SECRET-KEY': API_SECRET,
  'Content-Type':        'application/json'
};

const errors = [];

async function apiFetch(url) {
  try {
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) {
      const msg = `API ${res.status} — ${url}`;
      errors.push({ time: new Date().toISOString(), error: msg });
      throw new Error(msg);
    }
    return res.json();
  } catch (e) {
    errors.push({ time: new Date().toISOString(), error: e.message });
    throw e;
  }
}

async function getAccount() {
  const d = await apiFetch(`${PAPER_URL}/account`);
  return {
    equity:       parseFloat(d.equity),
    cash:         parseFloat(d.cash),
    buyingPower:  parseFloat(d.buying_power),   // display only, never used for risk
    lastEquity:   parseFloat(d.last_equity),
    daytradeCount: parseInt(d.daytrade_count || 0)
  };
}

async function getPositions() {
  const arr = await apiFetch(`${PAPER_URL}/positions`);
  return arr.map(p => ({
    symbol:        p.symbol,
    qty:           parseFloat(p.qty),
    avgEntry:      parseFloat(p.avg_entry_price),
    currentPrice:  parseFloat(p.current_price),
    marketValue:   parseFloat(p.market_value),
    costBasis:     parseFloat(p.cost_basis),
    unrealizedPL:  parseFloat(p.unrealized_pl),
    unrealizedPct: parseFloat(p.unrealized_plpc) * 100,
    side:          p.side
  }));
}

async function getOpenOrders() {
  const arr = await apiFetch(`${PAPER_URL}/orders?status=open&limit=50`);
  return arr.map(o => ({
    id:           o.id,
    symbol:       o.symbol,
    side:         o.side,
    type:         o.type,
    qty:          parseFloat(o.qty),
    filledQty:    parseFloat(o.filled_qty || 0),
    limitPrice:   o.limit_price ? parseFloat(o.limit_price) : null,
    stopPrice:    o.stop_price  ? parseFloat(o.stop_price)  : null,
    trailPct:     o.trail_percent ? parseFloat(o.trail_percent) : null,
    hwm:          o.hwm ? parseFloat(o.hwm) : null,
    status:       o.status,
    createdAt:    o.created_at,
    tif:          o.time_in_force
  }));
}

async function getClosedOrders() {
  const arr = await apiFetch(`${PAPER_URL}/orders?status=closed&limit=100`);
  return arr.map(o => ({
    id:          o.id,
    symbol:      o.symbol,
    side:        o.side,
    type:        o.type,
    qty:         parseFloat(o.qty),
    filledQty:   parseFloat(o.filled_qty || 0),
    filledAvg:   o.filled_avg_price ? parseFloat(o.filled_avg_price) : null,
    status:      o.status,
    createdAt:   o.created_at,
    filledAt:    o.filled_at,
    canceledAt:  o.canceled_at
  }));
}

async function getFills() {
  const d = await apiFetch(`${PAPER_URL}/account/activities?activity_types=FILL&page_size=100`);
  return (Array.isArray(d) ? d : []).map(f => ({
    id:          f.id,
    symbol:      f.symbol,
    side:        f.side,
    qty:         parseFloat(f.qty),
    price:       parseFloat(f.price),
    amount:      parseFloat(f.qty) * parseFloat(f.price),
    date:        f.transaction_time
  }));
}

async function getPortfolioHistory() {
  try {
    const d = await apiFetch(`${PAPER_URL}/account/portfolio/history?period=1M&timeframe=1D`);
    const timestamps  = d.timestamp  || [];
    const equities    = d.equity     || [];
    const profitLoss  = d.profit_loss || [];
    return timestamps.map((t, i) => ({
      date:   new Date(t * 1000).toISOString().split('T')[0],
      equity: equities[i],
      pl:     profitLoss[i]
    })).filter(r => r.equity !== null);
  } catch {
    return [];
  }
}

async function getSnapshots(symbols) {
  if (!symbols.length) return {};
  const url = `${DATA_URL}/stocks/snapshots?symbols=${symbols.join(',')}`;
  return apiFetch(url);
}

function getApiErrors() { return errors; }

module.exports = {
  getAccount, getPositions, getOpenOrders, getClosedOrders,
  getFills, getPortfolioHistory, getSnapshots, getApiErrors
};
