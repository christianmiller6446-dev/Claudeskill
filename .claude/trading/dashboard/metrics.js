// metrics.js — Performance calculations from fills and portfolio history.

function buildRoundTrips(fills) {
  // Match buys to subsequent sells per symbol to form closed round trips
  const bySymbol = {};
  for (const f of fills) {
    if (!bySymbol[f.symbol]) bySymbol[f.symbol] = { buys: [], sells: [] };
    if (f.side === 'buy')  bySymbol[f.symbol].buys.push({ ...f });
    if (f.side === 'sell') bySymbol[f.symbol].sells.push({ ...f });
  }

  const trips = [];
  for (const [symbol, { buys, sells }] of Object.entries(bySymbol)) {
    // Sort chronologically
    buys.sort((a, b) => new Date(a.date) - new Date(b.date));
    sells.sort((a, b) => new Date(a.date) - new Date(b.date));

    let buyPool = buys.map(b => ({ ...b, remaining: b.qty }));
    for (const sell of sells) {
      let remaining = sell.qty;
      const openDate = buyPool[0]?.date || sell.date;
      let costBasis = 0;
      let costQty   = 0;

      while (remaining > 0 && buyPool.length > 0) {
        const buy = buyPool[0];
        const matched = Math.min(remaining, buy.remaining);
        costBasis += matched * buy.price;
        costQty   += matched;
        remaining -= matched;
        buy.remaining -= matched;
        if (buy.remaining <= 0) buyPool.shift();
      }

      if (costQty > 0) {
        const proceeds  = sell.qty * sell.price;
        const cost      = costBasis;
        const pl        = proceeds - cost;
        const holdMs    = new Date(sell.date) - new Date(openDate);
        trips.push({
          symbol,
          buyDate:  openDate,
          sellDate: sell.date,
          qty:      sell.qty,
          avgBuy:   +(costBasis / costQty).toFixed(4),
          sellPrice: +sell.price.toFixed(4),
          pl:       +pl.toFixed(2),
          plPct:    +(pl / cost * 100).toFixed(2),
          holdHours: +(holdMs / 3600000).toFixed(1)
        });
      }
    }
  }
  return trips;
}

function calcMetrics(trips, history) {
  if (!trips.length) {
    return {
      totalTrades: 0, winners: 0, losers: 0, winRate: 0,
      avgWinner: 0, avgLoser: 0, profitFactor: 0,
      expectancy: 0, rrRatio: 0, maxDrawdown: 0,
      largestWinner: 0, largestLoser: 0,
      avgHoldHours: 0, sharpe: null,
      totalRealizedPL: 0
    };
  }

  const winners = trips.filter(t => t.pl > 0);
  const losers  = trips.filter(t => t.pl <= 0);

  const grossProfit = winners.reduce((s, t) => s + t.pl, 0);
  const grossLoss   = Math.abs(losers.reduce((s, t) => s + t.pl, 0));

  const winRate     = trips.length ? winners.length / trips.length * 100 : 0;
  const avgWinner   = winners.length ? grossProfit / winners.length : 0;
  const avgLoser    = losers.length  ? grossLoss   / losers.length  : 0;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;
  const expectancy  = (winRate/100 * avgWinner) - ((1 - winRate/100) * avgLoser);
  const rrRatio     = avgLoser > 0 ? avgWinner / avgLoser : 0;

  const largestWinner = winners.length ? Math.max(...winners.map(t => t.pl)) : 0;
  const largestLoser  = losers.length  ? Math.min(...losers.map(t => t.pl))  : 0;
  const avgHoldHours  = trips.reduce((s, t) => s + t.holdHours, 0) / trips.length;
  const totalRealizedPL = trips.reduce((s, t) => s + t.pl, 0);

  // Max drawdown from portfolio history
  let maxDrawdown = 0;
  let peak = 0;
  for (const day of history) {
    if (day.equity > peak) peak = day.equity;
    const dd = peak > 0 ? (peak - day.equity) / peak * 100 : 0;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  // Sharpe ratio (annualized) from daily returns
  let sharpe = null;
  if (history.length >= 10) {
    const returns = [];
    for (let i = 1; i < history.length; i++) {
      const prev = history[i-1].equity;
      if (prev > 0) returns.push((history[i].equity - prev) / prev);
    }
    const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
    const variance = returns.reduce((s, r) => s + Math.pow(r - mean, 2), 0) / returns.length;
    const std = Math.sqrt(variance);
    sharpe = std > 0 ? +((mean / std) * Math.sqrt(252)).toFixed(2) : null;
  }

  return {
    totalTrades:    trips.length,
    winners:        winners.length,
    losers:         losers.length,
    winRate:        +winRate.toFixed(1),
    avgWinner:      +avgWinner.toFixed(2),
    avgLoser:       +avgLoser.toFixed(2),
    profitFactor:   +profitFactor.toFixed(2),
    expectancy:     +expectancy.toFixed(2),
    rrRatio:        +rrRatio.toFixed(2),
    maxDrawdown:    +maxDrawdown.toFixed(2),
    largestWinner:  +largestWinner.toFixed(2),
    largestLoser:   +largestLoser.toFixed(2),
    avgHoldHours:   +avgHoldHours.toFixed(1),
    sharpe,
    totalRealizedPL: +totalRealizedPL.toFixed(2)
  };
}

function calcPnLPeriods(history, currentEquity) {
  const sorted = [...history].sort((a, b) => new Date(a.date) - new Date(b.date));
  const today  = sorted[sorted.length - 1];
  const yesterday = sorted[sorted.length - 2];

  const dailyPL = today && yesterday
    ? +(currentEquity - yesterday.equity).toFixed(2)
    : 0;

  const weekAgo = sorted.length >= 6 ? sorted[sorted.length - 6] : sorted[0];
  const weeklyPL = weekAgo ? +(currentEquity - weekAgo.equity).toFixed(2) : 0;

  const monthAgo = sorted[0];
  const monthlyPL = monthAgo ? +(currentEquity - monthAgo.equity).toFixed(2) : 0;

  // Best/worst days this week
  const weekSlice = sorted.slice(-5);
  let bestDay = null, worstDay = null;
  for (let i = 1; i < weekSlice.length; i++) {
    const pl = weekSlice[i].equity - weekSlice[i-1].equity;
    if (!bestDay  || pl > bestDay.pl)  bestDay  = { date: weekSlice[i].date, pl: +pl.toFixed(2) };
    if (!worstDay || pl < worstDay.pl) worstDay = { date: weekSlice[i].date, pl: +pl.toFixed(2) };
  }

  return { dailyPL, weeklyPL, monthlyPL, bestDay, worstDay };
}

module.exports = { buildRoundTrips, calcMetrics, calcPnLPeriods };
