// render.js — Generates dashboard.md and dashboard.html

const fs   = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, 'logs');

function pct(n)  { return (n >= 0 ? '+' : '') + n.toFixed(2) + '%'; }
function usd(n)  { return (n >= 0 ? '+$' : '-$') + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function abs(n)  { return '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function bar(pct, max, filled = '█', empty = '░') {
  const w = 20;
  const f = Math.round(Math.min(pct / max, 1) * w);
  return filled.repeat(f) + empty.repeat(w - f) + ` ${pct.toFixed(0)}%`;
}

function generateMarkdown(data) {
  const { account, positions, openOrders, metrics, risk, health, readiness, pnl, trips, date } = data;
  const STARTING = 50000;
  const lines = [];

  lines.push(`# Trading Performance Dashboard`);
  lines.push(`**Updated:** ${date} | Paper Trading Only | ⛔ No orders placed by this report`);
  lines.push(``);

  // ── ACCOUNT OVERVIEW ──────────────────────────────────────
  lines.push(`## Account Overview`);
  lines.push(`| | |`);
  lines.push(`|---|---|`);
  lines.push(`| Equity | ${abs(account.equity)} |`);
  lines.push(`| Cash | ${abs(account.cash)} |`);
  lines.push(`| Buying Power | ${abs(account.buyingPower)} (display only) |`);
  lines.push(`| Total Return | ${usd(account.equity - STARTING)} (${pct((account.equity - STARTING)/STARTING*100)}) |`);
  lines.push(`| Daily P&L | ${usd(pnl.dailyPL)} |`);
  lines.push(`| Weekly P&L | ${usd(pnl.weeklyPL)} |`);
  lines.push(`| Monthly P&L | ${usd(pnl.monthlyPL)} |`);
  lines.push(`| Unrealized P&L | ${usd(positions.reduce((s,p)=>s+p.unrealizedPL,0))} |`);
  lines.push(`| Realized P&L | ${usd(metrics.totalRealizedPL)} |`);
  lines.push(``);

  // ── POSITIONS ─────────────────────────────────────────────
  lines.push(`## Open Positions`);
  if (!positions.length) {
    lines.push(`_No open positions._`);
  } else {
    lines.push(`| Symbol | Shares | Avg Entry | Current | Mkt Value | Unreal P&L | Stop | Risk% |`);
    lines.push(`|---|---|---|---|---|---|---|---|`);
    for (const p of positions) {
      const cov = risk.coverage[p.symbol];
      const stopStr = cov?.fullyProtected
        ? `✅ $${cov.stopFloor?.toFixed(2) || '?'}`
        : `⚠️ ${cov?.uncoveredQty} uncovered`;
      const riskPct = (p.marketValue / risk.limits.maxAlloc * 100).toFixed(0);
      lines.push(`| **${p.symbol}** | ${p.qty} | $${p.avgEntry.toFixed(2)} | $${p.currentPrice.toFixed(2)} | ${abs(p.marketValue)} | ${usd(p.unrealizedPL)} (${pct(p.unrealizedPct)}) | ${stopStr} | ${riskPct}% |`);
    }
  }
  lines.push(``);

  // ── OPEN ORDERS ───────────────────────────────────────────
  lines.push(`## Open Orders`);
  const trailing = openOrders.filter(o => o.type === 'trailing_stop');
  const ladders  = openOrders.filter(o => o.type === 'limit' && o.side === 'buy');
  const sells    = openOrders.filter(o => o.side === 'sell' && o.type !== 'trailing_stop');
  const buys     = openOrders.filter(o => o.side === 'buy'  && o.type !== 'limit');

  function orderTable(orders, label) {
    if (!orders.length) return;
    lines.push(`### ${label}`);
    lines.push(`| Symbol | Type | Side | Qty | Price | Status | Created |`);
    lines.push(`|---|---|---|---|---|---|---|`);
    for (const o of orders) {
      const price = o.trailPct ? `${o.trailPct}% trail (floor $${o.stopPrice?.toFixed(2)||'?'})` :
                    o.limitPrice ? `$${o.limitPrice.toFixed(2)}` : '—';
      const created = o.createdAt ? o.createdAt.split('T')[0] : '—';
      lines.push(`| ${o.symbol} | ${o.type} | ${o.side} | ${o.qty} | ${price} | ${o.status} | ${created} |`);
    }
    lines.push(``);
  }

  orderTable(trailing, 'Trailing Stops');
  orderTable(ladders,  'Ladder Buys');
  orderTable(buys,     'Other Buy Orders');
  orderTable(sells,    'Other Sell Orders');
  if (!openOrders.length) lines.push(`_No open orders._\n`);

  // ── STRATEGY PERFORMANCE ──────────────────────────────────
  lines.push(`## Strategy Performance`);
  lines.push(`| Metric | Value |`);
  lines.push(`|---|---|`);
  lines.push(`| Total Closed Trades | ${metrics.totalTrades} |`);
  lines.push(`| Winners / Losers | ${metrics.winners} / ${metrics.losers} |`);
  lines.push(`| Win Rate | ${metrics.winRate}% |`);
  lines.push(`| Avg Winner | ${abs(metrics.avgWinner)} |`);
  lines.push(`| Avg Loser | ${abs(metrics.avgLoser)} |`);
  lines.push(`| Profit Factor | ${metrics.profitFactor} |`);
  lines.push(`| Expectancy | ${usd(metrics.expectancy)} per trade |`);
  lines.push(`| Risk/Reward | ${metrics.rrRatio}:1 |`);
  lines.push(`| Largest Winner | ${abs(metrics.largestWinner)} |`);
  lines.push(`| Largest Loser | ${abs(Math.abs(metrics.largestLoser))} |`);
  lines.push(`| Avg Hold Time | ${metrics.avgHoldHours}h |`);
  lines.push(`| Max Drawdown | ${metrics.maxDrawdown}% |`);
  lines.push(`| Sharpe Ratio | ${metrics.sharpe !== null ? metrics.sharpe : 'Needs 10+ days'} |`);
  lines.push(``);

  // ── RISK MANAGEMENT ───────────────────────────────────────
  lines.push(`## Risk Management`);
  lines.push(`| Check | Value | Limit | Status |`);
  lines.push(`|---|---|---|---|`);
  lines.push(`| Daily Loss Used | ${abs(risk.used.daily)} | $${risk.limits.daily} | ${risk.remaining.daily > 300 ? '✅' : '🚨'} $${risk.remaining.daily} remaining |`);
  lines.push(`| Weekly Loss Used | ${abs(risk.used.weekly)} | $${risk.limits.weekly} | ${risk.remaining.weekly > 500 ? '✅' : '🚨'} $${risk.remaining.weekly} remaining |`);
  lines.push(`| Stop Coverage | ${risk.overallCoveragePct}% | 100% | ${risk.overallCoveragePct >= 100 ? '✅' : '⚠️ Gap'} |`);
  lines.push(`| Margin Used | ${abs(risk.marginUsed)} | $0 | ${risk.marginUsed === 0 ? '✅ Cash only' : '🚨 Margin detected'} |`);
  for (const [sym, alloc] of Object.entries(risk.allocations)) {
    lines.push(`| ${sym} Allocation | ${abs(alloc.marketValue)} (${alloc.pct}%) | $${risk.limits.maxAlloc} | ${alloc.overLimit ? '🚨 OVER LIMIT' : '✅ Within cap'} |`);
  }
  if (risk.warnings.length) {
    lines.push(``);
    lines.push(`**Warnings:**`);
    risk.warnings.forEach(w => lines.push(`- ${w}`));
  }
  lines.push(``);

  // ── AUTOMATION HEALTH ─────────────────────────────────────
  lines.push(`## Automation Health`);
  lines.push(`| Task | Registered |`);
  lines.push(`|---|---|`);
  for (const t of health.taskStatus) {
    lines.push(`| ${t.taskId} | ${t.registered ? '✅' : '❌ Missing'} |`);
  }
  lines.push(``);
  lines.push(`| | |`);
  lines.push(`|---|---|`);
  lines.push(`| API Errors Today | ${health.errorsToday} |`);
  lines.push(`| Scheduler Health Score | ${health.healthScore}/100 |`);
  lines.push(`| Last Scanner Run | ${health.lastScanDate || 'No scan logged yet'} |`);
  if (health.warnings.length) {
    lines.push(``);
    health.warnings.forEach(w => lines.push(`- ${w}`));
  }
  lines.push(``);

  // ── READINESS SCORE ───────────────────────────────────────
  lines.push(`## Live Trading Readiness`);
  lines.push(`\`\`\``);
  lines.push(`  Score: ${readiness.total}/100 — ${readiness.level}`);
  lines.push(`  ${bar(readiness.total, 100)}`);
  lines.push(``);
  lines.push(`  Infrastructure  (${readiness.infraTotal}/30)`);
  for (const [k, v] of Object.entries(readiness.breakdown).slice(0, 3)) {
    lines.push(`    ${k.padEnd(22)} ${String(v.pts).padStart(2)}/${v.max}  ${v.note}`);
  }
  lines.push(``);
  lines.push(`  Risk Management (${readiness.riskTotal}/30)`);
  for (const [k, v] of Object.entries(readiness.breakdown).slice(3, 6)) {
    lines.push(`    ${k.padEnd(22)} ${String(v.pts).padStart(2)}/${v.max}  ${v.note}`);
  }
  lines.push(``);
  lines.push(`  Strategy        (${readiness.stratTotal}/40)`);
  for (const [k, v] of Object.entries(readiness.breakdown).slice(6)) {
    lines.push(`    ${k.padEnd(22)} ${String(v.pts).padStart(2)}/${v.max}  ${v.note}`);
  }
  lines.push(`\`\`\``);
  lines.push(``);

  // ── WEEKLY SUMMARY ────────────────────────────────────────
  lines.push(`## Weekly Summary`);

  const biggestImprovement = readiness.total >= 60
    ? 'Readiness score now Controlled Live Test Eligible'
    : readiness.infraTotal === 30
    ? 'Full infrastructure operational (30/30)'
    : 'Scheduler and API layer stable';

  const biggestConcern = metrics.totalTrades < 5
    ? 'Not enough closed trades to validate strategy statistically'
    : metrics.profitFactor < 1.0
    ? 'Profit factor below 1.0 — strategy not yet profitable'
    : risk.overallCoveragePct < 100
    ? 'Stop protection gap — some shares uncovered'
    : 'Continue accumulating trade history';

  const trend = pnl.weeklyPL >= 0 ? '📈 Positive' : '📉 Negative';

  const recommendation = metrics.totalTrades < 10
    ? 'Continue paper trading — need at least 10 closed trades before live evaluation'
    : readiness.total >= 80
    ? 'Consider requesting live API keys for a small live test'
    : `Target readiness score 80+ before live trading (currently ${readiness.total})`;

  const nextPriority = metrics.totalTrades < 5
    ? 'Let ladder orders fill to generate more closed trade data'
    : risk.overallCoveragePct < 100
    ? 'Fix stop coverage gap immediately'
    : 'Monitor for 2 more weeks, aim for 20+ closed trades';

  lines.push(`| | |`);
  lines.push(`|---|---|`);
  lines.push(`| Biggest Improvement | ${biggestImprovement} |`);
  lines.push(`| Biggest Concern | ${biggestConcern} |`);
  lines.push(`| Performance Trend | ${trend} (${usd(pnl.weeklyPL)} this week) |`);
  lines.push(`| Recommendation | ${recommendation} |`);
  lines.push(`| Next Priority | ${nextPriority} |`);
  lines.push(``);

  lines.push(`---`);
  lines.push(`⛔ PAPER TRADING ONLY — No orders placed by this dashboard. User approval required for all trades.`);

  return lines.join('\n');
}

function generateHTML(data) {
  const { account, positions, openOrders, metrics, risk, health, readiness, pnl, date } = data;
  const generatedAtISO = new Date().toISOString();
  const STARTING = 50000;
  const totalReturn = account.equity - STARTING;
  const totalReturnPct = (totalReturn / STARTING * 100).toFixed(2);
  const unrealizedPL = positions.reduce((s, p) => s + p.unrealizedPL, 0);

  function color(n) { return n >= 0 ? '#00e676' : '#ff5252'; }
  function fmt(n, prefix='$') {
    const sign = n >= 0 ? '+' : '-';
    return `${sign}${prefix}${Math.abs(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  }
  function readyColor(score) {
    return score >= 80 ? '#00e676' : score >= 60 ? '#ffeb3b' : score >= 40 ? '#ff9800' : '#ff5252';
  }

  const posRows = positions.map(p => {
    const cov = risk.coverage[p.symbol];
    const stopCell = cov?.fullyProtected
      ? `<span style="color:#00e676">✅ $${cov.stopFloor?.toFixed(2)||'?'}</span>`
      : `<span style="color:#ff5252">⚠️ ${cov?.uncoveredQty} uncovered</span>`;
    return `<tr>
      <td><b>${p.symbol}</b></td>
      <td>${p.qty}</td>
      <td>$${p.avgEntry.toFixed(2)}</td>
      <td>$${p.currentPrice.toFixed(2)}</td>
      <td>$${p.marketValue.toFixed(2)}</td>
      <td style="color:${color(p.unrealizedPL)}">${fmt(p.unrealizedPL)} (${p.unrealizedPct.toFixed(2)}%)</td>
      <td>${stopCell}</td>
      <td>${(p.marketValue/risk.limits.maxAlloc*100).toFixed(0)}%</td>
    </tr>`;
  }).join('');

  const orderRows = openOrders.map(o => {
    const price = o.trailPct ? `${o.trailPct}% trail` : o.limitPrice ? `$${o.limitPrice.toFixed(2)}` : '—';
    const typeTag =
      o.type === 'trailing_stop' ? `<span class="tag tag-stop">STOP</span>` :
      o.side === 'buy' && o.type === 'limit' ? `<span class="tag tag-ladder">LADDER</span>` :
      o.side === 'buy' ? `<span class="tag tag-buy">BUY</span>` :
      `<span class="tag tag-sell">SELL</span>`;
    return `<tr>
      <td>${typeTag}</td>
      <td><b>${o.symbol}</b></td>
      <td>${o.qty}</td>
      <td>${price}</td>
      <td>${o.status}</td>
      <td>${(o.createdAt||'').split('T')[0]}</td>
    </tr>`;
  }).join('');

  const taskRows = health.taskStatus.map(t =>
    `<tr><td>${t.taskId}</td><td>${t.registered ? '<span style="color:#00e676">✅</span>' : '<span style="color:#ff5252">❌</span>'}</td></tr>`
  ).join('');

  const bdRows = Object.entries(readiness.breakdown).map(([k, v]) => {
    const pct = v.pts / v.max * 100;
    return `<tr>
      <td style="font-size:12px">${k}</td>
      <td>${v.pts}/${v.max}</td>
      <td><div class="mini-bar"><div style="width:${pct}%;background:${pct>=80?'#00e676':pct>=50?'#ffeb3b':'#ff5252'}"></div></div></td>
      <td style="font-size:11px;color:#aaa">${v.note}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="refresh" content="60">
<title>Trading Dashboard — ${date}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#0d0d0d;color:#e0e0e0;font-family:'Courier New',monospace;padding:20px;font-size:13px}
  h1{color:#fff;font-size:18px;margin-bottom:4px}
  h2{color:#90caf9;font-size:14px;margin:24px 0 8px;border-bottom:1px solid #222;padding-bottom:4px}
  h3{color:#aaa;font-size:12px;margin:12px 0 6px}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-bottom:8px}
  .card{background:#1a1a1a;border:1px solid #2a2a2a;border-radius:6px;padding:12px}
  .card .label{color:#888;font-size:11px;text-transform:uppercase;letter-spacing:.5px}
  .card .value{font-size:18px;font-weight:bold;margin-top:4px}
  .green{color:#00e676} .red{color:#ff5252} .yellow{color:#ffeb3b} .orange{color:#ff9800}
  table{width:100%;border-collapse:collapse;margin-bottom:16px}
  th{background:#1e1e1e;color:#90caf9;padding:6px 10px;text-align:left;font-size:11px}
  td{padding:5px 10px;border-bottom:1px solid #1a1a1a;font-size:12px}
  tr:hover td{background:#161616}
  .tag{display:inline-block;padding:2px 6px;border-radius:3px;font-size:10px;font-weight:bold}
  .tag-stop{background:#1a237e;color:#90caf9}
  .tag-ladder{background:#1b5e20;color:#69f0ae}
  .tag-buy{background:#1b5e20;color:#a5d6a7}
  .tag-sell{background:#4e0000;color:#ef9a9a}
  .score-ring{display:flex;align-items:center;gap:20px;margin:12px 0}
  .score-num{font-size:48px;font-weight:bold}
  .score-label{font-size:16px;margin-top:4px}
  .progress{height:8px;background:#222;border-radius:4px;overflow:hidden;margin:4px 0}
  .progress-fill{height:100%;border-radius:4px;transition:width .3s}
  .mini-bar{height:6px;background:#222;border-radius:3px;overflow:hidden;width:80px}
  .mini-bar div{height:100%;border-radius:3px}
  .warn-box{background:#1a1a00;border:1px solid #ff9800;border-radius:4px;padding:8px 12px;margin:8px 0;font-size:12px;color:#ffeb3b}
  .err-box{background:#1a0000;border:1px solid #ff5252;border-radius:4px;padding:8px 12px;margin:8px 0;font-size:12px;color:#ff5252}
  .footer{margin-top:20px;color:#444;font-size:11px;border-top:1px solid #222;padding-top:8px}
  .refresh-note{color:#555;font-size:10px;margin-top:4px}
</style>
</head>
<body>

<h1>Trading Performance Dashboard</h1>
<div id="updated-banner" style="background:#0d2818;border:1px solid #00e676;border-radius:6px;padding:10px 14px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
  <div>
    <div style="color:#00e676;font-size:13px;font-weight:bold" id="updated-local">Last updated: —</div>
    <div style="color:#666;font-size:11px;margin-top:2px">Paper Trading Only | Page auto-refreshes every 60s</div>
  </div>
  <div style="color:#aaa;font-size:12px" id="updated-ago">—</div>
</div>
<script>
  const generatedAt = new Date(${JSON.stringify(generatedAtISO)});
  document.getElementById('updated-local').textContent =
    'Last updated: ' + generatedAt.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  function renderAgo() {
    const mins = Math.round((Date.now() - generatedAt.getTime()) / 60000);
    const el = document.getElementById('updated-ago');
    if (!el) return;
    if (mins < 1) el.textContent = 'just now';
    else if (mins < 60) el.textContent = mins + ' min ago';
    else el.textContent = Math.round(mins / 60) + ' hr ago';
  }
  renderAgo();
  setInterval(renderAgo, 30000);
</script>

<!-- ACCOUNT OVERVIEW -->
<h2>Account Overview</h2>
<div class="grid">
  <div class="card"><div class="label">Equity</div><div class="value">$${account.equity.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</div></div>
  <div class="card"><div class="label">Cash</div><div class="value">$${account.cash.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</div></div>
  <div class="card"><div class="label">Total Return</div><div class="value" style="color:${color(totalReturn)}">${fmt(totalReturn)} (${totalReturnPct}%)</div></div>
  <div class="card"><div class="label">Daily P&L</div><div class="value" style="color:${color(pnl.dailyPL)}">${fmt(pnl.dailyPL)}</div></div>
  <div class="card"><div class="label">Weekly P&L</div><div class="value" style="color:${color(pnl.weeklyPL)}">${fmt(pnl.weeklyPL)}</div></div>
  <div class="card"><div class="label">Monthly P&L</div><div class="value" style="color:${color(pnl.monthlyPL)}">${fmt(pnl.monthlyPL)}</div></div>
  <div class="card"><div class="label">Unrealized P&L</div><div class="value" style="color:${color(unrealizedPL)}">${fmt(unrealizedPL)}</div></div>
  <div class="card"><div class="label">Realized P&L</div><div class="value" style="color:${color(metrics.totalRealizedPL)}">${fmt(metrics.totalRealizedPL)}</div></div>
</div>

<!-- POSITIONS -->
<h2>Open Positions</h2>
${positions.length ? `<table>
<tr><th>Symbol</th><th>Shares</th><th>Avg Entry</th><th>Current</th><th>Mkt Value</th><th>Unreal P&L</th><th>Stop</th><th>Risk%</th></tr>
${posRows}
</table>` : '<div style="color:#555">No open positions.</div>'}

<!-- OPEN ORDERS -->
<h2>Open Orders</h2>
${openOrders.length ? `<table>
<tr><th>Type</th><th>Symbol</th><th>Qty</th><th>Price</th><th>Status</th><th>Created</th></tr>
${orderRows}
</table>` : '<div style="color:#555">No open orders.</div>'}

<!-- STRATEGY PERFORMANCE -->
<h2>Strategy Performance</h2>
<div class="grid">
  <div class="card"><div class="label">Total Trades</div><div class="value">${metrics.totalTrades}</div></div>
  <div class="card"><div class="label">Win Rate</div><div class="value ${metrics.winRate>=50?'green':metrics.winRate>=40?'yellow':'red'}">${metrics.winRate}%</div></div>
  <div class="card"><div class="label">Profit Factor</div><div class="value ${metrics.profitFactor>=1.5?'green':metrics.profitFactor>=1?'yellow':'red'}">${metrics.profitFactor}</div></div>
  <div class="card"><div class="label">Expectancy</div><div class="value" style="color:${color(metrics.expectancy)}">${fmt(metrics.expectancy)}</div></div>
  <div class="card"><div class="label">Avg Winner</div><div class="value green">${metrics.avgWinner>0?'$'+metrics.avgWinner:'—'}</div></div>
  <div class="card"><div class="label">Avg Loser</div><div class="value red">${metrics.avgLoser>0?'-$'+metrics.avgLoser:'—'}</div></div>
  <div class="card"><div class="label">Max Drawdown</div><div class="value ${metrics.maxDrawdown<=5?'green':metrics.maxDrawdown<=10?'yellow':'red'}">${metrics.maxDrawdown}%</div></div>
  <div class="card"><div class="label">Sharpe Ratio</div><div class="value">${metrics.sharpe!==null?metrics.sharpe:'Needs 10+ days'}</div></div>
  <div class="card"><div class="label">Largest Winner</div><div class="value green">${metrics.largestWinner>0?'$'+metrics.largestWinner:'—'}</div></div>
  <div class="card"><div class="label">Largest Loser</div><div class="value red">${Math.abs(metrics.largestLoser)>0?'-$'+Math.abs(metrics.largestLoser):'—'}</div></div>
  <div class="card"><div class="label">R/R Ratio</div><div class="value">${metrics.rrRatio}:1</div></div>
  <div class="card"><div class="label">Avg Hold Time</div><div class="value">${metrics.avgHoldHours}h</div></div>
</div>

<!-- RISK MANAGEMENT -->
<h2>Risk Management</h2>
<div class="grid">
  <div class="card">
    <div class="label">Daily Loss Limit</div>
    <div class="value">$${risk.limits.daily}</div>
    <div class="progress" style="margin-top:6px"><div class="progress-fill" style="width:${Math.min(risk.used.daily/risk.limits.daily*100,100)}%;background:${risk.used.daily/risk.limits.daily>.8?'#ff5252':'#ff9800'}"></div></div>
    <div style="color:#888;font-size:11px">$${risk.remaining.daily} remaining</div>
  </div>
  <div class="card">
    <div class="label">Weekly Loss Limit</div>
    <div class="value">$${risk.limits.weekly}</div>
    <div class="progress" style="margin-top:6px"><div class="progress-fill" style="width:${Math.min(risk.used.weekly/risk.limits.weekly*100,100)}%;background:${risk.used.weekly/risk.limits.weekly>.8?'#ff5252':'#ff9800'}"></div></div>
    <div style="color:#888;font-size:11px">$${risk.remaining.weekly} remaining</div>
  </div>
  <div class="card">
    <div class="label">Stop Coverage</div>
    <div class="value ${risk.overallCoveragePct>=100?'green':'red'}">${risk.overallCoveragePct}%</div>
    <div class="progress" style="margin-top:6px"><div class="progress-fill" style="width:${risk.overallCoveragePct}%;background:${risk.overallCoveragePct>=100?'#00e676':'#ff5252'}"></div></div>
  </div>
  <div class="card">
    <div class="label">Margin Used</div>
    <div class="value ${risk.marginUsed===0?'green':'red'}">$${risk.marginUsed}</div>
    <div style="color:#888;font-size:11px">${risk.marginUsed===0?'Cash only ✅':'⚠️ Check margin'}</div>
  </div>
</div>
${Object.entries(risk.allocations).map(([sym,a])=>`
<div style="margin:6px 0">
  <span style="color:#aaa;font-size:12px">${sym} allocation: </span>
  <span style="${a.overLimit?'color:#ff5252':'color:#00e676'}">${a.pct}% ($${a.marketValue}) / 25% cap</span>
  <div class="progress" style="margin-top:3px;max-width:300px"><div class="progress-fill" style="width:${Math.min(a.pct,100)}%;background:${a.overLimit?'#ff5252':'#00e676'}"></div></div>
</div>`).join('')}
${risk.warnings.map(w=>`<div class="${w.startsWith('🚨')?'err-box':'warn-box'}">${w}</div>`).join('')}

<!-- AUTOMATION HEALTH -->
<h2>Automation Health</h2>
<div style="display:flex;gap:20px;align-items:flex-start;flex-wrap:wrap">
<table style="max-width:400px">
<tr><th>Task</th><th>Status</th></tr>
${taskRows}
</table>
<div>
  <div class="card" style="min-width:200px">
    <div class="label">Scheduler Health</div>
    <div class="value ${health.healthScore>=80?'green':health.healthScore>=50?'yellow':'red'}">${health.healthScore}/100</div>
  </div>
  <div style="margin-top:8px;font-size:12px;color:#888">API Errors Today: <span style="color:${health.errorsToday===0?'#00e676':'#ff5252'}">${health.errorsToday}</span></div>
  <div style="font-size:12px;color:#888">Last Scan: ${health.lastScanDate||'none'}</div>
  ${health.warnings.map(w=>`<div class="warn-box" style="margin-top:6px">${w}</div>`).join('')}
</div>
</div>

<!-- READINESS SCORE -->
<h2>Live Trading Readiness</h2>
<div style="display:flex;gap:30px;flex-wrap:wrap;align-items:flex-start">
<div class="score-ring">
  <div>
    <div class="score-num" style="color:${readyColor(readiness.total)}">${readiness.total}</div>
    <div style="color:#555">/ 100</div>
  </div>
  <div>
    <div class="score-label" style="color:${readyColor(readiness.total)}">${readiness.level}</div>
    <div class="progress" style="width:200px;margin-top:8px"><div class="progress-fill" style="width:${readiness.total}%;background:${readyColor(readiness.total)}"></div></div>
    <div style="font-size:11px;color:#555;margin-top:4px">Infra: ${readiness.infraTotal}/30 | Risk: ${readiness.riskTotal}/30 | Strategy: ${readiness.stratTotal}/40</div>
  </div>
</div>
<table style="max-width:500px">
<tr><th>Category</th><th>Score</th><th>Bar</th><th>Note</th></tr>
${bdRows}
</table>
</div>

<div class="footer">
  ⛔ PAPER TRADING ONLY — No orders placed by this dashboard. All trades require user approval.
  <div class="refresh-note">Page auto-refreshes every 60 seconds.</div>
</div>

</body>
</html>`;
}

function save(data, date) {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

  const md   = generateMarkdown(data);
  const html = generateHTML(data);

  fs.writeFileSync(path.join(LOG_DIR, 'dashboard.md'),   md,   'utf8');
  fs.writeFileSync(path.join(LOG_DIR, 'dashboard.html'), html, 'utf8');

  console.log(`  📄 dashboard.md saved`);
  console.log(`  🌐 dashboard.html saved`);

  return { md, html };
}

module.exports = { save };
