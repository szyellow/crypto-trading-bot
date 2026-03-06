// ============================================
// 策略优化配置 - v2.2
// 整合《短线六大必杀法》
// ============================================

const fs = require('fs');
const { request } = require('./okx-api.js');

// ============================================
// 金字塔建仓配置
// ============================================
const PYRAMID_CONFIG = {
    enabled: true,
    firstLayer: 25,      // 首仓 $25
    secondLayer: 15,     // 跌10%补仓 $15
    thirdLayer: 10,      // 再跌10%补仓 $10
    dropThreshold: 0.10, // 跌幅阈值 10%
    maxLayers: 3         // 最多3层
};

// 记录金字塔建仓层级
let PYRAMID_LAYERS = {};
const PYRAMID_FILE = './ai_pyramid_layers.json';

// 加载金字塔层级记录
if (fs.existsSync(PYRAMID_FILE)) {
    try {
        PYRAMID_LAYERS = JSON.parse(fs.readFileSync(PYRAMID_FILE, 'utf8'));
        console.log('📋 已加载金字塔层级记录:', Object.keys(PYRAMID_LAYERS));
    } catch (e) {
        console.error('加载金字塔层级记录失败:', e.message);
    }
}

// 保存金字塔层级记录
function savePyramidLayers() {
    fs.writeFileSync(PYRAMID_FILE, JSON.stringify(PYRAMID_LAYERS, null, 2));
}

// 计算金字塔买入金额
function calculatePyramidBuyAmount(coin, currentPrice, avgCostPrice) {
    if (!PYRAMID_CONFIG.enabled) {
        return 40; // 默认金额
    }
    
    // 初始化币种层级记录
    if (!PYRAMID_LAYERS[coin]) {
        PYRAMID_LAYERS[coin] = {
            layers: 0,           // 当前层级
            firstBuyPrice: 0,    // 首仓价格
            lastBuyPrice: 0,     // 上次买入价格
            totalInvested: 0     // 总投入
        };
    }
    
    const layer = PYRAMID_LAYERS[coin];
    
    // 首仓
    if (layer.layers === 0) {
        layer.layers = 1;
        layer.firstBuyPrice = currentPrice;
        layer.lastBuyPrice = currentPrice;
        layer.totalInvested = PYRAMID_CONFIG.firstLayer;
        savePyramidLayers();
        console.log(`  🏔️ 金字塔建仓：${coin} 首仓 $${PYRAMID_CONFIG.firstLayer}`);
        return PYRAMID_CONFIG.firstLayer;
    }
    
    // 计算跌幅
    const dropPercent = (layer.lastBuyPrice - currentPrice) / layer.lastBuyPrice;
    
    // 检查是否满足补仓条件
    if (dropPercent >= PYRAMID_CONFIG.dropThreshold) {
        layer.layers++;
        layer.lastBuyPrice = currentPrice;
        
        let buyAmount = 0;
        if (layer.layers === 2) {
            buyAmount = PYRAMID_CONFIG.secondLayer;
        } else if (layer.layers === 3) {
            buyAmount = PYRAMID_CONFIG.thirdLayer;
        } else {
            // 超过3层不再补仓
            console.log(`  🏔️ 金字塔建仓：${coin} 已达最大层级(${PYRAMID_CONFIG.maxLayers})，不再补仓`);
            return 0;
        }
        
        layer.totalInvested += buyAmount;
        savePyramidLayers();
        console.log(`  🏔️ 金字塔建仓：${coin} 第${layer.layers}层补仓 $${buyAmount} (跌幅${(dropPercent*100).toFixed(2)}%)`);
        return buyAmount;
    }
    
    // 不满足补仓条件，返回0
    console.log(`  🏔️ 金字塔建仓：${coin} 当前跌幅${(dropPercent*100).toFixed(2)}% < ${(PYRAMID_CONFIG.dropThreshold*100).toFixed(0)}%，不补仓`);
    return 0;
}

// 重置金字塔层级（卖出后调用）
function resetPyramidLayers(coin) {
    if (PYRAMID_LAYERS[coin]) {
        delete PYRAMID_LAYERS[coin];
        savePyramidLayers();
        console.log(`  🏔️ 金字塔建仓：${coin} 层级已重置`);
    }
}

// ============================================
// 阴线买入信号配置 - v2.3 增强版（加密货币优化）
// ============================================
const BEARISH_CANDLE_CONFIG = {
    enabled: true,
    consecutiveCount: 2,     // 连续阴线数量
    minTrendScore: 6,        // 最小趋势评分
    priceBelowMA: true,      // 价格需低于MA5
    // v2.3 新增：RSI超卖验证（针对加密货币调整）
    rsiEnabled: true,
    rsiPeriod: 14,
    rsiOversold: 40,         // RSI超卖阈值（币市更宽松：40 vs 股市30）
    // v2.3 新增：成交量验证
    volumeEnabled: true,
    volumeRatio: 1.2,        // 第二根阴线成交量需大于第一根的1.2倍
    // v2.3 新增：K线周期（币市用更短周期）
    candleInterval: '5m'     // 5分钟K线（币市更敏感）
};

// 计算RSI
function calculateRSI(prices, period = 14) {
    if (prices.length < period + 1) return 50;
    
    let gains = 0;
    let losses = 0;
    
    for (let i = prices.length - period; i < prices.length; i++) {
        const change = prices[i] - prices[i - 1];
        if (change > 0) gains += change;
        else losses -= change;
    }
    
    const avgGain = gains / period;
    const avgLoss = losses / period;
    
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
}

// 检查连续阴线 - v2.3 增强版（增加RSI和成交量验证）
async function checkConsecutiveBearishCandles(instId, currentPrice) {
    if (!BEARISH_CANDLE_CONFIG.enabled) {
        return { isBearish: false };
    }
    
    try {
        // 获取5分钟K线（币市更敏感，原15分钟）
        const candles = await request(`/api/v5/market/candles?instId=${instId}&bar=${BEARISH_CANDLE_CONFIG.candleInterval}&limit=50`);
        if (candles.code !== '0' || !candles.data || candles.data.length < 20) {
            return { isBearish: false };
        }
        
        const data = candles.data.map(c => ({
            open: parseFloat(c[1]),
            high: parseFloat(c[2]),
            low: parseFloat(c[3]),
            close: parseFloat(c[4]),
            volume: parseFloat(c[5])
        })).reverse();
        
        // 检查最近N根是否为阴线
        const recentCandles = data.slice(-BEARISH_CANDLE_CONFIG.consecutiveCount);
        const isAllBearish = recentCandles.every(c => c.close < c.open);
        
        // 计算MA5
        const prices = data.map(d => d.close);
        const ma5 = prices.slice(-5).reduce((a, b) => a + b, 0) / 5;
        
        // 检查价格是否低于MA5
        const belowMA = currentPrice < ma5;
        
        // v2.3 新增：RSI超卖验证（币市阈值40更宽松）
        let rsiCheck = true;
        let rsiValue = 50;
        if (BEARISH_CANDLE_CONFIG.rsiEnabled) {
            rsiValue = calculateRSI(prices, BEARISH_CANDLE_CONFIG.rsiPeriod);
            rsiCheck = rsiValue < BEARISH_CANDLE_CONFIG.rsiOversold;
            console.log(`  📊 RSI验证: ${rsiValue.toFixed(1)} (币市阈值<${BEARISH_CANDLE_CONFIG.rsiOversold}，股市<30) ${rsiCheck ? '✅超卖' : '❌未超卖'}`);
        }
        
        // v2.3 新增：成交量验证（放量下跌）
        let volumeCheck = true;
        let volumeRatio = 1;
        if (BEARISH_CANDLE_CONFIG.volumeEnabled && recentCandles.length >= 2) {
            const vol1 = recentCandles[0].volume;
            const vol2 = recentCandles[1].volume;
            volumeRatio = vol2 / vol1;
            volumeCheck = volumeRatio >= BEARISH_CANDLE_CONFIG.volumeRatio;
            console.log(`  📊 成交量验证: ${volumeRatio.toFixed(2)}x (阈值>${BEARISH_CANDLE_CONFIG.volumeRatio}) ${volumeCheck ? '✅放量' : '❌未放量'}`);
        }
        
        if (isAllBearish && belowMA && rsiCheck && volumeCheck) {
            const dropPercent = ((recentCandles[0].open - recentCandles[recentCandles.length-1].close) / recentCandles[0].open * 100);
            console.log(`  ✅ 阴线买入信号确认：连续${BEARISH_CANDLE_CONFIG.consecutiveCount}根阴线，RSI${rsiValue.toFixed(1)}超卖，成交量${volumeRatio.toFixed(2)}x放量`);
            return { 
                isBearish: true, 
                dropPercent,
                rsi: rsiValue,
                volumeRatio
            };
        } else {
            // v2.3 新增：详细记录未通过原因
            const reasons = [];
            if (!isAllBearish) reasons.push('非连续阴线');
            if (!belowMA) reasons.push('价格未低于MA5');
            if (!rsiCheck) reasons.push(`RSI未超卖(${rsiValue.toFixed(1)})`);
            if (!volumeCheck) reasons.push(`成交量未放量(${volumeRatio.toFixed(2)}x)`);
            
            if (reasons.length > 0) {
                console.log(`  ⏭️ 阴线买入信号未通过: ${reasons.join(', ')}`);
            }
        }
        
        return { isBearish: false };
    } catch (e) {
        console.error(`检查阴线信号失败:`, e.message);
        return { isBearish: false };
    }
}

// ============================================
// 横盘检测配置
// ============================================
const SIDEWAYS_CONFIG = {
    enabled: true,
    trendScoreRange: [3, 5],  // 趋势评分范围
    maxVolatility: 0.5,       // 最大波动率
    minPeriods: 3             // 最小横盘周期数
};

// 横盘状态记录
let SIDEWAYS_STATUS = {};
const SIDEWAYS_FILE = './ai_sideways_status.json';

// 加载横盘状态
if (fs.existsSync(SIDEWAYS_FILE)) {
    try {
        SIDEWAYS_STATUS = JSON.parse(fs.readFileSync(SIDEWAYS_FILE, 'utf8'));
    } catch (e) {
        console.error('加载横盘状态失败:', e.message);
    }
}

// 保存横盘状态
function saveSidewaysStatus() {
    fs.writeFileSync(SIDEWAYS_FILE, JSON.stringify(SIDEWAYS_STATUS, null, 2));
}

// 检测横盘
async function isSidewaysMarket(instId, trendScore, volatility) {
    if (!SIDEWAYS_CONFIG.enabled) {
        return { isSideways: false };
    }
    
    const coin = instId.replace('-USDT', '');
    
    // 检查是否满足横盘条件
    const inRange = trendScore >= SIDEWAYS_CONFIG.trendScoreRange[0] && 
                    trendScore <= SIDEWAYS_CONFIG.trendScoreRange[1];
    const lowVolatility = volatility < SIDEWAYS_CONFIG.maxVolatility;
    
    if (inRange && lowVolatility) {
        // 初始化或增加横盘周期计数
        if (!SIDEWAYS_STATUS[coin]) {
            SIDEWAYS_STATUS[coin] = { periods: 1, startTime: Date.now() };
        } else {
            SIDEWAYS_STATUS[coin].periods++;
        }
        
        saveSidewaysStatus();
        
        if (SIDEWAYS_STATUS[coin].periods >= SIDEWAYS_CONFIG.minPeriods) {
            console.log(`  ➡️ 横盘检测：${coin} 已连续${SIDEWAYS_STATUS[coin].periods}周期横盘(趋势${trendScore}分,波动率${volatility.toFixed(2)}%)，暂停买入`);
            return { isSideways: true, periods: SIDEWAYS_STATUS[coin].periods };
        }
    } else {
        // 不满足横盘条件，重置计数
        if (SIDEWAYS_STATUS[coin]) {
            delete SIDEWAYS_STATUS[coin];
            saveSidewaysStatus();
        }
    }
    
    return { isSideways: false };
}

// ============================================
// 暴跌反弹检测配置
// ============================================
const CRASH_REBOUND_CONFIG = {
    enabled: true,
    crashThreshold: -0.10,    // 24h跌幅阈值 -10%
    reboundTrendScore: 6,     // 反弹时趋势评分
    minReboundPercent: 0.02   // 最小反弹幅度 2%
};

// 检测暴跌反弹
async function checkCrashRebound(instId, change24h, trendScore) {
    if (!CRASH_REBOUND_CONFIG.enabled) {
        return { isRebound: false };
    }
    
    // 检查是否暴跌后反弹
    if (change24h <= CRASH_REBOUND_CONFIG.crashThreshold && trendScore >= CRASH_REBOUND_CONFIG.reboundTrendScore) {
        console.log(`  💥 暴跌反弹信号：24h跌幅${(change24h*100).toFixed(2)}% <= ${(CRASH_REBOUND_CONFIG.crashThreshold*100).toFixed(0)}%，趋势评分${trendScore}分，触发买入`);
        return { 
            isRebound: true, 
            dropPercent: change24h,
            trendScore
        };
    }
    
    return { isRebound: false };
}

// ============================================
// 趋势变盘减仓配置
// ============================================
const TREND_REVERSAL_CONFIG = {
    enabled: true,
    fromTrend: 8,           // 从>=8分
    toTrend: 5,             // 降至<=5分
    minPeriods: 3,          // 最小横盘周期
    reducePercent: 0.5      // 减仓50%
};

// 趋势历史记录
let TREND_HISTORY = {};
const TREND_HISTORY_FILE = './ai_trend_history.json';

// 加载趋势历史
if (fs.existsSync(TREND_HISTORY_FILE)) {
    try {
        TREND_HISTORY = JSON.parse(fs.readFileSync(TREND_HISTORY_FILE, 'utf8'));
    } catch (e) {
        console.error('加载趋势历史失败:', e.message);
    }
}

// 保存趋势历史
function saveTrendHistory() {
    fs.writeFileSync(TREND_HISTORY_FILE, JSON.stringify(TREND_HISTORY, null, 2));
}

// 检测趋势变盘
function checkTrendReversal(coin, currentTrendScore) {
    if (!TREND_REVERSAL_CONFIG.enabled) {
        return { shouldReduce: false };
    }
    
    // 初始化趋势历史
    if (!TREND_HISTORY[coin]) {
        TREND_HISTORY[coin] = {
            scores: [currentTrendScore],
            highTrendCount: currentTrendScore >= TREND_REVERSAL_CONFIG.fromTrend ? 1 : 0
        };
    } else {
        TREND_HISTORY[coin].scores.push(currentTrendScore);
        // 只保留最近10个评分
        if (TREND_HISTORY[coin].scores.length > 10) {
            TREND_HISTORY[coin].scores.shift();
        }
        
        // 统计高分次数
        if (currentTrendScore >= TREND_REVERSAL_CONFIG.fromTrend) {
            TREND_HISTORY[coin].highTrendCount++;
        }
    }
    
    saveTrendHistory();
    
    const history = TREND_HISTORY[coin];
    const scores = history.scores;
    
    // 检查是否曾经高分
    const hadHighTrend = history.highTrendCount > 0;
    
    // 检查最近是否持续低分
    const recentLowTrend = scores.slice(-TREND_REVERSAL_CONFIG.minPeriods).every(
        s => s <= TREND_REVERSAL_CONFIG.toTrend
    );
    
    // 检查是否横盘（趋势评分在3-5分之间）
    const isSideways = scores.slice(-TREND_REVERSAL_CONFIG.minPeriods).every(
        s => s >= 3 && s <= 5
    );
    
    if (hadHighTrend && recentLowTrend && isSideways) {
        console.log(`  🔄 趋势变盘：${coin} 从高分(≥${TREND_REVERSAL_CONFIG.fromTrend})降至低分(≤${TREND_REVERSAL_CONFIG.toTrend})并横盘${TREND_REVERSAL_CONFIG.minPeriods}周期，减仓${(TREND_REVERSAL_CONFIG.reducePercent*100).toFixed(0)}%`);
        return { 
            shouldReduce: true, 
            reducePercent: TREND_REVERSAL_CONFIG.reducePercent,
            reason: `趋势变盘：从高分降至低分并横盘`
        };
    }
    
    return { shouldReduce: false };
}

// 导出配置和函数
module.exports = {
    // 金字塔建仓
    PYRAMID_CONFIG,
    calculatePyramidBuyAmount,
    resetPyramidLayers,
    
    // 阴线买入
    BEARISH_CANDLE_CONFIG,
    checkConsecutiveBearishCandles,
    
    // 横盘检测
    SIDEWAYS_CONFIG,
    isSidewaysMarket,
    
    // 暴跌反弹
    CRASH_REBOUND_CONFIG,
    checkCrashRebound,
    
    // 趋势变盘
    TREND_REVERSAL_CONFIG,
    checkTrendReversal
};
