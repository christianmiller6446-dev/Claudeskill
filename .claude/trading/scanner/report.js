// report.js — Generates markdown report files. No API calls, no orders.

const fs   = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, 'logs');

function pad(str, len) { return String(str).padEnd(len); }
function fmt(n)        { return typeof n === 'number' ? n.toFixed(2) : n; }

function generateWeeklyReport({ date, marketHealth, ranked, leaderboard, top3, avoided, account }) {
  const lines = [];
  lines.push(`═══════════════════════════════════════════════════════`);
  lines.push(`  WEEKLY STOCK SCAN — ${date}`);
  lines.push(`  Paper Trading Only | ⛔ Do Not Trade Without Approval`);
  lines.push(`═══════════════════════════════════════════════════════`);
  lines.push(``);
  lines.push(`## ACCOUNT`);
  lines.push(`  Cash:   $${account.cash.toLocaleString()}`);
  lines.push(`  Equity: $${account.equity.toLocaleString()}`);
  lines.push(`  Max risk per trade (1%):  $${(account.cash * 0.01).toFixed(2)}`);
  lines.push(`  Max allocation per stock (10%): $${(account.cash * 0.10).toFixed(2)}`);
  lines.push(``);
  lines.push(`## MARKET CONDITIONS`);
  lines.push(`  SPY: $${ranked.find(r=>r.symbol==='SPY')?.price} | 5d: ${ranked.find(r=>r.symbol==='SPY')?.gain5d}% | vs MA50: ${ranked.find(r=>r.symbol==='SPY')?.aboveMA50 ? '✅ Above' : '❌ Below'}`);
  lines.push(`  QQQ: $${ranked.find(r=>r.symbol==='QQQ')?.price} | 5d: ${ranked.find(r=>r.symbol==='QQQ')?.gain5d}% | vs MA50: ${ranked.find(r=>r.symbol==='QQQ')?.aboveMA50 ? '✅ Above' : '❌ Below'}`);
  lines.push(`  ${marketHealth.reason}`);
  lines.push(``);
  lines.push(`## FULL RANKING (composite score / 100)`);
  lines.push(`  ${'SYMBOL'.padEnd(6)} ${'SCORE'.padEnd(7)} ${'5d%'.padEnd(8)} ${'1d%'.padEnd(8)} ${'VOL/AVG'.padEnd(9)} ${'MA20'.padEnd(6)} ${'MA50'.padEnd(6)} ${'RS/SPY'.padEnd(8)} ${'ATR%'}`);
  lines.push(`  ${'─'.repeat(70)}`);
  for (const r of ranked) {
    lines.push(`  ${r.symbol.padEnd(6)} ${String(r.score).padEnd(7)} ${(r.gain5d+'%').padEnd(8)} ${(r.gain1d+'%').padEnd(8)} ${(r.volRatio+'x').padEnd(9)} ${(r.aboveMA20?'✅':'❌').padEnd(6)} ${(r.aboveMA50?'✅':'❌').padEnd(6)} ${(r.rsVsSPY+'%').padEnd(8)} ${r.atrPct}%`);
  }
  lines.push(``);
  lines.push(`## WEEKLY LEADERBOARD`);
  lines.push(`  🥇 Best Performer (5d):   ${leaderboard.bestPerf?.symbol} +${leaderboard.bestPerf?.gain5d}%`);
  lines.push(`  🚀 Strongest Momentum:    ${leaderboard.bestMoment?.symbol} score: ${leaderboard.bestMoment?.score}/100`);
  lines.push(`  ⚖️  Best Risk/Reward:      ${leaderboard.bestRR?.symbol} ${leaderboard.bestRR?.riskReward}:1`);
  lines.push(`  ⚠️  Avoid (high vol):      ${leaderboard.mostVol?.symbol} ATR: ${leaderboard.mostVol?.atrPct}%`);
  lines.push(``);
  lines.push(`## TOP 3 CANDIDATES FOR NEXT WEEK`);

  if (!marketHealth.healthy) {
    lines.push(`  🚫 Market gate closed — no candidates recommended this week.`);
  } else {
    top3.forEach((item, i) => {
      const { stock: s, filter: f } = item;
      lines.push(``);
      lines.push(`### ${i+1}. ${s.symbol}`);
      lines.push(`  Current price:    $${s.price}`);
      lines.push(`  Weekly gain:      ${s.gain5d}%`);
      lines.push(`  Score:            ${s.score}/100`);
      lines.push(`  Above MA20/MA50:  ${s.aboveMA20?'✅':'❌'} / ${s.aboveMA50?'✅':'❌'}`);
      lines.push(`  Volume vs avg:    ${s.volRatio}x`);
      lines.push(`  RS vs SPY:        ${s.rsVsSPY > 0 ? '+' : ''}${s.rsVsSPY}%`);
      lines.push(`  Volatility (ATR): ${s.atrPct}% of price`);
      lines.push(``);
      lines.push(`  Entry zone:       $${(s.entry * 0.999).toFixed(2)} – $${(s.entry * 1.005).toFixed(2)}`);
      lines.push(`  Stop-loss:        $${s.stop} (${((s.entry-s.stop)/s.entry*100).toFixed(1)}% below entry)`);
      lines.push(`  Take-profit:      $${s.target}`);
      lines.push(`  Risk/Reward:      ${s.riskReward}:1`);
      lines.push(``);
      lines.push(`  Position sizing (paper trade):`);
      lines.push(`    Max shares:     ${f.maxShares} shares`);
      lines.push(`    Position cost:  $${f.positionCost} (${f.pctOfCash}% of cash)`);
      lines.push(`    Dollar at risk: $${f.dollarRisk} (1% rule)`);
      lines.push(`  Confidence:       ${'★'.repeat(s.confidence)}${'☆'.repeat(10-s.confidence)} ${s.confidence}/10`);
      lines.push(`  Paper trade:      ${f.tradeable ? '✅ YES' : '❌ NO — see reasons'}`);
      lines.push(``);
      lines.push(`  Notes:`);
      f.reasons.forEach(r => lines.push(`    ${r}`));
      lines.push(`  ${'─'.repeat(55)}`);
    });
  }

  if (avoided.length > 0) {
    lines.push(``);
    lines.push(`## STOCKS TO AVOID THIS WEEK`);
    avoided.forEach(({ stock: s, filter: f }) => {
      lines.push(`  ❌ ${s.symbol}: ${f.reasons.filter(r=>r.startsWith('❌')).join(' | ')}`);
    });
  }

  lines.push(``);
  lines.push(`═══════════════════════════════════════════════════════`);
  lines.push(`⛔ PAPER TRADING ONLY — No orders placed.`);
  lines.push(`   User approval required before any trade is executed.`);
  lines.push(`═══════════════════════════════════════════════════════`);

  const filename = path.join(LOG_DIR, `weekly-stock-scan-${date}.md`);
  fs.writeFileSync(filename, lines.join('\n'), 'utf8');
  console.log(`\n📄 Report saved: ${filename}`);
  return lines.join('\n');
}

function generateMondayWatchlist({ date, top3, marketHealth, account }) {
  const lines = [];
  lines.push(`═══════════════════════════════════════════════════════`);
  lines.push(`  MONDAY WATCHLIST — ${date}`);
  lines.push(`  Paper Trading Only | ⛔ Do Not Trade Without Approval`);
  lines.push(`═══════════════════════════════════════════════════════`);
  lines.push(``);
  lines.push(`Market gate: ${marketHealth.healthy ? '✅ OPEN' : '🚫 CLOSED'}`);
  lines.push(`Account cash: $${account.cash.toLocaleString()}`);
  lines.push(``);

  if (!marketHealth.healthy) {
    lines.push(`🚫 No trades recommended — market in downtrend.`);
  } else {
    top3.forEach((item, i) => {
      const { stock: s, filter: f } = item;
      lines.push(`## Setup ${i+1}: ${s.symbol}`);
      lines.push(`  Entry:       $${(s.entry * 0.999).toFixed(2)} – $${(s.entry * 1.005).toFixed(2)}`);
      lines.push(`  Stop-loss:   $${s.stop}`);
      lines.push(`  Target:      $${s.target}`);
      lines.push(`  R/R:         ${s.riskReward}:1`);
      lines.push(`  Shares:      ${f.maxShares} (max, based on 1% risk = $${f.dollarRisk})`);
      lines.push(`  Confidence:  ${s.confidence}/10`);
      lines.push(`  ⚠️  Verify earnings before entry`);
      lines.push(``);
    });
  }

  lines.push(`⛔ PAPER TRADING ONLY — No orders placed without your approval.`);

  const filename = path.join(LOG_DIR, `monday-watchlist-${date}.md`);
  fs.writeFileSync(filename, lines.join('\n'), 'utf8');
  console.log(`📄 Watchlist saved: ${filename}`);
  return lines.join('\n');
}

module.exports = { generateWeeklyReport, generateMondayWatchlist };
