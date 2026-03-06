# 🤖 Crypto Trading Bot

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![GitHub Stars](https://img.shields.io/github/stars/szyellow/crypto-trading-bot?style=social)](https://github.com/szyellow/crypto-trading-bot/stargazers)

> 一个基于 OKX 交易所的 AI 驱动加密货币自动交易系统，采用趋势追踪策略，支持智能止损、动态止盈和金字塔建仓。

**⚠️ 风险提示：加密货币交易具有高风险，本项目仅供学习和研究使用，不构成投资建议。使用本软件进行交易可能导致资金损失，请谨慎评估风险。**

## ✨ 核心特性

- 🤖 **AI 智能决策** - 基于多维度技术指标的趋势评分系统
- 📊 **动态止盈止损** - 根据趋势强度自动调整止盈止损线
- 🏗️ **金字塔建仓** - 智能补仓策略，降低持仓成本
- 📈 **趋势追踪** - 实时分析市场趋势，捕捉交易机会
- 🛡️ **风险控制** - 黑名单机制、持仓限制、冷却期管理
- 💰 **资金管理** - 智能仓位分配，保护本金安全

## 🚀 快速开始

### 环境要求

- Node.js >= 18.0.0
- OKX 交易所账户
- API Key 权限：读取账户、现货交易

### 安装

```bash
# 克隆项目
git clone https://github.com/szyellow/crypto-trading-bot.git
cd crypto-trading-bot/okx_data

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填入你的 OKX API 密钥
```

### 配置

在项目根目录创建 `.env` 文件：

```env
OKX_API_KEY=your_api_key_here
OKX_API_SECRET=your_api_secret_here
OKX_PASSPHRASE=your_passphrase_here
```

### 运行

```bash
# 启动交易机器人
node ai_trading_bot.js

# 或者使用监控面板
./start_dashboard.sh
```

## 📋 交易策略

### 买入条件

1. ✅ 不在黑名单
2. ✅ 趋势评分 ≥ 7分
3. ✅ 非横盘状态
4. ✅ 持仓占比 < 阈值
5. ✅ 冷却期已结束
6. ✅ 波动率 ≥ 0.5%
7. ✅ 24h涨跌在合理范围
8. ✅ 价格 > $0.1
9. ✅ 成交量 ≥ 500万USDT
10. ✅ 近期未买入

### 卖出条件

**止盈策略：**
- 趋势8-10分：止盈 10-15%
- 趋势6-7分：止盈 6-10%
- 趋势≤5分：止盈 5-6%

**止损策略：**
- 趋势10分：止损 -3%
- 趋势8-9分：止损 -2%
- 趋势6-7分：止损 -1.5%
- 趋势≤5分：止损 -1%

### 额外策略

- **阴线买入** - 连续2根阴线 + 趋势≥6分 + 价格<MA5
- **暴跌反弹** - 24h跌幅>10% + 趋势回升至≥6分
- **金字塔建仓** - 首仓$25 → 跌10%补仓$15 → 再跌10%补仓$10

## 📁 项目结构

```
okx_data/
├── ai_trading_bot.js          # 主交易机器人
├── okx-api.js                 # OKX API 封装
├── trade-stats.js             # 交易统计模块
├── strategy-evolution.js      # 策略进化模块
├── dashboard.html             # 监控面板
├── ai_blacklist.json          # 黑名单配置
├── ai_trade_log.json          # 交易日志
├── trade_stats.json           # 交易统计
└── ...
```

## 🔧 配置文件

### 主要配置项 (ai_trading_bot.js)

```javascript
const AI_CONFIG = {
  // 交易限制
  maxDailyTrades: 9999,        // 每日最大交易次数
  maxDailyVolume: 1000,        // 每日最大交易量 (USDT)
  tradeSize: 40,               // 单笔交易金额
  maxPositions: 5,             // 最大持仓数量
  
  // 选股门槛
  sentimentThreshold: 7,       // 趋势评分门槛
  
  // 分层冷却期 (分钟)
  tieredCooldown: {
    trend10: 15,      // 趋势10分
    trend8_9: 20,     // 趋势8-9分
    trend6_7: 30      // 趋势6-7分
  },
  
  // 波动率筛选
  volatilityFilter: {
    minVolatility: 0.5,      // 最小波动率
    preferredVolatility: 1.5 // 优选波动率
  }
};
```

## 📊 监控面板

启动 Web 监控面板：

```bash
./start_dashboard.sh
```

访问 http://localhost:8080 查看：
- 实时账户资产
- 持仓详情
- 交易历史
- 策略表现

## 🛡️ 风险管理

### 黑名单机制

**稳定币 (永久禁止)：**
- USDC, USDT, USDG, DAI, TUSD, BUSD

**止损币种 (条件释放)：**
- 触发止损后自动加入
- 解除条件：1次≥9分 或 2次≥8分 或 3次≥7分

### 仓位管理

| 趋势评分 | 持仓阈值 | 止损线 |
|---------|---------|--------|
| 10分    | 20%     | -3%    |
| 8-9分   | 20%     | -2%    |
| 6-7分   | 15%     | -1.5%  |
| ≤5分    | 10%     | -1%    |

## 📝 日志与统计

### 交易日志

所有交易记录保存在 `ai_trade_log.json`：

```json
{
  "time": "2026-03-04T08:30:00.000Z",
  "coin": "BTC",
  "action": "buy",
  "price": 65000,
  "amount": 0.001,
  "reason": "趋势评分8/10，突破买入"
}
```

### 统计报告

生成交易统计报告：

```bash
node trade-stats.js
```

## 🔍 故障排查

### 常见问题

**Q: 总资产显示不更新？**
A: 检查 API 连接，确保网络正常。数据可能有30-60秒延迟。

**Q: 交易没有执行？**
A: 检查：
1. 是否在黑名单
2. 是否满足买入条件
3. 冷却期是否结束
4. 资金是否充足

**Q: 如何停止机器人？**
A: 按 Ctrl+C 或运行 `./restart_server.sh`

## 🤝 贡献指南

1. Fork 本项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

## 🙏 致谢

- [OKX API](https://www.okx.com/docs-v5/en/) - 交易所 API
- [Node.js](https://nodejs.org/) - 运行环境
- 所有贡献者和测试者

## ⚠️ 免责声明

**加密货币交易存在高风险，可能导致本金损失。本机器人仅供学习和研究使用，不构成投资建议。请根据自身风险承受能力谨慎使用。**

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/szyellow">szyellow</a>
</p>
