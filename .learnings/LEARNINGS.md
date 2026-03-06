# Trading Learnings - Crypto AI Trading Bot

## Learnings for continuous improvement of the trading strategy and system.

---

## [LRN-20260304-001] Strategy Iteration - Stop-Loss Line Anomaly

**Logged**: 2026-03-04T03:41:00Z
**Priority**: high
**Status**: pending
**Area**: backend

### Summary
The stop-loss line shows abnormal values (559%-560%) and gets forcibly reset to -2.5%. This indicates a calculation error in the strategy self-iteration logic.

### Details
During every trading check, the system logs:
```
🐛 检测到止损线异常: 559%，强制重置为-2.5%
```

This happens consistently across multiple checks, suggesting:
1. The stop-loss calculation formula may have a bug
2. The value is being multiplied or concatenated incorrectly
3. The persistent storage (ai_evolve_log.json) may have corrupted data

### Suggested Action
1. Review the stop-loss calculation in `ai_trading_bot.js`
2. Check `ai_evolve_log.json` for corrupted values
3. Add validation before saving stop-loss values
4. Consider resetting the evolution log to defaults

### Metadata
- Source: error
- Related Files: okx_data/ai_trading_bot.js, okx_data/ai_evolve_log.json
- Tags: stop-loss, bug, strategy-iteration
- Recurrence-Count: 5+
- First-Seen: 2026-03-04T03:26:00Z
- Last-Seen: 2026-03-04T03:41:00Z

---

## [LRN-20260304-002] Trading Decision - ETH Stop-Loss Execution

**Logged**: 2026-03-04T03:35:00Z
**Priority**: medium
**Status**: resolved
**Area**: backend

### Summary
ETH was sold at stop-loss (-2.19%) when trend dropped to 6/10. This was the correct decision per the smart stop-loss strategy.

### Details
- Entry: ETH trend dropped from high to 6/10
- Stop-loss triggered at -2.19% (stop line was -2%)
- ETH added to blacklist to prevent re-entry
- The decision followed the strategy rules correctly

### Key Learning
Smart stop-loss strategy worked as intended. When trend drops to 6-7/10, the stop-loss tightens to -2%, protecting capital.

### Metadata
- Source: conversation
- Related Files: okx_data/ai_trading_bot.js
- Tags: stop-loss, ETH, risk-management

### Resolution
- **Resolved**: 2026-03-04T03:35:00Z
- **Notes**: Strategy executed correctly. ETH added to blacklist.

---

## [LRN-20260304-003] Trading Decision - New Entry on NEAR and ADA

**Logged**: 2026-03-04T03:35:00Z
**Priority**: medium
**Status**: resolved
**Area**: backend

### Summary
Successfully entered NEAR (10/10 trend) and ADA (8/10 trend) after ETH stop-loss. Both positions turned profitable quickly.

### Details
| Coin | Entry Price | Current Price | P&L | Trend |
|------|-------------|---------------|-----|-------|
| NEAR | $1.391 | $1.392 | +0.07% | 10/10 |
| ADA | $0.261 | $0.262 | +0.23% | 8/10 |

### Key Learning
Entering high-trend coins (8-10/10) after stop-losses helps recover quickly. Both positions were profitable within 30 minutes.

### Metadata
- Source: conversation
- Related Files: okx_data/ai_trading_bot.js
- Tags: entry-strategy, NEAR, ADA, trend-following

### Resolution
- **Resolved**: 2026-03-04T03:41:00Z
- **Notes**: Both positions profitable. Take-profit orders raised to 10%.

---

## [LRN-20260304-004] Risk Management - Portfolio Rebalancing

**Logged**: 2026-03-04T03:41:00Z
**Priority**: medium
**Status**: pending
**Area**: backend

### Summary
Current portfolio: 3 coins (TRX, NEAR, ADA) with 49.6% invested. Cash reserve at 50.4% provides good flexibility.

### Current Allocation
| Coin | Allocation | P&L | Trend |
|------|------------|-----|-------|
| TRX | 20.0% | -0.52% | 10/10 |
| NEAR | 14.0% | +0.07% | 10/10 |
| ADA | 14.0% | +0.23% | 8/10 |
| Cash | 50.4% | - | - |

### Key Learning
- TRX at 20% is overweight but trend is perfect (10/10)
- 2 out of 3 positions are profitable
- Cash reserve adequate for 2-3 more entries

### Suggested Action
Monitor TRX for take-profit opportunity. If it hits +10%, consider reducing position size to reallocate.

### Metadata
- Source: conversation
- Related Files: okx_data/ai_trading_bot.js
- Tags: portfolio, risk-management, allocation

---

## [LRN-20260304-005] System Improvement - GitHub Security

**Logged**: 2026-03-04T03:40:00Z
**Priority**: high
**Status**: resolved
**Area**: infra

### Summary
Uploaded trading bot code to GitHub. Implemented security measures to protect sensitive data.

### Actions Taken
1. ✅ Created private repository: szyellow/crypto-trading-bot
2. ✅ Enabled Secret Scanning
3. ✅ Enabled Push Protection
4. ✅ Created .gitignore for sensitive files
5. ✅ Cleaned Git history using git-filter-repo
6. ✅ Removed 6 sensitive files from history

### Key Learning
Always use git-filter-repo or BFG Repo-Cleaner to remove sensitive files from history before making repos public or sharing.

### Metadata
- Source: user_feedback
- Related Files: .gitignore
- Tags: security, github, best-practice

### Resolution
- **Resolved**: 2026-03-04T03:40:00Z
- **Notes**: Repository is now secure. Sensitive files excluded from future commits.

---

## [LRN-20260305-001] Strategy Fix - Buy High Sell Low Problem

**Logged**: 2026-03-05T02:26:00Z
**Priority**: high
**Status**: resolved
**Area**: backend

### Summary
The trading bot was buying at highs and selling at lows due to chasing trends. Fixed by switching to "buy low sell high" strategy.

### Changes Made
1. **Buy Condition**: Changed from `trend >= 8` to `trend >= 6` with `24h change -10%~5%`
   - Before: Buy when trend is strong (chasing)
   - After: Buy during pullback (dip buying)

2. **Stop-Loss Protection**: Added 1-hour holding period before allowing stop-loss
   - Prevents selling during normal pullback after entry

3. **Gold Stablecoins**: Excluded XAUT/PAXG from new buys, reduced take-profit to 0.2%
   - These have <1% daily volatility, 10% target was unrealistic

### Key Learning
Don't chase trends. Buy during pullbacks when trend is still bullish but price has dipped.

### Metadata
- Source: user_feedback
- Related Files: okx_data/ai_trading_bot.js
- Tags: strategy, buy-low-sell-high, trend-following, correction

### Resolution
- **Resolved**: 2026-03-05T02:26:00Z
- **Notes**: XAUT and PAXG successfully sold at +0.2% take-profit. BNB still holding.

---

## [LRN-20260305-002] Data Issue - Price Not Updating

**Logged**: 2026-03-05T02:01:00Z
**Priority**: high
**Status**: resolved
**Area**: backend

### Summary
User reported prices not updating (same values across multiple checks). Investigation showed data was actually real-time.

### Root Cause
- OKX API returns real-time data with timestamps
- BNB, XAUT, PAXG prices were genuinely flat (market sideways)
- Not a caching issue

### Fix Applied
Added timestamp logging to `getMarketPrice()`:
```javascript
console.log(`  📡 ${instId} 实时价格: $${price} (OKX时间: ${new Date(parseInt(ts)).toLocaleTimeString()})`);
```

### Key Learning
Always verify data freshness with timestamps before assuming caching issues.

### Metadata
- Source: user_feedback
- Related Files: okx_data/ai_trading_bot.js, okx_data/okx-api.js
- Tags: data-integrity, api, debugging

### Resolution
- **Resolved**: 2026-03-05T02:13:00Z
- **Notes**: Confirmed OKX timestamps update every second. Market was genuinely sideways.

---
