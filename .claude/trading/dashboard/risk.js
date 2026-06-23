// risk.js — Risk checks, allocation limits, stop coverage.

const CASH_BASELINE    = 47809.94;
const DAILY_LIMIT_PCT  = 0.03;
const WEEKLY_LIMIT_PCT = 0.06;
const MAX_ALLOC_PCT    = 0.25;
const STARTING_EQUITY  = 50000;

const DAILY_LIMIT  = +(CASH_BASELINE * DAILY_LIMIT_PCT).toFixed(2);   // $1,434.30
const WEEKLY_LIMIT = +(CASH_BASELINE * WEEKLY_LIMIT_PCT).toFixed(2);  // $2,868.60
const MAX_ALLOC    = +(CASH_BASELINE * MAX_ALLOC_PCT).toFixed(2);     // $11,952.49

function calcRisk(account, positions, openOrders, pnl) {
  const { dailyPL, weeklyPL } = pnl;

  const dailyUsed   = Math.min(0, dailyPL);   // negative number = loss
  const weeklyUsed  = Math.min(0, weeklyPL);

  const dailyRemaining  = +(DAILY_LIMIT  + dailyUsed).toFixed(2);   // shrinks as losses grow
  const weeklyRemaining = +(WEEKLY_LIMIT + weeklyUsed).toFixed(2);

  // Per-symbol allocation
  const allocations = {};
  for (const pos of positions) {
    allocations[pos.symbol] = {
      marketValue: +pos.marketValue.toFixed(2),
      pct:         +(pos.marketValue / CASH_BASELINE * 100).toFixed(1),
      overLimit:   pos.marketValue > MAX_ALLOC
    };
  }

  // Stop coverage — for each position, check if there's a trailing_stop sell order
  const stopOrders = openOrders.filter(o => o.type === 'trailing_stop' && o.side === 'sell');
  const coverage = {};
  for (const pos of positions) {
    const stops = stopOrders.filter(o => o.symbol === pos.symbol);
    const coveredQty = stops.reduce((s, o) => s + o.qty, 0);
    const uncovered  = Math.max(0, pos.qty - coveredQty);
    const stopFloor  = stops[0]?.stopPrice || null;
    const hwm        = stops[0]?.hwm || null;
    coverage[pos.symbol] = {
      positionQty: pos.qty,
      coveredQty,
      uncoveredQty: uncovered,
      pct: pos.qty > 0 ? +(coveredQty / pos.qty * 100).toFixed(0) : 0,
      fullyProtected: uncovered === 0,
      stopFloor,
      hwm
    };
  }

  const totalShares  = positions.reduce((s, p) => s + p.qty, 0);
  const coveredTotal = Object.values(coverage).reduce((s, c) => s + c.coveredQty, 0);
  const overallCoveragePct = totalShares > 0
    ? +(coveredTotal / totalShares * 100).toFixed(0)
    : 100;

  // Ladder orders by symbol
  const ladders = {};
  for (const o of openOrders.filter(o => o.type === 'limit' && o.side === 'buy')) {
    if (!ladders[o.symbol]) ladders[o.symbol] = [];
    ladders[o.symbol].push({ qty: o.qty, price: o.limitPrice, id: o.id });
  }

  // Margin check — always $0 for cash account
  const marginUsed = Math.max(0, positions.reduce((s, p) => s + p.marketValue, 0) - account.cash);

  // Warnings
  const warnings = [];
  if (dailyRemaining  <= 300)  warnings.push(`🚨 Daily loss limit ${((DAILY_LIMIT - dailyRemaining)/DAILY_LIMIT*100).toFixed(0)}% consumed ($${Math.abs(dailyUsed)} of $${DAILY_LIMIT})`);
  if (weeklyRemaining <= 500)  warnings.push(`🚨 Weekly loss limit ${((WEEKLY_LIMIT - weeklyRemaining)/WEEKLY_LIMIT*100).toFixed(0)}% consumed`);
  for (const [sym, a] of Object.entries(allocations)) {
    if (a.overLimit) warnings.push(`🚨 ${sym} allocation $${a.marketValue} exceeds $${MAX_ALLOC} cap`);
  }
  for (const [sym, c] of Object.entries(coverage)) {
    if (!c.fullyProtected && c.positionQty > 0) warnings.push(`⚠️ ${sym} has ${c.uncoveredQty} unprotected shares`);
  }

  return {
    limits: { daily: DAILY_LIMIT, weekly: WEEKLY_LIMIT, maxAlloc: MAX_ALLOC },
    used:   { daily: Math.abs(dailyUsed), weekly: Math.abs(weeklyUsed) },
    remaining: { daily: dailyRemaining, weekly: weeklyRemaining },
    allocations,
    coverage,
    overallCoveragePct,
    ladders,
    marginUsed: +marginUsed.toFixed(2),
    warnings
  };
}

module.exports = { calcRisk, CASH_BASELINE, STARTING_EQUITY, DAILY_LIMIT, WEEKLY_LIMIT, MAX_ALLOC };
