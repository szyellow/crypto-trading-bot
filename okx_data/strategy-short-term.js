// ============================================
// 短线高胜率策略 v3.0
// 借鉴 @puff_2002 (千金一刻) 的交易理念
// 核心：高胜率 + 严格止损 + 快速进出
// ============================================

const fs = require('fs');

// ============================================
// 策略配置
// ============================================
const SHORT_TERM_CONFIG = {
    // 选股门槛（更严格）
    MIN_TREND_SCORE: 8,           // 趋势评分 >= 8分
    MAX_TREND_SCORE: 10,          // 趋势评分 <= 10分
    RSI_MIN: 40,                  // RSI >= 40（避免超卖）
    RSI_MAX: 60,                  // RSI <= 60（避免超买）
    MIN_VOLUME_RATIO: 1.0,        // 成交量 >= 1.0x
    MAX_24H_CHANGE: 5,            // 24h涨跌幅 <= +5%
    MIN_24H_CHANGE: -2,           // 24h涨跌幅 >= -2%
    MIN_MARKET_TREND: 6,          // 大盘趋势 >= 6分
    
    // 仓位管理
    POSITION_SIZE: 40,            // 单笔金额 $40
    MAX_POSITIONS: 3,             // 最大持仓3个
    MAX_POSITION_PERCENT: 15,     // 单个币种最大占比15%
    
    // 止盈止损（更严格）
    STOP_LOSS: -1.0,              // 止损 -1%（固定）
    TAKE_PROFIT_1: 2.0,           // 第一止盈 +2%（减仓50%）
    TAKE_PROFIT_2: 5.0,           // 第二止盈 +5%（清仓）
    TIME_STOP: 24,                // 时间止损 24小时
    
    // 交易频率控制
    MIN_TRADE_INTERVAL: 4,        // 同一币种最小交易间隔4小时
    MAX_DAILY_TRADES: 3,          // 每日最大交易笔数
    
    // 波动率筛选
    MIN_VOLATILITY: 0.5,          // 最小波动率0.5%
    MAX_VOLATILITY: 3.0,          // 最大波动率3%（避免剧烈波动）
};

// ============================================
// 检查是否满足短线买入条件
// ============================================
function checkShortTermBuyCondition(coin, trendScore, rsi, volumeRatio, priceChange24h, marketTrend, volatility) {
    const config = SHORT_TERM_CONFIG;
    
    // 1. 趋势评分检查
    if (trendScore < config.MIN_TREND_SCORE || trendScore > config.MAX_TREND_SCORE) {
        return { passed: false, reason: `趋势评分${trendScore}分，需要${config.MIN_TREND_SCORE}-${config.MAX_TREND_SCORE}分` };
    }
    
    // 2. RSI检查
    if (rsi < config.RSI_MIN || rsi > config.RSI_MAX) {
        return { passed: false, reason: `RSI ${rsi}，需要${config.RSI_MIN}-${config.RSI_MAX}` };
    }
    
    // 3. 成交量检查
    if (volumeRatio < config.MIN_VOLUME_RATIO) {
        return { passed: false, reason: `成交量${volumeRatio}x，需要>=${config.MIN_VOLUME_RATIO}x` };
    }
    
    // 4. 24h涨跌幅检查
    if (priceChange24h < config.MIN_24H_CHANGE || priceChange24h > config.MAX_24H_CHANGE) {
        return { passed: false, reason: `24h涨跌${priceChange24h}%，需要${config.MIN_24H_CHANGE}% ~ ${config.MAX_24H_CHANGE}%` };
    }
    
    // 5. 大盘趋势检查
    if (marketTrend < config.MIN_MARKET_TREND) {
        return { passed: false, reason: `大盘趋势${marketTrend}分，需要>=${config.MIN_MARKET_TREND}分` };
    }
    
    // 6. 波动率检查
    if (volatility < config.MIN_VOLATILITY || volatility > config.MAX_VOLATILITY) {
        return { passed: false, reason: `波动率${volatility}%，需要${config.MIN_VOLATILITY}% ~ ${config.MAX_VOLATILITY}%` };
    }
    
    return { passed: true, reason: '满足所有短线买入条件' };
}

// ============================================
// 检查是否需要止盈止损
// ============================================
function checkShortTermExit(position, currentPrice, entryTime) {
    const config = SHORT_TERM_CONFIG;
    
    const entryPrice = position.entryPrice;
    const pnl = ((currentPrice - entryPrice) / entryPrice) * 100;
    const hoursSinceEntry = (Date.now() - entryTime) / (1000 * 60 * 60);
    
    // 1. 止损检查
    if (pnl <= config.STOP_LOSS) {
        return { shouldExit: true, action: 'STOP_LOSS', reason: `亏损${pnl.toFixed(2)}%，触发止损` };
    }
    
    // 2. 第一止盈检查
    if (pnl >= config.TAKE_PROFIT_1 && !position.partialExit) {
        return { shouldExit: true, action: 'TAKE_PROFIT_1', reason: `盈利${pnl.toFixed(2)}%，减仓50%` };
    }
    
    // 3. 第二止盈检查
    if (pnl >= config.TAKE_PROFIT_2) {
        return { shouldExit: true, action: 'TAKE_PROFIT_2', reason: `盈利${pnl.toFixed(2)}%，清仓` };
    }
    
    // 4. 时间止损检查
    if (hoursSinceEntry >= config.TIME_STOP) {
        return { shouldExit: true, action: 'TIME_STOP', reason: `持仓${hoursSinceEntry.toFixed(1)}小时，时间止损` };
    }
    
    return { shouldExit: false };
}

// ============================================
// 获取今日交易次数
// ============================================
function getTodayTradeCount() {
    const today = new Date().toISOString().split('T')[0];
    const statsFile = './short_term_stats.json';
    
    if (fs.existsSync(statsFile)) {
        const stats = JSON.parse(fs.readFileSync(statsFile, 'utf8'));
        if (stats.date === today) {
            return stats.tradeCount || 0;
        }
    }
    
    return 0;
}

// ============================================
// 记录交易
// ============================================
function recordTrade(coin, action, price, amount) {
    const today = new Date().toISOString().split('T')[0];
    const statsFile = './short_term_stats.json';
    
    let stats = { date: today, tradeCount: 0, trades: [] };
    
    if (fs.existsSync(statsFile)) {
        const existingStats = JSON.parse(fs.readFileSync(statsFile, 'utf8'));
        if (existingStats.date === today) {
            stats = existingStats;
        }
    }
    
    stats.tradeCount++;
    stats.trades.push({
        time: new Date().toISOString(),
        coin,
        action,
        price,
        amount
    });
    
    fs.writeFileSync(statsFile, JSON.stringify(stats, null, 2));
}

// ============================================
// 导出模块
// ============================================
module.exports = {
    SHORT_TERM_CONFIG,
    checkShortTermBuyCondition,
    checkShortTermExit,
    getTodayTradeCount,
    recordTrade
};
