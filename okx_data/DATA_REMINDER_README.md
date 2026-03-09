# 数据提醒 Sub-Agent 使用说明

## 简介

数据提醒 Sub-Agent 是一个辅助模块，用于提醒主程序每次生成报告时都需要获取最新数据。

## 功能

1. **自动提醒**: 每次运行交易检查时，显示数据获取提醒
2. **时间戳记录**: 自动记录每次报告的时间
3. **检查清单**: 提供数据获取检查清单，确保不遗漏任何数据
4. **统计信息**: 记录提醒次数和报告历史

## 文件位置

- 主程序: `/root/.openclaw/workspace/okx_data/ai_trading_bot.js`
- Sub-Agent: `/root/.openclaw/workspace/okx_data/data-reminder-agent.js`
- 配置文件: `/root/.openclaw/workspace/okx_data/data-reminder-config.json`
- 时间戳记录: `/root/.openclaw/workspace/okx_data/last-report-timestamp.json`

## 使用方法

### 1. 直接运行 Sub-Agent

```bash
cd /root/.openclaw/workspace/okx_data
node data-reminder-agent.js
```

### 2. 命令行选项

```bash
# 启用提醒
node data-reminder-agent.js --enable

# 禁用提醒
node data-reminder-agent.js --disable

# 重置计数器
node data-reminder-agent.js --reset

# 查看统计信息
node data-reminder-agent.js --stats

# 手动记录报告时间戳
node data-reminder-agent.js --record
```

### 3. 在主程序中自动运行

主程序 `ai_trading_bot.js` 已集成 Sub-Agent，每次运行时会自动：
- 显示数据获取提醒
- 记录报告时间戳
- 更新统计信息

## 提醒内容

每次运行时会显示以下提醒：

```
╔════════════════════════════════════════════════════════════╗
║  📢 数据提醒 Sub-Agent 报告                                  ║
╠════════════════════════════════════════════════════════════╣
║  当前时间: 2026/3/8 23:28:00                                ║
║  上次报告: 2026/3/8 23:25:00                                ║
║  时间间隔: 3 分钟                                            ║
╠════════════════════════════════════════════════════════════╣
║  ⚠️  重要提醒:                                                ║
║                                                              ║
║  1. 每次生成报告前，请确保获取最新数据                         ║
║  2. 调用 OKX API 获取实时账户数据                              ║
║  3. 调用 CoinGecko API 获取最新市场情绪                        ║
║  4. 检查所有止盈单状态                                         ║
║  5. 更新持仓盈亏数据                                           ║
║                                                              ║
║  ✅ 数据获取检查清单:                                          ║
║     [ ] 账户余额 (OKX API)                                     ║
║     [ ] 持仓数据 (OKX API)                                     ║
║     [ ] 市场价格 (OKX API)                                     ║
║     [ ] 情绪数据 (CoinGecko API)                               ║
║     [ ] 新闻情绪 (News API)                                    ║
║     [ ] 止盈单状态 (OKX API)                                   ║
╚════════════════════════════════════════════════════════════╝
```

## 数据获取检查清单

每次生成报告前，请确保完成以下数据获取：

- [ ] **账户余额** (OKX API)
  - 总资产
  - 可用 USDT
  - 各币种余额

- [ ] **持仓数据** (OKX API)
  - 持仓币种
  - 持仓数量
  - 持仓成本
  - 当前盈亏

- [ ] **市场价格** (OKX API)
  - 实时价格
  - 24h 涨跌
  - 成交量

- [ ] **情绪数据** (CoinGecko API)
  - 市场情绪评分
  - 价格趋势
  - 社交媒体情绪

- [ ] **新闻情绪** (News API)
  - 相关新闻
  - 情绪评分
  - 看涨/看跌比例

- [ ] **止盈单状态** (OKX API)
  - 挂单状态
  - 止盈价格
  - 订单ID

## 注意事项

1. Sub-Agent 默认启用，可以通过 `--disable` 禁用
2. 提醒间隔默认为 5 分钟，可以在配置文件中修改
3. 时间戳记录用于追踪报告频率，帮助优化检查间隔
4. 所有数据都存储在本地 JSON 文件中，不会上传到外部服务器

## 故障排除

### 提醒不显示

检查 Sub-Agent 是否启用：
```bash
node data-reminder-agent.js --stats
```

如果显示 `"enabled": false`，则启用它：
```bash
node data-reminder-agent.js --enable
```

### 时间戳不更新

检查文件权限：
```bash
ls -la /root/.openclaw/workspace/okx_data/last-report-timestamp.json
```

如果文件不存在或权限不足，手动创建：
```bash
touch /root/.openclaw/workspace/okx_data/last-report-timestamp.json
chmod 644 /root/.openclaw/workspace/okx_data/last-report-timestamp.json
```

## 更新日志

### v1.0.0 (2026-03-08)
- 初始版本发布
- 实现数据提醒功能
- 集成到主交易程序
- 添加时间戳记录功能
