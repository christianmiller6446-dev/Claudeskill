// dashboard.js — Main entry point. Orchestrates all modules.
// ⛔ PAPER TRADING ONLY — Read-only. No orders placed.

const fetch    = require('./fetch.js');
const metrics  = require('./metrics.js');
const risk     = require('./risk.js');
const health   = require('./health.js');
const readiness = require('./readiness.js');
const render   = require('./render.js');
const fs       = require('fs');
const path     = require('path');

const LOG_DIR = path.join(__dirname, 'logs');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

async function run() {
  const date = new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
  console.log(`\n📊 Trading Performance Dashboard`);
  console.log(`⛔  Paper trading only. No orders placed.\n`);

  // ── 1. Fetch all data ──────────────────────────────────────
  console.log('📡 Fetching data...');
  const [account, positions, openOrders, closedOrders, fills, history] = await Promise.all([
    fetch.getAccount(),
    fetch.getPositions(),
    fetch.getOpenOrders(),
    fetch.getClosedOrders(),
    fetch.getFills(),
    fetch.getPortfolioHistory()
  ]);
  const apiErrors = fetch.getApiErrors();
  console.log(`  ✅ Account | ${positions.length} position(s) | ${openOrders.length} open order(s) | ${fills.length} fill(s) | ${history.length} history days`);

  // ── 2. Calculate metrics ───────────────────────────────────
  console.log('🔢 Calculating metrics...');
  const trips       = metrics.buildRoundTrips(fills);
  const perf        = metrics.calcMetrics(trips, history);
  const pnl         = metrics.calcPnLPeriods(history, account.equity);
  console.log(`  ✅ ${trips.length} closed round-trip trades`);

  // ── 3. Risk assessment ─────────────────────────────────────
  console.log('⚖️  Running risk checks...');
  const riskData    = risk.calcRisk(account, positions, openOrders, pnl);
  if (riskData.warnings.length) {
    riskData.warnings.forEach(w => console.log(`  ${w}`));
  } else {
    console.log(`  ✅ All risk checks passed`);
  }

  // ── 4. Scheduler health ────────────────────────────────────
  console.log('🤖 Checking automation health...');
  const healthData  = health.getSchedulerHealth(apiErrors);
  console.log(`  ✅ ${healthData.registeredCount}/${healthData.expectedTasks} tasks registered | ${healthData.errorsToday} API errors today`);

  // ── 5. Readiness score ─────────────────────────────────────
  console.log('🎯 Calculating readiness score...');
  const readinessData = readiness.calcReadiness(healthData, riskData, perf, history);
  console.log(`  ✅ Score: ${readinessData.total}/100 — ${readinessData.level}`);

  // ── 6. Persist data ────────────────────────────────────────
  const snapshot = {
    generatedAt: new Date().toISOString(),
    account,
    pnl,
    positionCount: positions.length,
    openOrderCount: openOrders.length,
    closedTradeCount: trips.length,
    metrics: perf,
    risk: {
      warnings: riskData.warnings,
      overallCoveragePct: riskData.overallCoveragePct,
      remaining: riskData.remaining
    },
    health: {
      registeredCount: healthData.registeredCount,
      errorsToday: healthData.errorsToday,
      healthScore: healthData.healthScore
    },
    readiness: {
      total: readinessData.total,
      level: readinessData.level,
      infraTotal: readinessData.infraTotal,
      riskTotal: readinessData.riskTotal,
      stratTotal: readinessData.stratTotal
    }
  };

  // dashboard.json — latest snapshot
  fs.writeFileSync(path.join(LOG_DIR, 'dashboard.json'), JSON.stringify(snapshot, null, 2), 'utf8');

  // performance.json — append-only history
  const perfFile = path.join(LOG_DIR, 'performance.json');
  const perfHistory = fs.existsSync(perfFile)
    ? JSON.parse(fs.readFileSync(perfFile, 'utf8'))
    : [];
  // Only append if last entry is not from today
  const today = new Date().toISOString().split('T')[0];
  const lastEntry = perfHistory[perfHistory.length - 1];
  if (!lastEntry || !lastEntry.generatedAt?.startsWith(today)) {
    perfHistory.push(snapshot);
    fs.writeFileSync(perfFile, JSON.stringify(perfHistory, null, 2), 'utf8');
    console.log(`  📈 Appended to performance.json (${perfHistory.length} entries)`);
  } else {
    // Update today's entry
    perfHistory[perfHistory.length - 1] = snapshot;
    fs.writeFileSync(perfFile, JSON.stringify(perfHistory, null, 2), 'utf8');
    console.log(`  📈 Updated today's entry in performance.json`);
  }

  // ── 7. Render dashboard ────────────────────────────────────
  console.log('📝 Rendering dashboard...');
  render.save({
    account, positions, openOrders, closedOrders,
    metrics: perf, risk: riskData, health: healthData,
    readiness: readinessData, pnl, trips, date
  }, today);

  // ── 8. Print summary to console ───────────────────────────
  console.log(`
═══════════════════════════════════════════════
  DASHBOARD SUMMARY — ${today}
═══════════════════════════════════════════════
  Equity:       $${account.equity.toLocaleString()}
  Daily P&L:    ${pnl.dailyPL >= 0 ? '+' : ''}$${pnl.dailyPL}
  Weekly P&L:   ${pnl.weeklyPL >= 0 ? '+' : ''}$${pnl.weeklyPL}
  Positions:    ${positions.map(p=>`${p.symbol} x${p.qty}`).join(', ') || 'none'}
  Trades:       ${perf.totalTrades} closed | Win: ${perf.winRate}% | PF: ${perf.profitFactor}
  Stop cover:   ${riskData.overallCoveragePct}%
  Readiness:    ${readinessData.total}/100 — ${readinessData.level}
  Warnings:     ${riskData.warnings.length + healthData.warnings.length || '✅ none'}
═══════════════════════════════════════════════
  Output:
    dashboard.html  ← open in browser
    dashboard.md    ← markdown report
    dashboard.json  ← latest snapshot
    performance.json ← historical data
═══════════════════════════════════════════════`);
}

run().catch(err => {
  console.error('❌ Dashboard error:', err.message);
  process.exit(1);
});
