// filters.js — Safety filters. Returns pass/fail + reason for each stock.

function marketHealthCheck(spy, qqq) {
  const spyHealthy = spy.aboveMA50;
  const qqqHealthy = qqq.aboveMA50;
  const bothDown   = !spyHealthy && !qqqHealthy;
  return {
    healthy: !bothDown,
    spyAboveMA50: spyHealthy,
    qqqAboveMA50: qqqHealthy,
    reason: bothDown
      ? '🚫 MARKET GATE CLOSED — SPY and QQQ both below 50-day MA. No new entries.'
      : '✅ MARKET GATE OPEN — new entries permitted.'
  };
}

function stockFilters(stock, accountCash) {
  const reasons = [];
  let tradeable = true;

  // Overextension filter
  if (stock.overextended && stock.riskReward < 3) {
    tradeable = false;
    reasons.push(`❌ Overextended: +${stock.gain5d}% this week with R/R only ${stock.riskReward}:1`);
  } else if (stock.overextended) {
    reasons.push(`⚠️ Overextended (+${stock.gain5d}%) but R/R ${stock.riskReward}:1 still favorable`);
  }

  // 1% equity risk position size check
  const maxRiskDollars  = accountCash * 0.01;
  const stopDistance    = stock.entry - stock.stop;
  let   maxShares       = stopDistance > 0 ? Math.floor(maxRiskDollars / stopDistance) : 0;
  let   positionCost    = maxShares * stock.entry;
  const maxAllocation   = accountCash * 0.10;

  // Cap at 10% allocation
  if (positionCost > maxAllocation) {
    maxShares    = Math.floor(maxAllocation / stock.entry);
    positionCost = maxShares * stock.entry;
    reasons.push(`⚠️ Position capped at 10% allocation ($${positionCost.toFixed(0)})`);
  }

  if (maxShares <= 0) {
    tradeable = false;
    reasons.push(`❌ Stop too tight — cannot size position within 1% risk rule`);
  }

  // Earnings warning (Alpaca doesn't provide earnings dates)
  reasons.push(`⚠️ Verify earnings date manually — do not trade within 48h of earnings`);

  // Volatility warning
  if (stock.atrPct > 5) {
    reasons.push(`⚠️ High volatility: ATR ${stock.atrPct}% of price`);
  }

  // Trend filter
  if (!stock.aboveMA20 && !stock.aboveMA50) {
    tradeable = false;
    reasons.push(`❌ Below both MA20 and MA50 — downtrend, no entry`);
  }

  return {
    tradeable,
    maxShares,
    positionCost: +positionCost.toFixed(2),
    dollarRisk:   +(maxShares * stopDistance).toFixed(2),
    pctOfCash:    +(positionCost / accountCash * 100).toFixed(1),
    reasons
  };
}

module.exports = { marketHealthCheck, stockFilters };
