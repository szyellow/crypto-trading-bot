# 数字货币监控交易平台研究

## 用户需求
- GitHub上的开源项目
- 支持数字货币监控和交易
- 有Web页面监控平台
- 支持多Agent协作

## 推荐项目类别

### 1. 完整交易平台类

#### Hummingbot
- **GitHub**: https://github.com/hummingbot/hummingbot
- **特点**: 
  - 开源量化交易框架
  - 支持多交易所
  - 有Web UI (Hummingbot Dashboard)
  - 支持策略回测
  - 社区活跃

#### Freqtrade
- **GitHub**: https://github.com/freqtrade/freqtrade
- **特点**:
  - 开源加密货币交易机器人
  - 完整的Web界面
  - 支持Telegram通知
  - 策略回测功能
  - 多交易所支持

### 2. 监控面板类

#### Crypto-Signal
- **GitHub**: https://github.com/CryptoSignal/crypto-signal
- **特点**:
  - 自动化技术分析
  - 多交易所监控
  - 支持Webhook通知
  - 可配置策略

#### Binance-Trader
- **GitHub**: https://github.com/yasinkuyu/binance-trader
- **特点**:
  - Binance专用
  - 实时监控
  - 自动交易

### 3. 多Agent/分布式系统

#### Jesse
- **GitHub**: https://github.com/jesse-ai/jesse
- **特点**:
  - 高级Python交易框架
  - 支持多策略并行
  - Web监控界面
  - 机器学习集成

#### OctoBot
- **GitHub**: https://github.com/Drakkar-Software/OctoBot
- **特点**:
  - 开源交易机器人
  - Web界面管理
  - 支持多交易所
  - 社区策略市场

## 最符合需求的项目

基于您的需求（Web监控 + 多Agent），最推荐：

1. **Freqtrade** - 最成熟的Web界面，活跃社区
2. **Hummingbot** - 专业级，支持多Agent策略
3. **Jesse** - 现代化架构，支持多策略并行
4. **OctoBot** - 易用性强，Web界面友好

## 建议

如果需要多Agent协作的监控系统，可以考虑：
- 基于上述项目二次开发
- 使用Hummingbot的策略组合功能
- 搭建统一的监控Dashboard聚合多个Agent
