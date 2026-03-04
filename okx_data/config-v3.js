// ============================================
// AI自主交易系统 v3.0 - 全面优化版
// 优化内容：
// 1. 选币：增加波动率过滤、趋势强度过滤
// 2. 风控：动态仓位管理、时间衰减止损
// 3. 止盈：分批止盈策略
// 4. 买入：回调买入、支撑位买入
// ============================================

// 优化后的配置
const AI_CONFIG_V3 = {
    // 选币参数
    minVolume24h: 2000000,        // 24h成交额≥200万USDT（提高）
    maxVolatility: 8,             // 最大波动率8%
    minVolatility: 0.5,           // 最小波动率0.5%
    
    // 仓位管理
    maxPositionPerCoin: 40,       // 单币种最大40%
    maxDailyTrades: 15,           // 每日最大15笔
    maxDailyVolume: 1000,         // 每日最大交易量
    
    // 动态止损
    baseStopLoss: -2,             // 基础止损-2%
    trendStopLossFactor: 0.5,     // 趋势好的放宽50%
    timeDecayFactor: 0.1,         // 每小时收紧0.1%
    maxStopLoss: -5,              // 最大止损-5%
    minStopLoss: -1,              // 最小止损-1%
    
    // 分批止盈
    takeProfitLevels: [
        { percent: 5, sellRatio: 0.3 },   // 5%止盈，卖30%
        { percent: 10, sellRatio: 0.3 },  // 10%止盈，卖30%
        { percent: 15, sellRatio: 0.4 }   // 15%止盈，卖40%
    ],
    
    // 回调买入
    pullbackThreshold: -2,        // 回调≥2%考虑买入
    supportLevelLookback: 20,     // 支撑位回看20根K线
    
    // 其他
    tradeSize: 40,                // 单笔金额
    minCashReserve: 15,           // 最小现金保留15%
    buyCooldownMinutes: 30        // 买入冷却期
};

// 导出配置
module.exports = { AI_CONFIG_V3 };
