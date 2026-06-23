// scanner.js — Main entry point. Read-only. No orders placed.
// ⛔ PAPER TRADING ONLY — This file never calls POST /v2/orders

const { getBars, getSnapshots, getAccount, WATCHLIST } = require('./data.js');
const { scoreStock, rankAll, leaderboard, setQQQ5d }   = require('./rank.js');
const { marketHealthCheck, stockFilters }               = require('./filters.js');
const { generateWeeklyReport, generateMondayWatchlist } = require('./report.js');
const fs   = require('fs');
const path = require('path');

const MODE    = process.argv[2] || 'weekly'; // 'weekly' or 'monday'
const LOG_DIR = path.join(__dirname, 'logs');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

async function run() {
  console.log(`\n🔍 NVDA Trading Bot — Stock Scanner`);
  console.log(`⛔  Paper trading only. No orders will be placed.\n`);

  // 1. Fetch all data
  console.log('📡 Fetching market data...');
  const [barsData, snapshots, account] = await Promise.all([
    getBars(),
    getSnapshots(),
    getAccount()
  ]);
  console.log(`✅ Data received for ${Object.keys(barsData).length} symbols`);
  console.log(`💰 Account cash: $${account.cash.toLocaleString()} (equity: $${account.equity.toLocaleString()})`);

  // 2. Get SPY and QQQ 5d gains for relative strength
  const spyBars  = barsData['SPY']  || [];
  const qqqBars  = barsData['QQQ']  || [];
  const spyCloses = spyBars.map(b => b.c);
  const qqqCloses = qqqBars.map(b => b.c);
  const spy5d = spyCloses.length >= 6
    ? (spyCloses[spyCloses.length-1] - spyCloses[spyCloses.length-6]) / spyCloses[spyCloses.length-6] * 100
    : 0;
  const qqq5d = qqqCloses.length >= 6
    ? (qqqCloses[qqqCloses.length-1] - qqqCloses[qqqCloses.length-6]) / qqqCloses[qqqCloses.length-6] * 100
    : 0;
  setQQQ5d(qqq5d);

  // 3. Score all stocks
  console.log('\n📊 Scoring stocks...');
  const results = [];
  for (const symbol of WATCHLIST) {
    const bars     = barsData[symbol];
    const snapshot = snapshots[symbol];
    if (!bars || bars.length < 25) {
      console.log(`  ⚠️  ${symbol}: insufficient data (${bars?.length || 0} bars)`);
      continue;
    }
    const scored = scoreStock(symbol, bars, snapshot, spy5d, qqq5d);
    if (scored) {
      results.push(scored);
      console.log(`  ${symbol.padEnd(6)} score: ${String(scored.score).padEnd(6)} 5d: ${scored.gain5d}%`);
    }
  }

  // 4. Rank all
  const ranked = rankAll(results);
  const board  = leaderboard(ranked);

  // 5. Market health check
  const spy    = ranked.find(r => r.symbol === 'SPY');
  const qqq    = ranked.find(r => r.symbol === 'QQQ');
  const mktHealth = marketHealthCheck(spy, qqq);
  console.log(`\n🌡️  Market: ${mktHealth.reason}`);

  // 6. Apply stock-level filters
  const nonIndex   = ranked.filter(r => !['SPY','QQQ'].includes(r.symbol));
  const filtered   = nonIndex.map(s => ({ stock: s, filter: stockFilters(s, account.cash) }));
  const tradeable  = filtered.filter(f => f.filter.tradeable);
  const avoided    = filtered.filter(f => !f.filter.tradeable);
  const top3       = tradeable.slice(0, 3);

  // 7. Generate report
  const today = new Date().toISOString().split('T')[0];
  console.log(`\n📝 Generating report...`);

  let report;
  if (MODE === 'monday') {
    report = generateMondayWatchlist({ date: today, top3, marketHealth: mktHealth, account });
  } else {
    report = generateWeeklyReport({ date: today, marketHealth: mktHealth, ranked, leaderboard: board, top3, avoided, account });
  }

  // 8. Append to scan log
  const logEntry = {
    timestamp:   new Date().toISOString(),
    mode:        MODE,
    marketGate:  mktHealth.healthy,
    spy5d:       +spy5d.toFixed(2),
    qqq5d:       +qqq5d.toFixed(2),
    topSymbol:   top3[0]?.stock.symbol || 'none',
    ranked:      ranked.map(r => ({ symbol: r.symbol, score: r.score, gain5d: r.gain5d }))
  };
  const logFile = path.join(LOG_DIR, 'scan-log.json');
  const existing = fs.existsSync(logFile) ? JSON.parse(fs.readFileSync(logFile,'utf8')) : [];
  existing.push(logEntry);
  fs.writeFileSync(logFile, JSON.stringify(existing, null, 2), 'utf8');

  // 9. Print report to console
  console.log('\n' + report);
  console.log('\n✅ Scan complete. No orders placed.');
}

run().catch(err => {
  console.error('❌ Scanner error:', err.message);
  process.exit(1);
});
