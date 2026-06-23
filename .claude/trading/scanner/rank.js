// rank.js — Scoring and ranking engine. Pure calculation, no API calls.

function calcMA(closes, period) {
  if (closes.length < period) return null;
  const slice = closes.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function calcATR(bars, period = 14) {
  if (bars.length < period + 1) return null;
  const trs = bars.slice(-period - 1).map((bar, i, arr) => {
    if (i === 0) return bar.h - bar.l;
    const prevClose = arr[i - 1].c;
    return Math.max(bar.h - bar.l, Math.abs(bar.h - prevClose), Math.abs(bar.l - prevClose));
  });
  return trs.slice(1).reduce((a, b) => a + b, 0) / period;
}

function calcAvgVolume(bars, period = 20) {
  if (bars.length < period) return null;
  const slice = bars.slice(-period);
  return slice.reduce((a, b) => a + b.v, 0) / period;
}

function scoreStock(symbol, bars, snapshot, spyGain5d, qqqGain5d) {
  if (!bars || bars.length < 52) return null;

  const closes    = bars.map(b => b.c);
  const price     = closes[closes.length - 1];
  const price5dAgo = closes[closes.length - 6] || closes[0];
  const price1dAgo = closes[closes.length - 2];

  const gain5d    = (price - price5dAgo) / price5dAgo * 100;
  const gain1d    = (price - price1dAgo) / price1dAgo * 100;
  const ma20      = calcMA(closes, 20);
  const ma50      = calcMA(closes, 50);
  const atr       = calcATR(bars, 14);
  const atrPct    = atr ? (atr / price * 100) : 5;
  const avgVol20  = calcAvgVolume(bars, 20);
  // Use last completed bar volume — snapshot dailyBar.v is intraday and too low vs full-day avg
  const todayVol  = bars[bars.length - 1].v;
  const volRatio  = avgVol20 ? todayVol / avgVol20 : 1;

  // Gap behavior — check last 5 days
  const recent5 = bars.slice(-6);
  let gapPenalty = 0;
  for (let i = 1; i < recent5.length; i++) {
    const gap = (recent5[i].o - recent5[i-1].c) / recent5[i-1].c * 100;
    if (gap < -3)  gapPenalty = Math.max(gapPenalty, 10);
    if (gap > 5)   gapPenalty = Math.max(gapPenalty, 5);
  }

  // Relative strength vs SPY
  const rsVsSPY = gain5d - spyGain5d;
  const rsVsQQQ = gain5d - qqq5d;

  // Scoring
  const s1  = Math.min(25, Math.max(0, gain5d * 5));           // 5d gain
  const s2  = Math.min(10, Math.max(0, gain1d * 10));          // 1d gain
  const s3  = Math.min(15, volRatio * 7.5);                    // volume
  const s4  = ma20 ? Math.min(15, Math.max(0, (price - ma20) / ma20 * 100 * 3)) : 0; // vs MA20
  const s5  = ma50 ? Math.min(15, Math.max(0, (price - ma50) / ma50 * 100 * 2)) : 0; // vs MA50
  const s6  = Math.min(10, Math.max(0, rsVsSPY * 2));          // RS vs SPY
  const s7  = Math.max(0, 10 - atrPct * 2);                    // volatility (inverse)
  const raw = s1 + s2 + s3 + s4 + s5 + s6 + s7 - gapPenalty;
  const score = Math.max(0, Math.min(100, raw));

  // Risk/reward setup — stop must always be below price by at least 2%
  // ma20 * 0.99 can exceed price when price is below MA20, so cap at price * 0.98
  let stop = ma20 ? Math.max(price * 0.92, ma20 * 0.99) : price * 0.92;
  stop = Math.min(stop, price * 0.98); // guarantee at least 2% stop distance
  const entry      = price;
  const target     = entry + (entry - stop) * 2.5;
  const riskReward = (target - entry) / (entry - stop);

  // Confidence 1-10
  const confidence = Math.round(Math.min(10, Math.max(1, score / 10)));

  return {
    symbol,
    price: +price.toFixed(2),
    gain5d: +gain5d.toFixed(2),
    gain1d: +gain1d.toFixed(2),
    ma20:   ma20 ? +ma20.toFixed(2) : null,
    ma50:   ma50 ? +ma50.toFixed(2) : null,
    aboveMA20: ma20 ? price > ma20 : false,
    aboveMA50: ma50 ? price > ma50 : false,
    atrPct: +atrPct.toFixed(2),
    volRatio: +volRatio.toFixed(2),
    rsVsSPY: +rsVsSPY.toFixed(2),
    gapPenalty,
    score: +score.toFixed(1),
    entry: +entry.toFixed(2),
    stop:  +stop.toFixed(2),
    target: +target.toFixed(2),
    riskReward: +riskReward.toFixed(2),
    confidence,
    overextended: gain5d > 15
  };
}

function rankAll(results) {
  return [...results].sort((a, b) => b.score - a.score);
}

function leaderboard(ranked) {
  const nonIndex   = ranked.filter(r => !['SPY','QQQ'].includes(r.symbol));
  const bestPerf   = [...nonIndex].sort((a,b) => b.gain5d - a.gain5d)[0];
  const bestMoment = ranked[0];
  const bestRR     = [...nonIndex].sort((a,b) => b.riskReward - a.riskReward)[0];
  const mostVol    = [...nonIndex].sort((a,b) => b.atrPct - a.atrPct)[0];
  return { bestPerf, bestMoment, bestRR, mostVol };
}

// Export qqq5d so scoreStock can reference it — passed via closure in scanner.js
let qqq5d = 0;
function setQQQ5d(val) { qqq5d = val; }

module.exports = { scoreStock, rankAll, leaderboard, setQQQ5d };
