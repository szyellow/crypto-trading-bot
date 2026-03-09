# AI 自主加密货币交易系统 v2.4

一个基于 OKX 交易所 API 的智能加密货币交易机器人，整合多种交易策略和情绪分析。

## 🚀 主要特性

### 核心功能
- **智能趋势分析**: 基于多维度技术指标（MA、MACD、RSI、成交量）的趋势评分系统
- **动态止盈止损**: 根据趋势评分自动调整止盈止损比例
- **金字塔建仓**: 分层买入策略，首仓$25→跌10%补仓$15→再跌10%补仓$10
- **阴线买入**: 连续2根阴线+趋势≥6分+价格<MA5时触发买入
- **横盘暂停**: 趋势3-5分且波动率<0.5%时暂停买入
- **暴跌反弹**: 24h跌幅>10%且趋势回升至≥6分时抄底

### 情绪分析 (v2.3+)
- **CoinGecko 集成**: 实时获取市场情绪数据
- **新闻情绪分析**: 通过新闻 API 分析币种相关新闻的看涨/看跌情绪
- **Sub-agent 模式**: 独立服务处理情绪数据，避免主程序阻塞

### 数据提醒系统 (v2.4+)
- **自动数据检查**: 确保每次报告都基于最新数据
- **报告时间戳追踪**: 防止重复显示旧数据
- **数据获取清单**: 自动检查所有 API 数据是否已更新

### 风险控制
- **智能止损**: 趋势≤5分→-1%, 6-7分→-1.5%, ≥8分→-2%
- **黑名单管理**: 自动将止损币种加入黑名单，趋势回升后自动解除
- **稳定币过滤**: 自动跳过 USDC、USDT 等稳定币
- **紧急停止**: 支持 EMERGENCY_STOP.flag 文件紧急停止系统

## 🏗️ 多 Agent 架构

本系统采用多 Agent 协作架构，各 Agent 职责明确，通过模块化设计实现高效协作：

```
┌─────────────────────────────────────────────────────────────┐
│                    AI Trading System                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐    ┌─────────────────┐                │
│  │  Main Trading   │    │   Coordinator   │                │
│  │     Agent       │◄──►│     Agent       │                │
│  │ (ai_trading_bot)│    │ (coordinator.js)│                │
│  └────────┬────────┘    └─────────────────┘                │
│           │                                                 │
│           ▼                                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Sub-Agent Services                      │   │
│  ├─────────────────┬─────────────────┬─────────────────┤   │
│  │  Sentiment      │  Data Reminder  │  Notification   │   │
│  │    Client       │     Agent       │     Agent       │   │
│  │(sentiment-     │(data-reminder-  │(notification-   │   │
│  │  client.js)     │   agent.js)     │   agent.js)     │   │
│  └─────────────────┴─────────────────┴─────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Strategy Modules                        │   │
│  ├─────────────────┬─────────────────┬─────────────────┤   │
│  │   Enhanced      │   Evolution     │     Stats       │   │
│  │   Strategy      │   Strategy      │   (trade-stats) │   │
│  │(strategy-      │(strategy-      │                 │   │
│  │ enhanced.js)    │ evolution.js)   │                 │   │
│  └─────────────────┴─────────────────┴─────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Agent 职责说明

#### 1. 主交易 Agent (`ai_trading_bot.js`)
- **职责**: 核心交易逻辑执行
- **功能**:
  - 市场扫描和趋势分析
  - 买入/卖出决策执行
  - 止盈止损订单管理
  - 持仓监控和调整
- **触发**: 每 5 分钟运行一次

#### 2. 情绪数据 Client (`sentiment-client.js`)
- **职责**: 市场情绪数据获取和处理
- **功能**:
  - CoinGecko API 数据获取
  - 新闻情绪分析
  - 情绪数据缓存和分发
  - 独立服务避免主程序阻塞
- **模式**: Sub-agent 独立进程

#### 3. 数据提醒 Agent (`data-reminder-agent.js`)
- **职责**: 确保数据新鲜度
- **功能**:
  - 报告时间戳追踪
  - 数据获取清单检查
  - 防止重复显示旧数据
  - 提醒主程序获取最新数据
- **触发**: 每次主程序运行时检查

#### 4. 协调器 Agent (`coordinator.js`)
- **职责**: 多 Agent 协调和任务分发
- **功能**:
  - 任务调度
  - Agent 状态监控
  - 错误处理和恢复

#### 5. 交易 Agent (`trading-agent.js`)
- **职责**: 具体交易操作执行
- **功能**:
  - 订单创建和管理
  - 仓位计算
  - 风险控制执行

#### 6. 通知 Agent (`notification-agent.js`)
- **职责**: 消息通知管理
- **功能**:
  - 交易报告生成
  - 飞书/其他渠道通知
  - 告警消息发送

### 数据流

```
1. 主交易 Agent 启动
   │
   ▼
2. 调用情绪数据 Client 获取市场情绪
   │
   ▼
3. 调用数据提醒 Agent 检查数据新鲜度
   │
   ▼
4. 执行交易策略分析
   │
   ▼
5. 调用交易 Agent 执行买卖操作
   │
   ▼
6. 调用通知 Agent 发送报告
```

## 📁 项目结构

```
okx_data/
├── Core Agents:
├── ai_trading_bot.js           # 主交易程序 (核心 Agent)
├── sentiment-client.js         # 情绪数据客户端 (Sub-agent)
├── data-reminder-agent.js      # 数据提醒 Sub-agent
├── coordinator.js              # 协调器模块
├── trading-agent.js            # 交易代理模块
├── notification-agent.js       # 通知代理模块
│
├── Strategy Modules:
├── strategy-enhanced.js        # 增强策略模块
├── strategy-evolution.js       # 策略自迭代模块
├── trade-stats.js              # 交易统计模块
│
├── API & Config:
├── okx-api.js                  # OKX API 封装
├── config.js                   # 配置文件
├── package.json                # 项目依赖
│
├── Data Files:
├── ai_blacklist.json           # 黑名单数据
├── ai_reduce_position_prices.json  # 减仓价格记录
├── ai_sideways_status.json     # 横盘状态记录
├── ai_trend_history.json       # 趋势历史记录
├── strategy_evolution.json     # 策略进化记录
├── trade_stats.json            # 交易统计数据
├── last-report-timestamp.json  # 上次报告时间戳
│
└── Documentation:
    ├── AGENT_ARCHITECTURE.md   # 代理架构文档
    ├── DATA_REMINDER_README.md # 数据提醒系统文档
    ├── BUGFIX_REPORT.md        # Bug 修复报告
    ├── COMPLETE_FIX.md         # 完整修复文档
    └── UPDATE_LOG.md           # 更新日志
```

## 🛠️ 安装与配置

### 1. 安装依赖
```bash
cd okx_data
npm install
```

### 2. 配置 OKX API
在 `okx-api.js` 中配置你的 API 密钥：
```javascript
const API_KEY = 'your_api_key';
const API_SECRET = 'your_api_secret';
const PASSPHRASE = 'your_passphrase';
```

### 3. 启动情绪数据服务 (可选但推荐)
```bash
node sentiment-client.js
```

## 🚀 运行方式

### 手动运行
```bash
node ai_trading_bot.js
```

### 定时运行 (推荐)
使用 cron 或其他定时任务工具每 5 分钟运行一次：
```bash
*/5 * * * * cd /path/to/okx_data && node ai_trading_bot.js >> trading.log 2>&1
```

## 📊 策略配置

### 选股门槛
- 趋势评分 ≥ 7分 (可配置)
- 24h 涨跌幅 -5% ~ 15%
- 成交量 ≥ 500万 USDT
- 价格 > $0.1

### 止盈策略
- 盈利 1.5% → 减仓 25%
- 盈利 3% → 止盈 50%
- 盈利 5% → 清仓

### 动态止损
| 趋势评分 | 止损比例 |
|---------|---------|
| ≤5分    | -1%     |
| 6-7分   | -1.5%   |
| ≥8分    | -2%     |

## 📈 监控报告

系统每 5 分钟生成一次交易检查报告，包含：
- 账户总资产和持仓概况
- 市场扫描结果（通过筛选的币种）
- AI 交易决策（买入/卖出/HOLD）
- 趋势分析和情绪数据

## 🔄 策略自迭代

系统自动分析交易数据并优化策略参数：
- 胜率 < 30% → 收紧止损 20%
- 盈亏比 < 1 → 降低止盈
- 持仓时间 > 6小时 → 降低选股门槛
- 连续3次止损 → 降低单笔金额 20%
- 现金 < 30% → 增加最大持仓

## 🚨 紧急停止

创建 `EMERGENCY_STOP.flag` 文件可立即停止系统：
```bash
touch EMERGENCY_STOP.flag
```

删除该文件后可重新启动：
```bash
rm EMERGENCY_STOP.flag
```

## 📝 更新日志

### v2.4 (2026-03-09)
- 新增数据提醒 Sub-agent
- 优化止盈单管理逻辑
- 修复多个边界条件 bug

### v2.3 (2026-03-08)
- 新增 CoinGecko 情绪数据集成
- 实现 Sub-agent 模式处理情绪数据
- 新增新闻情绪分析功能

### v2.2 (2026-02-26)
- 新增金字塔建仓策略
- 新增阴线买入策略
- 新增横盘暂停策略
- 新增暴跌反弹策略
- 优化选股门槛至 7分

### v2.1 (2026-02-22)
- 修复 BARD 持仓识别 bug
- 修复 positions 未定义错误
- 新增交易统计功能

## ⚠️ 风险提示

1. **加密货币交易风险极高**，本系统仅供学习和研究使用
2. 请确保充分了解策略逻辑后再投入真实资金
3. 建议先在模拟账户中测试
4. 过往表现不代表未来收益

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📞 联系方式

如有问题或建议，请通过 GitHub Issues 联系。
