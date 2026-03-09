# AI 自主加密货币交易系统 v2.4

一个基于 OKX 交易所 API 的智能加密货币交易机器人，采用多 Agent 架构，整合多种交易策略和情绪分析。

## 🏗️ 多 Agent 架构

本系统采用模块化多 Agent 设计，各组件职责明确，协同工作：

```
┌─────────────────────────────────────────────────────────────┐
│                    主交易程序 (ai_trading_bot.js)              │
│                      - 核心决策引擎                           │
│                      - 策略执行与协调                         │
└──────────────┬──────────────────────────────────────────────┘
               │
    ┌──────────┼──────────┬──────────┬──────────┐
    │          │          │          │          │
    ▼          ▼          ▼          ▼          ▼
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│情绪数据 │ │数据提醒│ │交易统计│ │策略进化│ │通知代理│
│客户端  │ │Sub-Agent│ │模块   │ │模块   │ │       │
│       │ │       │ │       │ │       │ │       │
│sentiment│ │data-  │ │trade- │ │strategy│ │notifi-│
│-client │ │reminder│ │stats │ │-evolution│ │cation │
│       │ │-agent  │ │       │ │       │ │-agent │
└────────┘ └────────┘ └────────┘ └────────┘ └────────┘
```

### Agent 职责说明

| Agent | 文件 | 职责 |
|-------|------|------|
| **主交易程序** | `ai_trading_bot.js` | 核心决策引擎，执行买卖逻辑，协调各 Sub-agent |
| **情绪数据客户端** | `sentiment-client.js` | 独立服务，获取 CoinGecko 和新闻情绪数据 |
| **数据提醒 Agent** | `data-reminder-agent.js` | 监控数据新鲜度，防止重复显示旧数据 |
| **交易统计模块** | `trade-stats.js` | 记录和分析交易数据，生成统计报告 |
| **策略进化模块** | `strategy-evolution.js` | 根据交易结果自动优化策略参数 |
| **通知代理** | `notification-agent.js` | 处理各类通知和报警 |
| **交易代理** | `trading-agent.js` | 封装交易执行逻辑 |
| **协调器** | `coordinator.js` | 协调多个 Agent 之间的工作流 |

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

## 📁 项目结构

```
okx_data/
├── Core Agents:
├── ai_trading_bot.js           # 主交易程序 (核心决策引擎)
├── sentiment-client.js         # 情绪数据客户端 (Sub-agent)
├── data-reminder-agent.js      # 数据提醒 Sub-agent
├── trading-agent.js            # 交易代理
├── notification-agent.js       # 通知代理
├── coordinator.js              # 协调器
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
├── data-reminder-config.json   # 数据提醒配置
├── notification-agent-config.json  # 通知代理配置
│
└── Documentation:
    ├── README.md               # 本文件
    ├── AGENT_ARCHITECTURE.md   # 代理架构详细文档
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
- 完善多 Agent 架构文档

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
