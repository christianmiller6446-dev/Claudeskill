# Trading Strategy Review & Action Plan
**Date:** July 24, 2026
**Account:** Paper Trading | Starting Equity: $50,000
**Current Equity:** $49,694.99 (-$305.01 / -0.61%)

---

## Current Account Snapshot

| Metric | Value |
|---|---|
| Equity | $49,694.99 |
| Cash Available | $44,546.19 |
| Unrealized P&L | +$213.60 (AAPL) |
| Realized P&L | -$518.51 |
| Daily P&L | -$65.44 |
| Weekly P&L | -$500.46 |
| Monthly P&L | -$132.34 |

---

## Strategy Performance (5 Closed Trades)

| Metric | Value | Status |
|---|---|---|
| Win Rate | 20% | Target >= 50% |
| Profit Factor | 0.25 | Target >= 1.30 |
| Expectancy | -$103.70/trade | Target > $0 |
| Max Drawdown | 1.44% | Under 10% - OK |
| Avg Hold Time | 351.3 hours | Very long |
| Sharpe Ratio | -0.61 | Target > 1.0 |

**Assessment:** Bot is entering positions too early. 4 out of 5 closed trades have been losses.

---

## Open Positions

### AAPL - HOLD
- Shares: 16 @ avg $308.45
- Current Price: $321.80
- Unrealized P&L: +$213.60 (+4.33%)
- Trailing Stop: $308.17 (8% trail) - properly protected
- Action: Hold. Let the trailing stop do its job.

---

## Open Orders - Action Required

### AMD Ladder Orders - CANCEL
| Order | Qty | Order Price | Market Price | Distance | Age | Action |
|---|---|---|---|---|---|---|
| AMD LADDER | 20 shares | $405.86 | $555.20 | 26.9% above | 38 days | CANCEL |
| AMD LADDER | 10 shares | $355.12 | $555.20 | 36.0% above | 38 days | CANCEL |

Recommended New AMD Ladder Prices:
- Buy 20 shares @ $527.44 (5% below current $555.20) - first dip buyer
- Buy 10 shares @ $499.68 (10% below current $555.20) - deeper discount entry

### NVDA Ladder Orders - RESET
| Order | Qty | Order Price | Market Price | Distance | Age | Action |
|---|---|---|---|---|---|---|
| NVDA LADDER | 10 shares | $160.35 | $208.16 | 23.0% above | 55 days | RESET |
| NVDA LADDER | 20 shares | $183.26 | $208.16 | 12.0% above | 55 days | RESET |

Recommended New NVDA Ladder Prices:
- Buy 20 shares @ $197.75 (5% below current $208.16) - tight dip buyer
- Buy 10 shares @ $187.34 (10% below current $208.16) - deeper discount entry

### SMCI Ladder - HOLD
- 145 shares @ $30.56 | Market: $31.22 | 2.1% above - valid, leave in place.

### AAPL Stop - HOLD
- 8% trailing stop on 16 shares - active and protecting gains.

---

## Profit Strategy - What Needs to Change

### 1. Add Entry Confirmation (Most Important)
Add a 30-minute hold rule: price must hold the level for at least 30 minutes before the order fires. This will reduce false entries and improve win rate significantly.

### 2. Reduce Maximum Open Positions to 2
Cap active positions at 2 until the profit factor exceeds 1.0.

### 3. Set a Max Ladder Age of 21 Days
Any GTC ladder order older than 21 days with the market more than 10% above the order price should be auto-cancelled and repriced.

### 4. Weekly P&L Review Every Monday
- Cancel orders older than 21 days if market has moved > 10%
- Confirm all stop orders are active
- Review any positions with unrealized losses > 3%

### 5. Fix the Claude Routines
The 5 NVDA monitoring tasks have never fired. They require the Claude desktop app open on the home machine during market hours (9:30 AM - 4:00 PM ET).

---

## Go-Live Gates - Current Progress

| Gate | Current | Required |
|---|---|---|
| Min 50 completed trades | 5 | 50 |
| Min 45 trading days | 22 | 45 |
| Profit factor >= 1.30 | 0.25 | 1.30 |
| Positive expectancy | -$103.70 | > $0 |
| Max drawdown < 10% | 1.44% | < 10% |
| 100% stop coverage | 100% | 100% |
| 4 consecutive profitable weeks | 0 | 4 |

Estimated timeline to live trading: 8-12 weeks if win rate improves to 50%+.

---

## Weekly P&L History

| Week | P&L |
|---|---|
| Jun 30, 2026 | $0.00 |
| Jul 7, 2026 | +$581.00 |
| Jul 14, 2026 | -$310.27 |
| Jul 21, 2026 | -$193.28 |

---

## Immediate Action Items

1. Cancel AMD ladder orders at $405.86 and $355.12
2. Replace with AMD ladders at $527.44 (20 shares) and $499.68 (10 shares)
3. Cancel NVDA ladder orders at $160.35 and $183.26
4. Replace with NVDA ladders at $197.75 (20 shares) and $187.34 (10 shares)
5. Leave AAPL position and stop untouched
6. Leave SMCI ladder in place
7. Open Claude desktop app on home machine during market hours
8. Add 30-minute entry confirmation rule to bot code
9. Add 21-day GTC ladder expiry rule to bot code
10. Fix ClaudeTradingDashboard script (exit code 267009 error)

---

## Automation Health

| Task | Type | Status |
|---|---|---|
| Dashboard (9:00 AM daily) | Windows Scheduler | Error exit 267009 |
| Auto-Trade (9:45 AM daily) | Windows Scheduler | Running |
| nvda-morning-check | Claude | Never fired - needs app open |
| nvda-midday-check | Claude | Never fired - needs app open |
| nvda-preclose-check | Claude | Never fired - needs app open |
| nvda-loss-guardian | Claude | Never fired - needs app open |
| nvda-nightly-report | Claude | Never fired - needs app open |
| weekly-stock-scan | Claude | Never fired - needs app open |
| monday-watchlist | Claude | Never fired - needs app open |
| weekend-bot-update | Claude | Never fired - needs app open |

---

*Generated by Claude | Paper Trading Only - No real money at risk*
