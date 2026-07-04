// trader.js — Order placement layer. Alpaca paper API only.
// ⚠️  This file places REAL orders against the paper trading account.
//     PAPER_URL only — never touches live.alpaca.markets.

require('./env');

const API_KEY    = process.env.ALPACA_API_KEY;
const API_SECRET = process.env.ALPACA_API_SECRET;
const PAPER_URL  = 'https://paper-api.alpaca.markets/v2';

if (!API_KEY || !API_SECRET) {
  throw new Error('Missing ALPACA_API_KEY / ALPACA_API_SECRET in .env');
}

const HEADERS = {
  'APCA-API-KEY-ID':     API_KEY,
  'APCA-API-SECRET-KEY': API_SECRET,
  'Content-Type':        'application/json'
};

async function apiFetch(url, opts = {}) {
  const res = await fetch(url, { headers: HEADERS, ...opts });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Alpaca ${res.status}: ${body.message || JSON.stringify(body)}`);
  return body;
}

// Place any order — returns the created order object
async function placeOrder({ symbol, side, qty, type, limitPrice, trailPercent, tif = 'gtc' }) {
  const payload = { symbol, side, qty: String(qty), type, time_in_force: tif };
  if (limitPrice)   payload.limit_price   = String(limitPrice.toFixed(2));
  if (trailPercent) payload.trail_percent = String(trailPercent);
  return apiFetch(`${PAPER_URL}/orders`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

// Cancel a single order by ID
async function cancelOrder(orderId) {
  const res = await fetch(`${PAPER_URL}/orders/${orderId}`, {
    method: 'DELETE',
    headers: HEADERS
  });
  if (res.status === 204 || res.status === 200) return true;
  const body = await res.json().catch(() => ({}));
  throw new Error(`Cancel failed ${res.status}: ${body.message || JSON.stringify(body)}`);
}

// Get all open orders, optionally filtered to one symbol
async function getOpenOrders(symbol) {
  const url = symbol
    ? `${PAPER_URL}/orders?status=open&limit=100&symbols=${symbol}`
    : `${PAPER_URL}/orders?status=open&limit=100`;
  return apiFetch(url);
}

// Get all current positions
async function getPositions() {
  return apiFetch(`${PAPER_URL}/positions`);
}

// Get current account
async function getAccount() {
  return apiFetch(`${PAPER_URL}/account`);
}

// Place a trailing stop covering uncovered shares for a position
// Returns order if placed, null if already fully covered
async function ensureTrailingStop(symbol, trailPercent = 10) {
  const [positions, orders] = await Promise.all([getPositions(), getOpenOrders(symbol)]);

  const pos = positions.find(p => p.symbol === symbol);
  if (!pos || parseFloat(pos.qty) === 0) return null;

  const posQty   = parseFloat(pos.qty);
  const stopQty  = orders
    .filter(o => o.symbol === symbol && o.side === 'sell' && o.type === 'trailing_stop')
    .reduce((s, o) => s + parseFloat(o.qty), 0);

  const uncovered = posQty - stopQty;
  if (uncovered <= 0) return null;

  return placeOrder({ symbol, side: 'sell', qty: uncovered, type: 'trailing_stop', trailPercent });
}

module.exports = { placeOrder, cancelOrder, getOpenOrders, getPositions, getAccount, ensureTrailingStop };
