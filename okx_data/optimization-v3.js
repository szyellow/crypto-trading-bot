// ============================================
// AI交易系统 v3.0 优化模块
// ============================================

// 1. 选币优化 - 过滤高波动和横盘币种
function filterCoinsByVolatility(coins, maxVol = 8, minVol = 0.5) {
    return coins.filter(coin => {
        const volatility = coin.volatility || 0;
        return volatility >= minVol && volatility <= maxVol;
    });
}

// 2. 分批止盈计算
function calculatePartialTakeProfits(position, levels) {
    const sells = [];
    let remaining = position.amount;
    
    levels.forEach(level => {
        const sellAmount = position.amount * level.sellRatio;
        if (sellAmount > 0 && remaining >= sellAmount) {
            sells.push({
                price: position.costPrice * (1 + level.percent / 100),
                amount: sellAmount,
                percent: level.percent
            });
            remaining -= sellAmount;
        }
    });
    
    return sells;
}

// 3. 时间衰减止损 - 持仓时间越长，止损越紧
function calculateTimeDecayStoploss(baseStop, entryTime, currentTime, decayFactor = 0.1) {
    const hoursHeld = (currentTime - entryTime) / (1000 * 60 * 60);
    const adjustedStop = baseStop - (hoursHeld * decayFactor);
    return Math.max(adjustedStop, -5); // 最紧不超过-5%
}

// 4. 支撑位检测
function detectSupportLevel(prices, lookback = 20) {
    const recentPrices = prices.slice(-lookback);
    const minPrice = Math.min(...recentPrices);
    const touches = recentPrices.filter(p => Math.abs(p - minPrice) / minPrice < 0.01).length;
    return { level: minPrice, strength: touches };
}

// 5. 回调买入检测
function detectPullback(prices, threshold = -2) {
    const recentHigh = Math.max(...prices.slice(-10));
    const currentPrice = prices[prices.length - 1];
    const pullback = (currentPrice - recentHigh) / recentHigh * 100;
    return pullback <= threshold;
}

module.exports = {
    filterCoinsByVolatility,
    calculatePartialTakeProfits,
    calculateTimeDecayStoploss,
    detectSupportLevel,
    detectPullback
};
