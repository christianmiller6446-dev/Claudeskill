// auto-trade.js — Autonomous trade execution based on scanner strategy.
// Runs the full scan pipeline and places paper orders automatically.
// Called by Windows Task Scheduler at 9:45 AM on market days.
//
// Rules encoded from strategy:
//   • Market gate must be open (SPY + QQQ above 50 MA)
//   • Stock must score >= 60 / 100
//   • Must be above both MA20 and MA50
//   • Not overextended (>15% 5d gain) unless R/R >= 3:1
//   • Max 1% equity risk per position, 10% max allocation cap
//   • Skip symbols already in a position or with an open buy order
//   • Max 2 new entries per run to avoid over-trading
//   • Immediately places a 10% trailing stop after each limit buy is confirmed
//     (if it fills during this run); persistent stop coverage handled by fill-watcher

require('../env');

const { getBars, getSnapshots, getAccount, WATCHLIST } = require('./data.js');
const { scoreStock, rankAll, setQQQ5d }                = require('./rank.js');
const { marketHealthCheck, stockFilters }               = require('./filters.js');
const { placeOrder, getOpenOrders, getPositions }       = require('../trader.js');
const fs   = require('fs');
const path = require('path');

const LOG_DIR  = path.join(__dirname, 'logs');
const LOG_FILE = path.join(LOG_DIR, 'auto-trade-log.json');
const MIN_SCORE       = 60;   // minimum composite score to enter
const TRAIL_PCT       = 10;   // trailing stop percent
const MAX_NEW_ENTRIES = 2;    // max new positions per run

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

function loadLog() {
  try { return fs.existsSync(LOG_FILE) ? JSON.parse(fs.readFileSync(LOG_FILE, 'utf8')) : []; }
  catch { return []; }
}

function appendLog(entry) {
  const log = loadLog();
  log.push(entry);
  fs.writeFileSync(LOG_FILE, JSON.stringify(log, null, 2), 'utf8');
}

function usd(n) { return '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

async function run() {
  const runAt = new Date().toISOString();
  console.log(`\n🤖 Auto-Trade — ${runAt}`);
  console.log(`⚠️  PAPER TRADING ONLY — real money is NOT at risk\n`);

  // ── 1. Fetch market data ──────────────────────────────────────
  console.log('📡 Fetching market data...');
  const [barsData, snapshots, account] = await Promise.all([
    getBars(), getSnapshots(), getAccount()
  ]);

  const equity = account.equity;
  const cash   = account.cash;
  console.log(`💰 Equity: ${usd(equity)} | Cash: ${usd(cash)}`);

  // ── 2. Compute market health ─────────────────────────────────
  const spyBars   = (barsData['SPY'] || []).map(b => b.c);
  const qqqBars   = (barsData['QQQ'] || []).map(b => b.c);
  const spy5d = spyBars.length >= 6
    ? (spyBars.at(-1) - spyBars.at(-6)) / spyBars.at(-6) * 100 : 0;
  const qqq5d = qqqBars.length >= 6
    ? (qqqBars.at(-1) - qqqBars.at(-6)) / qqqBars.at(-6) * 100 : 0;
  setQQQ5d(qqq5d);

  const allScores = WATCHLIST
    .map(sym => barsData[sym]?.length >= 52
      ? scoreStock(sym, barsData[sym], snapshots[sym], spy5d, qqq5d)
      : null)
    .filter(Boolean);

  const ranked     = rankAll(allScores);
  const spy        = ranked.find(r => r.symbol === 'SPY');
  const qqq        = ranked.find(r => r.symbol === 'QQQ');
  const mktHealth  = marketHealthCheck(spy, qqq);

  console.log(`🌡️  Market gate: ${mktHealth.healthy ? '✅ OPEN' : '🚫 CLOSED'}`);

  if (!mktHealth.healthy) {
    console.log('❌ Market gate closed — no new entries today.');
    appendLog({ runAt, action: 'SKIP_ALL', reason: 'market gate closed', equity, cash });
    return;
  }

  // ── 3. Get existing positions + open orders ──────────────────
  const [positions, openOrders] = await Promise.all([getPositions(), getOpenOrders()]);
  const heldSymbols    = new Set(positions.map(p => p.symbol));
  const pendingBuys    = new Set(
    openOrders.filter(o => o.side === 'buy').map(o => o.symbol)
  );

  console.log(`📋 Current positions: ${heldSymbols.size ? [...heldSymbols].join(', ') : 'none'}`);
  console.log(`📋 Pending buys:      ${pendingBuys.size ? [...pendingBuys].join(', ') : 'none'}`);

  // ── 4. Find qualifying setups ────────────────────────────────
  const candidates = ranked
    .filter(s => !['SPY', 'QQQ'].includes(s.symbol))
    .map(s => ({ stock: s, filter: stockFilters(s, cash) }))
    .filter(({ stock, filter }) => {
      if (!filter.tradeable)               return false;
      if (stock.score < MIN_SCORE)         return false;
      if (heldSymbols.has(stock.symbol))   return false;
      if (pendingBuys.has(stock.symbol))   return false;
      return true;
    });

  console.log(`\n📊 Qualifying setups: ${candidates.length}`);
  candidates.forEach(({ stock, filter }) => {
    console.log(`  ${stock.symbol.padEnd(6)} score: ${stock.score} | entry: ${usd(stock.entry)} | shares: ${filter.maxShares} | risk: ${usd(filter.dollarRisk)}`);
  });

  if (!candidates.length) {
    console.log('ℹ️  No qualifying setups — no trades placed.');
    appendLog({ runAt, action: 'SKIP_ALL', reason: 'no qualifying setups', equity, cash,
      topScores: ranked.slice(0, 5).map(r => ({ symbol: r.symbol, score: r.score })) });
    return;
  }

  // ── 5. Place orders (max MAX_NEW_ENTRIES) ────────────────────
  const toTrade = candidates.slice(0, MAX_NEW_ENTRIES);
  const results = [];

  for (const { stock, filter } of toTrade) {
    const { symbol, entry, stop, target, score } = stock;
    const { maxShares, dollarRisk, positionCost } = filter;

    console.log(`\n🛒 Placing limit buy — ${symbol} x${maxShares} @ ${usd(entry)}`);
    console.log(`   Score: ${score} | Stop: ${usd(stop)} | Target: ${usd(target)} | Risk: ${usd(dollarRisk)}`);

    try {
      const order = await placeOrder({
        symbol,
        side:       'buy',
        qty:        maxShares,
        type:       'limit',
        limitPrice: entry,
        tif:        'gtc'
      });

      console.log(`   ✅ Order placed — ID: ${order.id} | Status: ${order.status}`);

      // If it filled immediately (market order or crossed), place trailing stop now
      if (order.status === 'filled') {
        console.log(`   ⚡ Filled immediately — placing trailing stop...`);
        const stop_order = await placeOrder({
          symbol, side: 'sell', qty: maxShares,
          type: 'trailing_stop', trailPercent: TRAIL_PCT
        });
        console.log(`   🛡️  Trailing stop placed — ID: ${stop_order.id}`);
      } else {
        console.log(`   ⏳ Limit order pending — fill-watcher will place trailing stop on fill`);
      }

      results.push({ symbol, action: 'BUY_PLACED', orderId: order.id, status: order.status,
        qty: maxShares, limitPrice: entry, stop, target, score, dollarRisk, positionCost });

    } catch (err) {
      console.error(`   ❌ Order failed for ${symbol}: ${err.message}`);
      results.push({ symbol, action: 'BUY_FAILED', error: err.message, qty: maxShares, limitPrice: entry });
    }
  }

  // ── 6. Log run ───────────────────────────────────────────────
  appendLog({ runAt, equity, cash, marketGate: true, trades: results,
    skipped: candidates.slice(MAX_NEW_ENTRIES).map(c => c.stock.symbol) });

  // ── 7. Summary ───────────────────────────────────────────────
  console.log(`\n${'═'.repeat(55)}`);
  console.log(`  AUTO-TRADE COMPLETE — ${new Date().toISOString().split('T')[0]}`);
  console.log(`${'═'.repeat(55)}`);
  results.forEach(r => {
    const status = r.action === 'BUY_PLACED' ? '✅' : '❌';
    console.log(`  ${status} ${r.symbol}: ${r.action} | ${r.qty} shares @ ${r.limitPrice ? usd(r.limitPrice) : '—'}`);
  });
  console.log(`  PAPER TRADING ONLY — no real money involved`);
  console.log(`${'═'.repeat(55)}\n`);
}

run().catch(err => {
  console.error('❌ Auto-trade error:', err.message);
  appendLog({ runAt: new Date().toISOString(), action: 'CRASH', error: err.message });
  process.exit(1);
});
