// readiness.js — Live trading readiness score 0-100.

function calcReadiness(health, risk, metrics, history) {
  const breakdown = {};

  // ─── INFRASTRUCTURE (30 pts) ─────────────────────────────
  // Scheduler: all 9 tasks registered
  const taskPts = health.registeredCount >= 9 ? 10
    : health.registeredCount >= 6 ? 5 : 0;
  breakdown.schedulerReliability = { pts: taskPts, max: 10,
    note: `${health.registeredCount}/9 tasks registered` };

  // API reliability
  const apiPts = health.errorsToday === 0 ? 10
    : health.errorsToday < 3 ? 5 : 0;
  breakdown.apiReliability = { pts: apiPts, max: 10,
    note: `${health.errorsToday} API errors today` };

  // Logging depth — days of history
  const historyDays = history.length;
  const logPts = historyDays >= 7 ? 10 : historyDays >= 3 ? 5 : 0;
  breakdown.logging = { pts: logPts, max: 10,
    note: `${historyDays} days of portfolio history` };

  const infraTotal = taskPts + apiPts + logPts;

  // ─── RISK MANAGEMENT (30 pts) ────────────────────────────
  // Stop coverage = 100%
  const stopPts = risk.overallCoveragePct >= 100 ? 10
    : risk.overallCoveragePct >= 80 ? 5 : 0;
  breakdown.stopCoverage = { pts: stopPts, max: 10,
    note: `${risk.overallCoveragePct}% of shares protected` };

  // Allocation control — no symbol over 25%
  const anyOverAlloc = Object.values(risk.allocations).some(a => a.overLimit);
  const allocPts = anyOverAlloc ? 0 : 10;
  breakdown.allocationControl = { pts: allocPts, max: 10,
    note: anyOverAlloc ? 'Allocation breach detected' : 'All positions within 25% cap' };

  // Loss limits never breached (approximate: weekly remaining > 0)
  const limitPts = risk.remaining.weekly > 0 && risk.remaining.daily > 0 ? 10
    : risk.remaining.weekly > 0 || risk.remaining.daily > 0 ? 5 : 0;
  breakdown.lossLimits = { pts: limitPts, max: 10,
    note: `Daily remaining: $${risk.remaining.daily} | Weekly: $${risk.remaining.weekly}` };

  const riskTotal = stopPts + allocPts + limitPts;

  // ─── STRATEGY VALIDATION (40 pts) ────────────────────────
  // Completed trades
  const tradePts = metrics.totalTrades >= 10 ? 10
    : metrics.totalTrades >= 5 ? 5 : 0;
  breakdown.completedTrades = { pts: tradePts, max: 10,
    note: `${metrics.totalTrades} closed trades` };

  // Profit factor
  const pfPts = metrics.profitFactor >= 1.5 ? 10
    : metrics.profitFactor >= 1.0 ? 5 : 0;
  breakdown.profitFactor = { pts: pfPts, max: 10,
    note: `Profit factor: ${metrics.profitFactor}` };

  // Win rate
  const wrPts = metrics.winRate >= 50 ? 10
    : metrics.winRate >= 40 ? 5 : 0;
  breakdown.winRate = { pts: wrPts, max: 10,
    note: `Win rate: ${metrics.winRate}%` };

  // Max drawdown
  const ddPts = metrics.maxDrawdown <= 5 ? 10
    : metrics.maxDrawdown <= 10 ? 7
    : metrics.maxDrawdown <= 15 ? 3 : 0;
  breakdown.drawdown = { pts: ddPts, max: 10,
    note: `Max drawdown: ${metrics.maxDrawdown}%` };

  const stratTotal = tradePts + pfPts + wrPts + ddPts;

  const total = infraTotal + riskTotal + stratTotal;

  const level =
    total >= 80 ? 'Candidate for Live Deployment'       :
    total >= 60 ? 'Controlled Live Test Eligible'       :
    total >= 40 ? 'Early Testing'                       :
                  'Not Ready';

  const levelColor =
    total >= 80 ? 'green'  :
    total >= 60 ? 'yellow' :
    total >= 40 ? 'orange' :
                  'red';

  return {
    total,
    infraTotal,
    riskTotal,
    stratTotal,
    level,
    levelColor,
    breakdown
  };
}

module.exports = { calcReadiness };
