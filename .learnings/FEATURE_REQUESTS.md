# FEATURE_REQUESTS.md - 功能请求记录

## 功能请求模板

### [FEAT-YYYYMMDD-XXX] capability_name

**Logged**: ISO-8601 timestamp
**Priority**: low | medium | high
**Status**: pending
**Area**: frontend | backend | infra | tests | docs | config

### Requested Capability
用户想要的功能

### User Context
为什么需要它，解决什么问题

### Complexity Estimate
simple | medium | complex

### Suggested Implementation
如何实现，可能扩展什么

### Metadata
- Frequency: first_time | recurring
- Related Features: existing_feature_name

---

## 实际功能请求

### [FEAT-20260302-001] skill_installation_automation

**Logged**: 2026-03-02T00:20:00Z
**Priority**: medium
**Status**: pending
**Area**: infra

### Requested Capability
自动安装和配置 skills，避免手动克隆和速率限制问题

### User Context
用户需要安装多个 skills（self-improving, tavily-search, github等），但遇到：
1. ClawHub 速率限制
2. GitHub 克隆失败（网络限制）

### Complexity Estimate
medium

### Suggested Implementation
1. 创建批量安装脚本
2. 使用镜像源或缓存
3. 提供离线安装包

### Metadata
- Frequency: first_time
- Related Features: clawhub, skill-management

---

### [FEAT-20260302-002] win_rate_tracking

**Logged**: 2026-03-02T00:20:00Z
**Priority**: high
**Status**: pending
**Area**: backend

### Requested Capability
区分统计优化前后的胜率，单独追踪新策略效果

### User Context
当前胜率22.2%包含历史遗留交易，无法准确评估新策略（黑名单优化后）的效果

### Complexity Estimate
simple

### Suggested Implementation
1. 添加时间戳标记（优化前/后）
2. 分别计算两个时间段的胜率
3. 在报告中显示对比

### Metadata
- Frequency: recurring
- Related Features: trade-stats, reporting

---
