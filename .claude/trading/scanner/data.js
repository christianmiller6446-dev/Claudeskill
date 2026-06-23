// data.js — Read-only Alpaca data fetcher. No order placement. No POST/DELETE.

require('../env');

const API_KEY    = process.env.ALPACA_API_KEY;
const API_SECRET = process.env.ALPACA_API_SECRET;
const DATA_URL   = 'https://data.alpaca.markets/v2';
const PAPER_URL  = 'https://paper-api.alpaca.markets/v2';

if (!API_KEY || !API_SECRET) {
  throw new Error('Missing ALPACA_API_KEY / ALPACA_API_SECRET. Copy .env.example to .env and fill in your credentials.');
}

const HEADERS = {
  'APCA-API-KEY-ID':     API_KEY,
  'APCA-API-SECRET-KEY': API_SECRET,
  'Content-Type':        'application/json'
};

const WATCHLIST = ['NVDA','AMD','TSLA','AAPL','MSFT','META','AMZN','GOOGL','PLTR','SMCI','AVGO','QQQ','SPY'];

async function apiFetch(url) {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`API error ${res.status} for ${url}`);
  return res.json();
}

// Fetch 80 daily bars for all watchlist symbols (covers MA50 + buffer)
// Handles pagination — multi-symbol endpoint truncates at ~10k bars total per page
async function getBars() {
  const symbols = WATCHLIST.join(',');
  const start = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const baseUrl = `${DATA_URL}/stocks/bars?symbols=${symbols}&timeframe=1Day&start=${start}&adjustment=raw&limit=1000`;

  const accumulated = {};
  let nextToken = null;

  do {
    const url = nextToken ? `${baseUrl}&page_token=${encodeURIComponent(nextToken)}` : baseUrl;
    const data = await apiFetch(url);
    const page = data.bars || {};
    for (const [sym, bars] of Object.entries(page)) {
      if (!accumulated[sym]) accumulated[sym] = [];
      accumulated[sym].push(...bars);
    }
    nextToken = data.next_page_token || null;
  } while (nextToken);

  return accumulated;
}

// Fetch latest snapshots (current price, today volume, today OHLC)
async function getSnapshots() {
  const symbols = WATCHLIST.join(',');
  const url = `${DATA_URL}/stocks/snapshots?symbols=${symbols}`;
  const data = await apiFetch(url);
  return data || {};
}

// Fetch account cash/equity — paper account, read only
async function getAccount() {
  const data = await apiFetch(`${PAPER_URL}/account`);
  return {
    equity: parseFloat(data.equity),
    cash:   parseFloat(data.cash)
    // Never return buying_power — cash only per strategy rules
  };
}

module.exports = { getBars, getSnapshots, getAccount, WATCHLIST };
