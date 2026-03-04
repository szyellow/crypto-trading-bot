# LEARNINGS.md - 学习记录

## 学习记录模板

### [LRN-YYYYMMDD-XXX] category

**Logged**: ISO-8601 timestamp
**Priority**: low | medium | high | critical
**Status**: pending
**Area**: trading | strategy | config | docs

### Summary
一句话描述学习内容

### Details
完整上下文：发生了什么，什么是正确的

### Suggested Action
具体的修复或改进措施

### Metadata
- Source: conversation | error | user_feedback
- Related Files: path/to/file.ext
- Tags: tag1, tag2
- See Also: LRN-20250110-001

---

## 实际学习记录

### [LRN-20260302-001] best_practice

**Logged**: 2026-03-02T00:20:00Z
**Priority**: high
**Status**: resolved
**Area**: trading

### Summary
黑名单机制优化：将解除门槛从"连续3次≥8分"改为"连续2次≥8分或单次≥9分"

### Details
- **问题**：原规则导致30个币种被永久黑名单，无法交易优质币种
- **解决方案**：降低解除门槛，增加"单次≥9分立即解除"规则
- **结果**：当日解除23个币种，成功买入4个强势币种，全部盈利

### Suggested Action
保持新规则，继续监控效果

### Metadata
- Source: user_feedback
- Related Files: ai_trading_bot.js
- Tags: blacklist, optimization, trading-strategy
- Pattern-Key: trading.blacklist_threshold

---

### [LRN-20260302-002] knowledge_gap

**Logged**: 2026-03-02T00:20:00Z
**Priority**: medium
**Status**: pending
**Area**: config

### Summary
胜率22.2%过低的主要原因是历史遗留问题，而非当前策略缺陷

### Details
- **历史交易**（优化前）：8买9卖，止损6次，止盈2次
- **原因**：黑名单限制导致只能交易弱势币种（CC, ZEC等）
- **优化后**：新买入4个币种全部盈利，持仓平均+0.46%

### Suggested Action
区分统计优化前后的胜率，单独评估新策略效果

### Metadata
- Source: analysis
- Related Files: ai_trade_log.json
- Tags: win-rate, statistics, strategy-evaluation

---

### [LRN-20260302-003] best_practice

**Logged**: 2026-03-02T00:20:00Z
**Priority**: high
**Status**: active
**Area**: trading

### Summary
动态止盈调整：趋势强劲时从+2%调整至+15%

### Details
- **机制**：系统自动检测趋势评分，10分时放宽止盈目标
- **效果**：避免过早止盈，抓住大趋势
- **当前**：4个持仓币种全部设置+15%止盈目标

### Suggested Action
继续优化动态止盈算法，考虑波动率因素

### Metadata
- Source: system_behavior
- Related Files: ai_trading_bot.js
- Tags: take-profit, dynamic-adjustment, trend-analysis
- Pattern-Key: trading.dynamic_take_profit

---
