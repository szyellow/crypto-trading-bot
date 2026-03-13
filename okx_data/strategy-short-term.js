// ============================================
// 短线高胜率策略 v3.0
// 借鉴 @puff_2002 (千金一刻) 的交易理念
// 核心：高胜率 + 严格止损 + 快速进出
// ============================================

const fs = require('fs');

// ============================================
// 策略配置 - 优化1：放宽条件，提高买入频率
// ============================================
const SHORT_TERM_CONFIG = {
    // 选股门槛（放宽）
    MIN_TREND_SCORE: 6,           // 趋势评分 >= 6分（原8分，降低2分）
    MAX_TREND_SCORE: 10,          // 趋势评分 <= 10分
    RSI_MIN: 30,                  // RSI >= 30（原40，降低10）
    RSI_MAX: 70,                  // RSI <= 70（原60，提高10）
    MIN_VOLUME_RATIO: 0.8,        // 成交量 >= 0.8x（原1.0，降低0.2）
    MAX_24H_CHANGE: 8,            // 24h涨跌幅 <= +8%（原5%，放宽）
    MIN_24H_CHANGE: -5,           // 24h涨跌幅 >= -5%（原-2%，放宽）
    MIN_MARKET_TREND: 4,          // 大盘趋势 >= 4分（原6分，降低2分）
    
    // 仓位管理
    POSITION_SIZE: 40,            // 单笔金额 $40
    MAX_POSITIONS: 3,             // 最大持仓3个
    MAX_POSITION_PERCENT: 15,     // 单个币种最大占比15%
    
    // 止盈止损（优化3：更激进的止盈）
    STOP_LOSS: -1.5,              // 止损 -1.5%（原-1%，放宽）
    TAKE_PROFIT_1: 1.0,           // 第一止盈 +1%（原2%，降低）
    TAKE_PROFIT_2: 2.0,           // 第二止盈 +2%（原5%，降低）
    TIME_STOP: 48,                // 时间止损 48小时（原24，放宽）
    
    // 交易频率控制
    MIN_TRADE_INTERVAL: 2,        // 同一币种最小交易间隔2小时（原4，缩短）
    MAX_DAILY_TRADES: 5,          // 每日最大交易笔数（原3，增加）
    
    // 波动率筛选（放宽）
    MIN_VOLATILITY: 0.3,          // 最小波动率0.3%（原0.5，降低）
    MAX_VOLATILITY: 5.0,          // 最大波动率5%（原3%，放宽）
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
