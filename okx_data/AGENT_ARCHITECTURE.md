# Agent架构重构说明

## 📊 新架构概览

已将主交易程序拆分为**通知Agent**和**交易Agent**两个独立的Agent，通过协调器统一管理。

### Agent列表（现在共5个）

| # | Agent名称 | 文件 | 功能 |
|---|-----------|------|------|
| 1 | **通知Agent** | `notification-agent.js` | 获取实时数据、分析市场、生成交易信号 |
| 2 | **交易Agent** | `trading-agent.js` | 读取信号、执行买卖交易、记录日志 |
| 3 | **协调器** | `coordinator.js` | 协调通知Agent和交易Agent的工作 |
| 4 | **情绪数据客户端** | `sentiment-client.js` | 获取CoinGecko市场情绪和新闻数据 |
| 5 | **数据提醒Agent** | `data-reminder-agent.js` | 提醒获取最新数据、记录时间戳 |

---

## 🔄 工作流程

### 方式1: 使用协调器（推荐）

```bash
# 运行完整流程（通知 + 交易）
cd /root/.openclaw/workspace/okx_data
node coordinator.js --full

# 仅运行通知（获取数据，不交易）
node coordinator.js --notify

# 仅运行交易（执行已有信号）
node coordinator.js --trade
```

### 方式2: 分别运行Agent

```bash
# 步骤1: 运行通知Agent获取实时数据
node notification-agent.js

# 步骤2: 查看生成的交易信号
# 信号保存在 trading-signals.json

# 步骤3: 运行交易Agent执行交易
node trading-agent.js --execute
```

---

## 📋 各Agent详细说明

### 1. 通知Agent (notification-agent.js)

**功能：**
- 获取实时账户数据（余额、持仓）
- 扫描市场机会
- 生成交易建议（买入/卖出信号）
- 保存信号到文件

**输出：**
- 显示实时数据报告
- 生成 `trading-signals.json` 文件

**使用：**
```bash
node notification-agent.js
```

---

### 2. 交易Agent (trading-agent.js)

**功能：**
- 读取通知Agent生成的信号
- 执行买卖交易
- 记录交易日志
- 支持手动/自动模式

**模式：**
- **手动模式**（默认）：显示信号，等待用户确认
- **自动模式**：自动执行所有信号

**使用：**
```bash
# 查看待处理信号
node trading-agent.js

# 手动执行所有信号
node trading-agent.js --execute

# 开启自动模式
node trading-agent.js --auto-on

# 关闭自动模式
node trading-agent.js --auto-off
```

**配置：**
- 最大单笔金额: $25
- 每日最大交易: 10笔
- 配置文件: `trading-agent-config.json`

---

### 3. 协调器 (coordinator.js)

**功能：**
- 统一管理通知Agent和交易Agent
- 支持多种运行模式
- 简化操作流程

**使用：**
```bash
# 显示帮助
node coordinator.js --help

# 运行完整流程
node coordinator.js --full

# 仅通知
node coordinator.js --notify

# 仅交易
node coordinator.js --trade
```

---

### 4. 情绪数据客户端 (sentiment-client.js)

**功能：**
- 获取CoinGecko市场情绪数据
- 获取新闻情绪分析
- 为通知Agent提供数据支持

---

### 5. 数据提醒Agent (data-reminder-agent.js)

**功能：**
- 提醒获取最新数据
- 记录报告时间戳
- 超过10分钟显示强制检查警告

**使用：**
```bash
# 运行提醒
node data-reminder-agent.js

# 查看统计
node data-reminder-agent.js --stats

# 重置计数器
node data-reminder-agent.js --reset
```

---

## 🎯 使用场景示例

### 场景1: 日常监控（只看不交易）

```bash
# 获取实时数据，查看市场情况
node coordinator.js --notify
```

### 场景2: 发现机会后执行交易

```bash
# 步骤1: 获取数据
node coordinator.js --notify

# 步骤2: 查看生成的信号
# 如果信号合适，执行交易
node coordinator.js --trade
```

### 场景3: 全自动模式

```bash
# 开启交易Agent自动模式
node trading-agent.js --auto-on

# 运行完整流程（自动获取数据并执行交易）
node coordinator.js --full
```

---

## ⚠️ 重要说明

### 安全机制

1. **交易Agent默认手动模式**
   - 不会自动执行交易
   - 需要用户确认或使用 `--execute` 参数

2. **模拟交易**
   - 当前版本为模拟模式，不会实际下单
   - 实际交易需要取消代码中的注释

3. **每日交易限制**
   - 默认每日最多10笔交易
   - 防止过度交易

### 数据流

```
通知Agent → 获取实时数据 → 生成交易信号 → 保存到文件
                                        ↓
交易Agent ← 读取信号 ← 执行交易 ← 记录日志
```

### 文件说明

| 文件 | 说明 |
|------|------|
| `notification-agent-config.json` | 通知Agent配置 |
| `trading-agent-config.json` | 交易Agent配置 |
| `trading-signals.json` | 交易信号（通知Agent生成） |
| `ai_trade_log.json` | 交易日志 |
| `data-reminder-config.json` | 数据提醒配置 |
| `last-report-timestamp.json` | 上次报告时间 |

---

## 🔧 故障排除

### 问题1: 通知Agent无法获取数据

**解决：**
```bash
# 检查OKX API配置
node okx-api.js

# 检查网络连接
ping www.okx.com
```

### 问题2: 交易Agent找不到信号

**解决：**
```bash
# 先运行通知Agent生成信号
node notification-agent.js

# 检查信号文件是否存在
ls -la trading-signals.json
```

### 问题3: 协调器无法启动

**解决：**
```bash
# 检查Node.js版本
node --version

# 检查文件是否存在
ls -la notification-agent.js trading-agent.js coordinator.js
```

---

## 📈 优势

1. **职责分离**
   - 通知Agent专注于数据获取和分析
   - 交易Agent专注于执行交易
   - 更清晰的代码结构

2. **灵活性**
   - 可以单独运行通知Agent查看数据
   - 可以单独运行交易Agent执行已有信号
   - 支持手动和自动模式

3. **安全性**
   - 默认手动模式，避免误操作
   - 交易前需要用户确认
   - 每日交易次数限制

4. **可扩展性**
   - 易于添加新的Agent
   - 易于修改单个Agent的逻辑
   - 不影响其他Agent

---

## 📝 更新日志

### v2.5.0 (2026-03-09)
- 重构主交易程序
- 拆分为通知Agent和交易Agent
- 添加协调器统一管理
- 优化数据提醒Agent

---

## 💡 建议

1. **日常使用**
   - 使用 `coordinator.js --notify` 查看实时数据
   - 发现有价值的信号后，使用 `coordinator.js --trade` 执行

2. **风险管理**
   - 保持手动模式，仔细审核每个交易信号
   - 不要开启自动模式，除非完全信任策略

3. **监控**
   - 定期查看 `ai_trade_log.json` 了解交易历史
   - 关注数据提醒Agent的警告信息
