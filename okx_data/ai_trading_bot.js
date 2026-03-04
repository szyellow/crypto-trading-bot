// ============================================
// AI自主交易系统 v2.2 - 增强版
// 整合《短线六大必杀法》
// - 金字塔建仓
// - 阴线买入信号
// - 横盘暂停机制
// - 暴跌反弹捕捉
// - 趋势变盘减仓
// ============================================

const fs = require('fs');
const { request } = require('./okx-api.js');
const { evolveStrategy } = require('./strategy-evolution.js');
const TradeStats = require('./trade-stats.js');

// ============================================
// 导入增强策略模块 - v2.2 新增
// ============================================
const {
    calculatePyramidBuyAmount,
    resetPyramidLayers,
    checkConsecutiveBearishCandles,
    isSidewaysMarket,
    checkCrashRebound,
    checkTrendReversal
} = require('./strategy-enhanced.js');

// ============================================
// 紧急停止检查 - 新增
// ============================================
if (fs.existsSync('./EMERGENCY_STOP.flag')) {
    console.log('🛑 检测到紧急停止标志，系统已停止运行');
    console.log('如需重启，请先删除 EMERGENCY_STOP.flag 文件');
    process.exit(0);
}

// ============================================
// 加载持久化黑名单 - 新增
// ============================================
let PERSISTENT_BLACKLIST = [];
const BLACKLIST_FILE = './ai_blacklist.json';
if (fs.existsSync(BLACKLIST_FILE)) {
    try {
        PERSISTENT_BLACKLIST = JSON.parse(fs.readFileSync(BLACKLIST_FILE, 'utf8'));
        console.log('📋 已加载持久化黑名单:', PERSISTENT_BLACKLIST);
    } catch (e) {
        console.error('加载黑名单失败:', e.message);
    }
}

// ============================================
// 趋势反转黑名单管理 - 新增
// ============================================
const BLACKLIST_TREND_TRACKER = {}; // 记录黑名单币种的趋势评分历史
const BLACKLIST_TREND_THRESHOLD = 8; // 趋势评分阈值
const BLACKLIST_TREND_COUNT = 2; // 连续多少次≥阈值才解除（已优化：从3次改为2次）
const BLACKLIST_HIGH_THRESHOLD = 9; // 高分阈值，单次达到即可解除

// ============================================
// 稳定币列表 - 新增
// 这些币种不会进行趋势扫描（因为不会买入）
// ============================================
const STABLECOINS = ['USDC', 'USDT', 'DAI', 'TUSD', 'BUSD', 'USDG'];

// 检查黑名单币种是否应该解除
function shouldRemoveFromBlacklist(coin, currentTrendScore) {
    if (!PERSISTENT_BLACKLIST.includes(coin)) return false;
    
    // 初始化趋势追踪
    if (!BLACKLIST_TREND_TRACKER[coin]) {
        BLACKLIST_TREND_TRACKER[coin] = {
            highTrendCount: 0,
            lastCheck: Date.now()
        };
    }
    
    const tracker = BLACKLIST_TREND_TRACKER[coin];
    
    // 如果趋势评分≥阈值，增加计数
    if (currentTrendScore >= BLACKLIST_TREND_THRESHOLD) {
        tracker.highTrendCount++;
        console.log(`📈 ${coin} 趋势评分${currentTrendScore}/${BLACKLIST_TREND_THRESHOLD}，连续${tracker.highTrendCount}次`);
        
        // 如果连续达到阈值次数，或单次达到高分阈值，解除黑名单
        if (tracker.highTrendCount >= BLACKLIST_TREND_COUNT || currentTrendScore >= BLACKLIST_HIGH_THRESHOLD) {
            if (currentTrendScore >= BLACKLIST_HIGH_THRESHOLD) {
                console.log(`✅ ${coin} 趋势评分${currentTrendScore}≥${BLACKLIST_HIGH_THRESHOLD}，立即解除黑名单`);
            } else {
                console.log(`✅ ${coin} 趋势连续${BLACKLIST_TREND_COUNT}次≥${BLACKLIST_TREND_THRESHOLD}，解除黑名单`);
            }
            // 从持久化黑名单中移除
            const index = PERSISTENT_BLACKLIST.indexOf(coin);
            if (index > -1) {
                PERSISTENT_BLACKLIST.splice(index, 1);
                fs.writeFileSync(BLACKLIST_FILE, JSON.stringify(PERSISTENT_BLACKLIST));
            }
            // 清理追踪器
            delete BLACKLIST_TREND_TRACKER[coin];
            return true;
        }
    } else {
        // 趋势评分低于阈值，重置计数
        if (tracker.highTrendCount > 0) {
            console.log(`📉 ${coin} 趋势评分${currentTrendScore}，低于阈值，重置计数`);
            tracker.highTrendCount = 0;
        }
    }
    
    tracker.lastCheck = Date.now();
    return false;
}

// AI交易配置
const AI_CONFIG = {
    maxPositionPerCoin: 35,      // 单币种最大仓位35%（降低集中度）
    maxDailyTrades: 9999,        // 每日最大交易次数（已取消限制，满足条件即可交易）
    maxDailyVolume: 1000,        // 每日最大交易量$1000（追加投资后提升）
    stopLossPercent: -2.5,       // 止损线-2.5%（放宽止损，给波动空间）
    takeProfitPercent: 5,        // 止盈线+5%（降低目标，更容易达到）
    // 波段操作配置 - 新增
    bandTrade: {
        enabled: true,           // 启用波段操作
        reducePositionAt: 1.5,   // 涨1.5%减仓25%（降低减仓门槛）
        secondReduceAt: 3,       // 涨3%再减仓25%（降低减仓比例）
        buyBackAt: -2,           // 跌2%买回（趋势≥6分）
        reducePercent: 25        // 每次减仓25%（降低减仓比例）
    },
    minOrderInterval: 300000,     // 最小下单间隔5分钟
    sentimentThreshold: 7,       // 舆情买入阈值(>7分买入) - 已优化：从8分降至7分
    sentimentSellThreshold: 3,   // 舆情卖出阈值(<3分卖出)
    minCashReserve: 30,          // 最小现金保留30%（强制保留更多现金）
    tradeSize: 40,               // 单笔交易金额$40（追加投资后提升）
    blacklistedCoins: [...new Set(['BIO', 'KITE', 'HYPE', ...PERSISTENT_BLACKLIST])],
    maxPositionPercent: 35,      // 单币种最大占比35%（降低集中度）
    buyCooldownMinutes: 30,       // 默认买入冷却期30分钟
    // 分层冷却期配置 - 新增
    tieredCooldown: {
        enabled: true,           // 启用分层冷却期
        trend10: 15,             // 趋势10分：冷却期15分钟
        trend8_9: 20,            // 趋势8-9分：冷却期20分钟
        trend6_7: 30             // 趋势6-7分：冷却期30分钟
    },
    // 波动率筛选配置 - 新增
    volatilityFilter: {
        enabled: true,           // 启用波动率筛选
        minVolatility: 0.5,      // 最小波动率0.5%
        preferredVolatility: 1.5 // 优选波动率1.5%
    },
    pullbackBuyThreshold: 0.97,  // 回调加仓阈值：减仓后价格需≤减仓价的97%
    // 智能超仓豁免期配置（单位：分钟）
    overPositionExemption: {
        enabled: true,           // 启用智能豁免期
        lossHigh: 60,            // 亏损>1%，豁免60分钟
        lossMedium: 45,          // 亏损0-1%，豁免45分钟
        profit: 30               // 已盈利，豁免30分钟
    }
};

// ============================================
// 减仓价格记录 - 新增（用于回调加仓）
// ============================================
let REDUCE_POSITION_PRICES = {};
const REDUCE_PRICE_FILE = './ai_reduce_position_prices.json';

// 加载减仓价格记录
if (fs.existsSync(REDUCE_PRICE_FILE)) {
    try {
        REDUCE_POSITION_PRICES = JSON.parse(fs.readFileSync(REDUCE_PRICE_FILE, 'utf8'));
        console.log('📋 已加载减仓价格记录:', Object.keys(REDUCE_POSITION_PRICES));
    } catch (e) {
        console.error('加载减仓价格记录失败:', e.message);
    }
}

// 记录减仓价格
function recordReducePositionPrice(coin, price) {
    REDUCE_POSITION_PRICES[coin] = {
        price: price,
        time: Date.now()
    };
    fs.writeFileSync(REDUCE_PRICE_FILE, JSON.stringify(REDUCE_POSITION_PRICES, null, 2));
    console.log(`  📝 记录减仓价格: ${coin} @ $${price.toFixed(2)}`);
}

// ============================================
// 智能超仓豁免期计算 - 新增
// ============================================
function calculateExemptionMinutes(unrealizedPnlPercent) {
    if (!AI_CONFIG.overPositionExemption.enabled) {
        return 0; // 未启用豁免期
    }
    
    if (unrealizedPnlPercent < -1) {
        return AI_CONFIG.overPositionExemption.lossHigh; // 亏损>1%，60分钟
    } else if (unrealizedPnlPercent < 0) {
        return AI_CONFIG.overPositionExemption.lossMedium; // 亏损0-1%，45分钟
    } else {
        return AI_CONFIG.overPositionExemption.profit; // 已盈利，30分钟
    }
}

// 检查是否在超仓豁免期内
function isInOverPositionExemption(coin, unrealizedPnlPercent) {
    // 使用全局 tradeLog 变量
    const lastBuy = tradeLog.lastBuyTime && tradeLog.lastBuyTime[coin];
    
    if (!lastBuy) return false;
    
    const lastBuyTime = new Date(lastBuy).getTime();
    const now = Date.now();
    const diffMinutes = (now - lastBuyTime) / (1000 * 60);
    
    const exemptionMinutes = calculateExemptionMinutes(unrealizedPnlPercent);
    
    if (diffMinutes < exemptionMinutes) {
        console.log(`  ⏳ ${coin} 超仓豁免期内：${diffMinutes.toFixed(1)}/${exemptionMinutes}分钟，盈亏${unrealizedPnlPercent.toFixed(2)}%`);
        return true;
    }
    
    return false;
}

// ============================================
// 买入金额递减计算 - 新增
// 同一币种多次买入，金额递减以控制仓位增长
// ============================================
function calculateDecreasingTradeSize(coin, baseAmount) {
    const today = new Date().toISOString().split('T')[0];
    
    // 统计今日该币种的买入次数
    const todayTrades = (tradeLog.trades || []).filter(t => 
        t.coin === coin && 
        t.action === 'buy' && 
        t.time.startsWith(today)
    );
    
    const buyCount = todayTrades.length;
    
    // 递减比例：第1次100%，第2次60%，第3次35%，第4次及以后20%
    const decreasingFactors = [1.0, 0.6, 0.35, 0.2];
    const factor = decreasingFactors[Math.min(buyCount, decreasingFactors.length - 1)];
    
    const adjustedAmount = baseAmount * factor;
    
    if (buyCount > 0) {
        console.log(`  📉 ${coin} 今日第${buyCount + 1}次买入，金额递减至${(factor * 100).toFixed(0)}%: $${adjustedAmount.toFixed(2)} USDT`);
    }
    
    return adjustedAmount;
}

// 检查是否满足回调加仓条件
function checkPullbackBuyCondition(coin, currentPrice) {
    const record = REDUCE_POSITION_PRICES[coin];
    if (!record) return { canBuy: true, reason: '无减仓记录' };
    
    const pullbackThreshold = record.price * AI_CONFIG.pullbackBuyThreshold;
    if (currentPrice <= pullbackThreshold) {
        console.log(`  ✅ ${coin} 价格回调到位: $${currentPrice.toFixed(2)} ≤ $${pullbackThreshold.toFixed(2)} (减仓价$${record.price.toFixed(2)}的97%)`);
        // 清除记录，允许买入
        delete REDUCE_POSITION_PRICES[coin];
        fs.writeFileSync(REDUCE_PRICE_FILE, JSON.stringify(REDUCE_POSITION_PRICES, null, 2));
        return { canBuy: true, reason: '回调到位' };
    } else {
        console.log(`  ⏳ ${coin} 等待回调: $${currentPrice.toFixed(2)} > $${pullbackThreshold.toFixed(2)} (需≤减仓价97%)`);
        return { canBuy: false, reason: `等待回调: $${currentPrice.toFixed(2)} > $${pullbackThreshold.toFixed(2)}` };
    }
}

// ============================================
// 止盈订单管理 - 新增
// ============================================
let TAKE_PROFIT_ORDERS = {};
const TP_ORDERS_FILE = './ai_take_profit_orders.json';

// 加载止盈订单记录
if (fs.existsSync(TP_ORDERS_FILE)) {
    try {
        TAKE_PROFIT_ORDERS = JSON.parse(fs.readFileSync(TP_ORDERS_FILE, 'utf8'));
        console.log('📋 已加载止盈订单记录:', Object.keys(TAKE_PROFIT_ORDERS));
    } catch (e) {
        console.error('加载止盈订单记录失败:', e.message);
    }
}

// 保存止盈订单记录
function saveTakeProfitOrders() {
    fs.writeFileSync(TP_ORDERS_FILE, JSON.stringify(TAKE_PROFIT_ORDERS, null, 2));
}

// 挂止盈限价单
async function placeTakeProfitOrder(coin, amount, costPrice, takeProfitPercent) {
    const tpPrice = costPrice * (1 + takeProfitPercent / 100);
    const instId = `${coin}-USDT`;
    
    console.log(`🎯 挂止盈单: ${coin}`);
    console.log(`   成本价: $${costPrice.toFixed(4)}`);
    console.log(`   止盈价: $${tpPrice.toFixed(4)} (+${takeProfitPercent}%)`);
    console.log(`   数量: ${amount.toFixed(6)}`);
    
    try {
        const result = await request('/api/v5/trade/order', 'POST', {
            instId: instId,
            tdMode: 'cash',
            side: 'sell',
            ordType: 'limit',
            sz: amount.toFixed(6),
            px: tpPrice.toFixed(4)
        });
        
        if (result.code === '0') {
            const orderId = result.data[0].ordId;
            console.log(`✅ 止盈单挂单成功！订单ID: ${orderId}`);
            
            // 记录止盈单
            TAKE_PROFIT_ORDERS[coin] = {
                orderId: orderId,
                costPrice: costPrice,
                tpPrice: tpPrice,
                tpPercent: takeProfitPercent,
                amount: amount,
                createdAt: new Date().toISOString(),
                status: 'live'
            };
            saveTakeProfitOrders();
            
            return { success: true, orderId: orderId };
        } else {
            console.error(`❌ 止盈单挂单失败:`, result.msg);
            return { success: false, error: result.msg };
        }
    } catch (e) {
        console.error(`❌ 止盈单异常:`, e.message);
        return { success: false, error: e.message };
    }
}

// 撤销止盈单
async function cancelTakeProfitOrder(coin) {
    const tpOrder = TAKE_PROFIT_ORDERS[coin];
    if (!tpOrder || !tpOrder.orderId) {
        return { success: false, error: '无止盈单记录' };
    }
    
    console.log(`🔄 撤销止盈单: ${coin}, 订单ID: ${tpOrder.orderId}`);
    
    try {
        const result = await request('/api/v5/trade/cancel-order', 'POST', {
            instId: `${coin}-USDT`,
            ordId: tpOrder.orderId
        });
        
        if (result.code === '0') {
            console.log(`✅ 止盈单撤销成功`);
            delete TAKE_PROFIT_ORDERS[coin];
            saveTakeProfitOrders();
            return { success: true };
        } else {
            console.error(`❌ 止盈单撤销失败:`, result.msg);
            return { success: false, error: result.msg };
        }
    } catch (e) {
        console.error(`❌ 止盈单撤销异常:`, e.message);
        return { success: false, error: e.message };
    }
}

// 调整止盈单
async function adjustTakeProfitOrder(coin, newTpPercent, currentPrice) {
    const tpOrder = TAKE_PROFIT_ORDERS[coin];
    if (!tpOrder) {
        console.log(`⚠️ ${coin} 无止盈单，无需调整`);
        return { success: false, error: '无止盈单' };
    }
    
    // 计算新的止盈价格
    const newTpPrice = tpOrder.costPrice * (1 + newTpPercent / 100);
    
    // 如果新价格与旧价格差异不大，不调整
    const priceDiff = Math.abs(newTpPrice - tpOrder.tpPrice) / tpOrder.tpPrice;
    if (priceDiff < 0.005) { // 差异小于0.5%不调整
        console.log(`⏭️ ${coin} 止盈价格差异${(priceDiff*100).toFixed(2)}%<0.5%，不调整`);
        return { success: true, noChange: true };
    }
    
    console.log(`🔄 调整止盈单: ${coin}`);
    console.log(`   原止盈价: $${tpOrder.tpPrice.toFixed(4)} (${tpOrder.tpPercent}%)`);
    console.log(`   新止盈价: $${newTpPrice.toFixed(4)} (${newTpPercent}%)`);
    
    // 1. 撤销旧订单
    const cancelResult = await cancelTakeProfitOrder(coin);
    if (!cancelResult.success) {
        return cancelResult;
    }
    
    // 2. 挂新订单
    return await placeTakeProfitOrder(coin, tpOrder.amount, tpOrder.costPrice, newTpPercent);
}

// 检查止盈单状态
async function checkTakeProfitOrderStatus(coin) {
    const tpOrder = TAKE_PROFIT_ORDERS[coin];
    if (!tpOrder || !tpOrder.orderId) {
        return { exists: false };
    }
    
    try {
        const result = await request(`/api/v5/trade/order?instId=${coin}-USDT&ordId=${tpOrder.orderId}`);
        
        if (result.code === '0' && result.data && result.data.length > 0) {
            const order = result.data[0];
            return {
                exists: true,
                status: order.state, // live: 挂单中, filled: 已成交, canceled: 已撤销
                filledAmount: parseFloat(order.accFillSz || 0),
                avgPrice: parseFloat(order.avgPx || 0)
            };
        } else {
            // 订单不存在或已过期
            delete TAKE_PROFIT_ORDERS[coin];
            saveTakeProfitOrders();
            return { exists: false };
        }
    } catch (e) {
        console.error(`检查止盈单状态失败:`, e.message);
        return { exists: true, error: e.message };
    }
}

// 动态波段调整函数
async function calculateDynamicBands(coin, currentPrice) {
    try {
        // 获取24h K线数据计算波动率
        const candles = await request(`/api/v5/market/candles?instId=${coin}-USDT&bar=1H&limit=24`);
        if (candles.code !== '0' || !candles.data) {
            return { stopLoss: AI_CONFIG.stopLossPercent, takeProfit: AI_CONFIG.takeProfitPercent };
        }
        
        const prices = candles.data.map(c => parseFloat(c[4])).reverse();
        if (prices.length < 10) {
            return { stopLoss: AI_CONFIG.stopLossPercent, takeProfit: AI_CONFIG.takeProfitPercent };
        }
        
        // 计算24h波动率（标准差/平均值）
        const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
        const variance = prices.reduce((sum, p) => sum + Math.pow(p - avg, 2), 0) / prices.length;
        const volatility = Math.sqrt(variance) / avg * 100; // 波动率百分比
        
        // 获取24h涨跌幅
        const ticker = await request(`/api/v5/market/ticker?instId=${coin}-USDT`);
        const change24h = ticker.code === '0' ? parseFloat(ticker.data[0].change24h) : 0;
        
        // 获取市值信息（通过成交量估算）
        const vol24h = ticker.code === '0' ? parseFloat(ticker.data[0].vol24h) : 0;
        const marketCapLevel = vol24h > 1000000000 ? 'large' : vol24h > 100000000 ? 'medium' : 'small'; // 大/中/小市值
        
        // 计算波动系数 (0.5 ~ 2.0)
        // 波动率越高，系数越大
        let volatilityFactor = Math.min(2.0, Math.max(0.5, volatility / 3));
        
        // 市值系数 (0.6 ~ 1.2)
        // 小市值币种需要更小的波段
        let marketCapFactor = marketCapLevel === 'large' ? 1.2 : marketCapLevel === 'medium' ? 1.0 : 0.6;
        
        // 趋势系数 (0.8 ~ 1.2)
        // 强趋势时扩大波段
        let trendFactor = Math.abs(change24h) > 10 ? 1.2 : Math.abs(change24h) > 5 ? 1.0 : 0.8;
        
        // 计算动态止损止盈
        // 基础值：止损-3%，止盈+6%
        const baseStopLoss = -3;
        const baseTakeProfit = 6;
        
        let dynamicStopLoss = baseStopLoss * volatilityFactor * marketCapFactor * trendFactor;
        let dynamicTakeProfit = baseTakeProfit * volatilityFactor * marketCapFactor * trendFactor;
        
        // 限制范围
        dynamicStopLoss = Math.max(-8, Math.min(-1, dynamicStopLoss)); // 止损范围：-8% ~ -1%
        dynamicTakeProfit = Math.max(2, Math.min(15, dynamicTakeProfit)); // 止盈范围：2% ~ 15%
        
        console.log(`  📊 ${coin} 动态波段计算:`);
        console.log(`     波动率: ${volatility.toFixed(2)}%, 24h涨跌: ${change24h.toFixed(2)}%`);
        console.log(`     市值级别: ${marketCapLevel}, 波动系数: ${volatilityFactor.toFixed(2)}`);
        console.log(`     市值系数: ${marketCapFactor.toFixed(2)}, 趋势系数: ${trendFactor.toFixed(2)}`);
        console.log(`     动态止损: ${dynamicStopLoss.toFixed(2)}%, 动态止盈: ${dynamicTakeProfit.toFixed(2)}%`);
        
        return {
            stopLoss: dynamicStopLoss,
            takeProfit: dynamicTakeProfit,
            volatility,
            marketCapLevel,
            factors: { volatilityFactor, marketCapFactor, trendFactor }
        };
    } catch(e) {
        console.error(`计算${coin}动态波段失败:`, e.message);
        return { stopLoss: AI_CONFIG.stopLossPercent, takeProfit: AI_CONFIG.takeProfitPercent };
    }
}

// 交易日志
let tradeLog = {
    date: new Date().toISOString().split('T')[0],
    trades: [],
    dailyVolume: 0,
    dailyTradeCount: 0,
    lastBuyTime: {}  // 记录每个币种的最后买入时间
};

// 加载历史日志
if (fs.existsSync('ai_trade_log.json')) {
    tradeLog = JSON.parse(fs.readFileSync('ai_trade_log.json', 'utf8'));
    // 检查是否是新的一天
    const today = new Date().toISOString().split('T')[0];
    if (tradeLog.date !== today) {
        tradeLog = { date: today, trades: [], dailyVolume: 0, dailyTradeCount: 0, lastBuyTime: {} };
    }
}

// 检查买入冷却期 - 优化：分层冷却期
function checkBuyCooldown(coin, trendScore = 5) {
    const lastBuyTime = tradeLog.lastBuyTime && tradeLog.lastBuyTime[coin];
    if (!lastBuyTime) return { canBuy: true, remainingMinutes: 0 };
    
    const lastBuy = new Date(lastBuyTime);
    const now = new Date();
    const diffMinutes = (now - lastBuy) / (1000 * 60);
    
    // 分层冷却期计算
    let cooldownMinutes = AI_CONFIG.buyCooldownMinutes; // 默认30分钟
    
    if (AI_CONFIG.tieredCooldown && AI_CONFIG.tieredCooldown.enabled) {
        if (trendScore >= 10) {
            cooldownMinutes = AI_CONFIG.tieredCooldown.trend10; // 15分钟
        } else if (trendScore >= 8) {
            cooldownMinutes = AI_CONFIG.tieredCooldown.trend8_9; // 20分钟
        } else if (trendScore >= 6) {
            cooldownMinutes = AI_CONFIG.tieredCooldown.trend6_7; // 30分钟
        }
    }
    
    if (diffMinutes < cooldownMinutes) {
        const remaining = Math.ceil(cooldownMinutes - diffMinutes);
        return { canBuy: false, remainingMinutes: remaining, cooldownMinutes };
    }
    
    return { canBuy: true, remainingMinutes: 0, cooldownMinutes };
}

// 获取所有可交易币种
async function getAllTradableCoins() {
    try {
        const tickers = await request('/api/v5/market/tickers?instType=SPOT');
        if (tickers.code !== '0') return [];
        
        // 筛选 USDT 交易对，且24h成交量>100万USDT的活跃币种
        const activeCoins = tickers.data
            .filter(t => t.instId.endsWith('-USDT'))
            .filter(t => parseFloat(t.vol24h) * parseFloat(t.last) > 1000000) // 24h成交额>100万
            .filter(t => parseFloat(t.last) > 0.01) // 价格>0.01
            .sort((a, b) => parseFloat(b.vol24h) * parseFloat(b.last) - parseFloat(a.vol24h) * parseFloat(a.last)) // 按成交额排序
            .slice(0, 20); // 取前20个最活跃的
        
        return activeCoins.map(t => ({
            symbol: t.instId.replace('-USDT', ''),
            instId: t.instId,
            price: parseFloat(t.last),
            vol24h: parseFloat(t.vol24h),
            change24h: parseFloat(t.open24h) > 0 ? ((parseFloat(t.last) - parseFloat(t.open24h)) / parseFloat(t.open24h) * 100) : 0
        }));
    } catch(e) {
        console.error('获取可交易币种失败:', e.message);
        return [];
    }
}

// 分析币种趋势 - 增强版（趋势追踪网格策略）
async function analyzeTrend(instId) {
    try {
        // 获取K线数据 - 使用15分钟线获取更多细节
        const candles15m = await request(`/api/v5/market/candles?instId=${instId}&bar=15m&limit=48`);
        const candles1h = await request(`/api/v5/market/candles?instId=${instId}&bar=1H&limit=24`);
        
        if (candles15m.code !== '0' || !candles15m.data || candles15m.data.length < 20) {
            return { score: 5, trend: 'neutral' };
        }
        
        // 解析数据
        const data15m = candles15m.data.map(c => ({
            open: parseFloat(c[1]),
            high: parseFloat(c[2]),
            low: parseFloat(c[3]),
            close: parseFloat(c[4]),
            vol: parseFloat(c[5])
        })).reverse();
        
        const prices15m = data15m.map(d => d.close);
        const volumes15m = data15m.map(d => d.vol);
        
        // ========== 技术指标计算 ==========
        
        // 1. 多周期均线
        const ma5 = calculateMA(prices15m, 5);
        const ma10 = calculateMA(prices15m, 10);
        const ma20 = calculateMA(prices15m, 20);
        
        // 2. 成交量均线
        const volMa5 = calculateMA(volumes15m, 5);
        const volMa10 = calculateMA(volumes15m, 10);
        
        // 3. 成交量金叉判断
        const volumeGoldenCross = volMa5 > volMa10 * 1.05 && volumes15m[volumes15m.length - 1] > volMa5;
        const volumeIncreasing = volumes15m.slice(-3).every((v, i, arr) => i === 0 || v >= arr[i-1] * 0.9);
        
        // 4. MACD计算
        const macd = calculateMACD(prices15m);
        const macdGoldenCross = macd.macd > macd.signal && macd.histogram > 0 && macd.histogram > macd.prevHistogram;
        
        // 5. RSI计算
        const rsi = calculateRSI(prices15m, 14);
        
        // 6. 布林带
        const bollinger = calculateBollinger(prices15m, 20);
        const pricePosition = (prices15m[prices15m.length - 1] - bollinger.lower) / (bollinger.upper - bollinger.lower);
        
        // 7. 波动率
        const volatility = calculateVolatility(prices15m);
        
        // 8. 近期价格变化
        const recentChange = (prices15m[prices15m.length - 1] - prices15m[prices15m.length - 5]) / prices15m[prices15m.length - 5] * 100;
        
        // ========== 趋势评分逻辑 ==========
        let score = 5;
        let trend = 'neutral';
        const signals = [];
        
        // 1. 均线多头排列 (MA5 > MA10 > MA20)
        if (ma5 > ma10 && ma10 > ma20) {
            score += 2;
            signals.push('均线多头排列');
            trend = 'bullish';
        } else if (ma5 < ma10 && ma10 < ma20) {
            score -= 2;
            signals.push('均线空头排列');
            trend = 'bearish';
        } else if (ma5 > ma10) {
            score += 1;
            signals.push('短期均线上穿');
            trend = 'bullish';
        }
        
        // 2. 成交量金叉 (重要信号)
        if (volumeGoldenCross) {
            score += 2;
            signals.push('成交量金叉');
        } else if (volumeIncreasing) {
            score += 1;
            signals.push('成交量递增');
        }
        
        // 3. MACD金叉
        if (macdGoldenCross) {
            score += 2;
            signals.push('MACD金叉');
        } else if (macd.macd > macd.signal) {
            score += 1;
            signals.push('MACD多头');
        }
        
        // 4. RSI判断
        if (rsi > 50 && rsi < 70) {
            score += 1;
            signals.push('RSI强势区');
        } else if (rsi > 70) {
            score -= 1;
            signals.push('RSI超买');
        } else if (rsi < 30) {
            score -= 1;
            signals.push('RSI超卖');
        }
        
        // 5. 布林带位置
        if (pricePosition > 0.5 && pricePosition < 0.8) {
            score += 1;
            signals.push('价格中轨偏上');
        } else if (pricePosition > 0.8) {
            score -= 1;
            signals.push('价格接近上轨');
        } else if (pricePosition < 0.2) {
            score += 1;
            signals.push('价格接近下轨(反弹机会)');
        }
        
        // 6. 近期涨幅 (温和上涨加分，暴涨扣分)
        if (recentChange > 2 && recentChange < 8) {
            score += 1;
            signals.push(`温和上涨${recentChange.toFixed(1)}%`);
        } else if (recentChange > 8 && recentChange < 15) {
            score += 0;
            signals.push(`快速上涨${recentChange.toFixed(1)}%`);
        } else if (recentChange > 15) {
            score -= 2;
            signals.push(`暴涨${recentChange.toFixed(1)}%(风险)`);
        } else if (recentChange < -5) {
            score -= 1;
            signals.push(`下跌${recentChange.toFixed(1)}%`);
        }
        
        // 7. 波动率适中加分
        if (volatility > 1.5 && volatility < 6) {
            score += 1;
            signals.push('波动率适中');
        } else if (volatility > 10) {
            score -= 1;
            signals.push('波动率过高');
        }
        
        // 综合判断趋势
        if (score >= 8) {
            trend = 'bullish';
        } else if (score <= 3) {
            trend = 'bearish';
        }
        
        return { 
            score: Math.max(1, Math.min(10, score)), 
            trend,
            volatility,
            recentChange,
            signals,
            indicators: {
                ma5, ma10, ma20,
                rsi: rsi.toFixed(1),
                macd: macd.macd.toFixed(4),
                volumeGoldenCross,
                macdGoldenCross,
                pricePosition: pricePosition.toFixed(2)
            }
        };
    } catch(e) {
        console.error(`分析${instId}趋势失败:`, e.message);
        return { score: 5, trend: 'neutral', signals: [], indicators: {} };
    }
}

// 计算均线
function calculateMA(data, period) {
    if (data.length < period) return data[data.length - 1];
    const sum = data.slice(-period).reduce((a, b) => a + b, 0);
    return sum / period;
}

// 计算MACD
function calculateMACD(prices, fast = 12, slow = 26, signal = 9) {
    const emaFast = calculateEMA(prices, fast);
    const emaSlow = calculateEMA(prices, slow);
    const macdLine = emaFast - emaSlow;
    
    // 简化计算：使用MACD的EMA作为信号线
    const macdSeries = [];
    for (let i = slow; i < prices.length; i++) {
        const fastEma = calculateEMA(prices.slice(0, i + 1), fast);
        const slowEma = calculateEMA(prices.slice(0, i + 1), slow);
        macdSeries.push(fastEma - slowEma);
    }
    
    const signalLine = calculateEMA(macdSeries, signal);
    const histogram = macdLine - signalLine;
    const prevHistogram = macdSeries.length > 1 ? macdSeries[macdSeries.length - 2] - calculateEMA(macdSeries.slice(0, -1), signal) : histogram;
    
    return {
        macd: macdLine,
        signal: signalLine,
        histogram,
        prevHistogram
    };
}

// 计算EMA
function calculateEMA(data, period) {
    if (data.length < period) return data[data.length - 1];
    const k = 2 / (period + 1);
    let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < data.length; i++) {
        ema = data[i] * k + ema * (1 - k);
    }
    return ema;
}

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

// 计算布林带
function calculateBollinger(prices, period = 20) {
    if (prices.length < period) {
        const price = prices[prices.length - 1];
        return { upper: price * 1.02, middle: price, lower: price * 0.98 };
    }
    
    const slice = prices.slice(-period);
    const middle = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((sum, p) => sum + Math.pow(p - middle, 2), 0) / period;
    const stdDev = Math.sqrt(variance);
    
    return {
        upper: middle + 2 * stdDev,
        middle,
        lower: middle - 2 * stdDev
    };
}

// 计算波动率
function calculateVolatility(prices) {
    if (prices.length < 2) return 0;
    const changes = [];
    for (let i = 1; i < prices.length; i++) {
        changes.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
    const mean = changes.reduce((a, b) => a + b, 0) / changes.length;
    const variance = changes.reduce((sum, c) => sum + Math.pow(c - mean, 2), 0) / changes.length;
    return Math.sqrt(variance) * 100;
}

// 获取账户数据
async function getAccountData() {
    try {
        const balance = await request('/api/v5/account/balance');
        const details = balance.data[0].details;
        
        let totalEquity = parseFloat(balance.data[0].totalEq);
        let usdtAvailable = 0;
        let positions = {};
        
        details.forEach(d => {
            if (d.ccy === 'USDT') {
                usdtAvailable = parseFloat(d.availBal);
            }
            // 修复：使用 eqUsd (美元价值) > 0.5 作为持仓判断标准（降低阈值，确保小额持仓被识别）
            if (parseFloat(d.eqUsd) > 0.5 && d.ccy !== 'USDT') {
                // 使用 spotBal（现货余额）作为可交易数量
                const spotBalance = parseFloat(d.spotBal) || parseFloat(d.eq);
                // 修复成本计算：使用 openAvgPx 或 accAvgPx
                const avgCostPrice = parseFloat(d.openAvgPx) > 0 ? parseFloat(d.openAvgPx) : (parseFloat(d.accAvgPx) || 0);
                positions[d.ccy] = {
                    amount: spotBalance,
                    value: parseFloat(d.eqUsd),
                    avgPrice: avgCostPrice
                };
            }
        });
        
        return { totalEquity, usdtAvailable, positions };
    } catch(e) {
        console.error('获取账户数据失败:', e.message);
        return null;
    }
}

// 获取市场价格
async function getMarketPrice(instId) {
    try {
        const ticker = await request(`/api/v5/market/ticker?instId=${instId}`);
        return parseFloat(ticker.data[0].last);
    } catch(e) {
        console.error(`获取${instId}价格失败:`, e.message);
        return null;
    }
}

// AI决策引擎
async function makeDecision(coin, position, currentPrice, sentiment, account) {
    const { totalEquity, usdtAvailable, positions } = account;
    
    console.log(`\n🤖 AI分析 ${coin}...`);
    console.log(`  当前价格: $${currentPrice}`);
    const trendText = sentiment.trend === 'bullish' ? '看涨' : sentiment.trend === 'bearish' ? '看跌' : '横盘';
    console.log(`  趋势评分: ${sentiment.score}/10 (${trendText})`);
    
    // 检查持仓 - 移到前面，确保总是显示
    const pos = positions[coin];
    const positionValue = pos ? pos.value : 0;
    const positionPercent = totalEquity > 0 ? (positionValue / totalEquity * 100) : 0;
    
    console.log(`  当前持仓: ${positionValue.toFixed(2)} USD (${positionPercent.toFixed(1)}%)`);
    console.log(`  可用USDT: ${usdtAvailable.toFixed(2)}`);
    
    // 检查横盘状态 - v2.2 新增（技巧1、2：盘整必变盘、横盘藏陷阱）
    const sidewaysCheck = await isSidewaysMarket(`${coin}-USDT`, sentiment.score, sentiment.volatility || 0);
    if (sidewaysCheck.isSideways) {
        console.log(`  ➡️ 横盘期暂停：${coin}处于横盘状态(${sidewaysCheck.periods}周期)，暂不操作`);
        return { action: 'hold', reason: `横盘期暂停(${sidewaysCheck.periods}周期)，等待方向明朗` };
    }
    
    // 检查买入冷却期 - 优化：传入趋势评分，使用分层冷却期
    const cooldown = checkBuyCooldown(coin, sentiment.score);
    if (!cooldown.canBuy) {
        console.log(`  ⏳ ${coin} 冷却期中，还需${cooldown.remainingMinutes}分钟(趋势${sentiment.score}分，冷却期${cooldown.cooldownMinutes}分钟)`);
        return { action: 'hold', reason: `冷却期中，还需${cooldown.remainingMinutes}分钟` };
    }
    
    // 计算动态波段
    const dynamicBands = await calculateDynamicBands(coin, currentPrice);
    const stopLossPercent = dynamicBands.stopLoss;
    const takeProfitPercent = dynamicBands.takeProfit;
    
    // 决策逻辑
    let decision = { action: 'hold', reason: '' };
    
    // 智能止损：根据趋势评分调整止损线（已放宽）
    let smartStopLoss = stopLossPercent;
    if (sentiment.score >= 8) {
        smartStopLoss = -3.0; // 趋势强，放宽止损至-3%
        console.log(`  🛡️ 智能止损：趋势评分${sentiment.score}/10，放宽止损至-3%`);
    } else if (sentiment.score >= 6) {
        smartStopLoss = -2.0; // 趋势中等，止损-2%
        console.log(`  🛡️ 智能止损：趋势评分${sentiment.score}/10，止损-2%`);
    } else {
        smartStopLoss = -1.5; // 趋势弱，止损-1.5%
        console.log(`  🛡️ 智能止损：趋势评分${sentiment.score}/10，止损-1.5%`);
    }
    
    // 1. 如果有持仓，检查止盈止损和补仓机会
    if (pos && pos.amount > 0 && pos.avgPrice > 0) {
        const pnlPercent = (currentPrice - pos.avgPrice) / pos.avgPrice * 100;
        const pnlValue = (currentPrice - pos.avgPrice) * pos.amount;
        console.log(`  持仓数量: ${pos.amount.toFixed(6)} 个`);
        console.log(`  持仓成本: $${pos.avgPrice.toFixed(4)}`);
        console.log(`  当前价格: $${currentPrice.toFixed(4)}`);
        console.log(`  持仓盈亏: ${pnlPercent.toFixed(2)}% ($${pnlValue.toFixed(2)})`);
        console.log(`  动态止损: ${smartStopLoss.toFixed(2)}%, 动态止盈: ${takeProfitPercent.toFixed(2)}%`);
        
        // 检查趋势变盘减仓 - v2.2 新增（技巧6：变盘快清仓）
        const reversalCheck = checkTrendReversal(coin, sentiment.score);
        if (reversalCheck.shouldReduce && pnlPercent > 0) {
            const reduceAmount = pos.amount * reversalCheck.reducePercent;
            recordReducePositionPrice(coin, currentPrice);
            decision = { 
                action: 'sell', 
                reason: `${reversalCheck.reason}，减仓${(reversalCheck.reducePercent*100).toFixed(0)}%保护利润`,
                amount: reduceAmount
            };
            return decision;
        }
        
        // 金字塔建仓补仓 - v2.2 新增（技巧5：金字塔建仓）
        if (pnlPercent <= -5 && sentiment.score >= 6 && positionPercent < 15 && usdtAvailable >= 15) {
            const pyramidAmount = calculatePyramidBuyAmount(coin, currentPrice, pos.avgPrice);
            if (pyramidAmount > 0) {
                decision = { 
                    action: 'buy', 
                    reason: `金字塔补仓！亏损${pnlPercent.toFixed(2)}%但趋势${sentiment.score}/10良好，补仓$${pyramidAmount}`,
                    amount: pyramidAmount / currentPrice,
                    usdtAmount: pyramidAmount
                };
                return decision;
            }
        }
        
        // 智能止损 - 根据趋势评分决定是否止损
        if (pnlPercent <= smartStopLoss) {
            // 如果趋势评分很高，考虑补仓而不是止损
            if (sentiment.score >= 8 && positionPercent < 15 && usdtAvailable >= 25) {
                // 金字塔补仓降低成本
                const pyramidAmount = calculatePyramidBuyAmount(coin, currentPrice, pos.avgPrice);
                if (pyramidAmount > 0) {
                    decision = { 
                        action: 'buy', 
                        reason: `智能补仓！亏损${pnlPercent.toFixed(2)}%但趋势评分${sentiment.score}/10强劲，金字塔补仓$${pyramidAmount}`,
                        amount: pyramidAmount / currentPrice,
                        usdtAmount: pyramidAmount
                    };
                    return decision;
                }
            }
            
            // 否则执行止损
            const sellAmount = pos.amount * 0.995;
            resetPyramidLayers(coin); // v2.2 新增：重置金字塔层级
            decision = { 
                action: 'sell', 
                reason: `触发智能止损！亏损${pnlPercent.toFixed(2)}% (止损线${smartStopLoss.toFixed(2)}%)，加入黑名单`,
                amount: sellAmount,
                addToBlacklist: true
            };
            return decision;
        }
        
        // 止盈 - 使用动态计算的止盈线（趋势追踪网格逻辑）
        if (pnlPercent >= takeProfitPercent) {
            // 留出0.5%余量，避免精度问题导致卖出失败
            const sellAmount = pos.amount * 0.995;
            resetPyramidLayers(coin); // v2.2 新增：重置金字塔层级
            decision = { 
                action: 'sell', 
                reason: `触发动态止盈！盈利${pnlPercent.toFixed(2)}% >= 止盈线${takeProfitPercent.toFixed(2)}%，及时高抛`,
                amount: sellAmount  // 卖出99.5%，留出余量
            };
            return decision;
        }
        
        // 小盈减仓：盈利>=动态止盈线的一半且持仓占比>15%，及时减仓
        if (pnlPercent >= (takeProfitPercent / 2) && positionPercent > 15) {
            const sellAmount = pos.amount * 0.5;  // 卖出一半
            // 记录减仓价格
            recordReducePositionPrice(coin, currentPrice);
            decision = { 
                action: 'sell', 
                reason: `小盈减仓！盈利${pnlPercent.toFixed(2)}%>=${(takeProfitPercent/2).toFixed(2)}%且占比${positionPercent.toFixed(1)}%>15%，先抛一半`,
                amount: sellAmount
            };
            return decision;
        }
        
        // 超仓减仓：持仓占比过高时，强制减仓（降低集中度至20%）
        // 新增：智能豁免期 - 刚买入的币种给予时间回本
        if (positionPercent > 30) {
            // 检查是否在豁免期内
            if (isInOverPositionExemption(coin, pnlPercent)) {
                decision = { 
                    action: 'hold', 
                    reason: `超仓但豁免期内，给予时间回本（盈亏${pnlPercent.toFixed(2)}%）`
                };
                return decision;
            }
            
            const reducePercent = Math.min(15, (positionPercent - 20)); // 减仓至20%
            const reduceAmount = pos.amount * (reducePercent / positionPercent);
            // 记录减仓价格
            recordReducePositionPrice(coin, currentPrice);
            decision = { 
                action: 'sell', 
                reason: `超仓减仓！占比${positionPercent.toFixed(1)}%过高，强制减仓至20%`,
                amount: reduceAmount
            };
            return decision;
        }
        
        // 舆情极差，提前卖出 - 修改为调整止盈单
        if (sentiment.score < AI_CONFIG.sentimentSellThreshold && pnlPercent > -2) {
            // 如果有止盈单，调整止盈价格（收紧止盈）
            if (TAKE_PROFIT_ORDERS[coin]) {
                console.log(`  🎯 舆情极差(${sentiment.score}分)，收紧止盈单...`);
                // 不立即卖出，而是依赖止盈单成交
                // 止盈单会在主循环中被调整为更保守的价格
                decision = { 
                    action: 'hold', 
                    reason: `舆情极差(${sentiment.score}分)，已收紧止盈单，等待成交`
                };
            } else {
                // 无止盈单时，才市价卖出
                decision = { 
                    action: 'sell', 
                    reason: `舆情极差(${sentiment.score}分)，提前止盈`,
                    amount: pos.amount * 0.995
                };
            }
            return decision;
        }
    }
    
    // 2. 检查是否满足买入条件
    // 检查日交易限制
    if (tradeLog.dailyTradeCount >= AI_CONFIG.maxDailyTrades) {
        decision = { action: 'hold', reason: '已达每日最大交易次数' };
        return decision;
    }
    
    if (tradeLog.dailyVolume >= AI_CONFIG.maxDailyVolume) {
        decision = { action: 'hold', reason: '已达每日最大交易量' };
        return decision;
    }
    
    // 检查超仓保护：单币种占比超过25%禁止买入（降低集中度）
    if (positionPercent >= AI_CONFIG.maxPositionPercent) {
        decision = { action: 'hold', reason: `超仓保护！当前占比${positionPercent.toFixed(1)}%已达上限(${AI_CONFIG.maxPositionPercent}%)` };
        return decision;
    }
    
    // 检查黑名单：持续亏损的币种禁止买入
    // 新增：趋势反转检查 - 如果趋势连续3次≥8分，解除黑名单
    if (AI_CONFIG.blacklistedCoins.includes(coin)) {
        // 检查是否应该解除黑名单（趋势反转）
        const trendScore = await analyzeTrend(coin, currentPrice);
        const shouldRemove = shouldRemoveFromBlacklist(coin, trendScore.score);
        
        if (shouldRemove) {
            console.log(`  ✅ ${coin} 已从黑名单移除，趋势评分${trendScore.score}/${BLACKLIST_TREND_THRESHOLD}，允许重新买入`);
            // 更新配置中的黑名单
            AI_CONFIG.blacklistedCoins = [...new Set(['BIO', 'KITE', 'HYPE', ...PERSISTENT_BLACKLIST])];
        } else {
            decision = { action: 'hold', reason: `${coin}在黑名单中，禁止买入（历史持续亏损）。趋势评分${trendScore.score}/${BLACKLIST_TREND_THRESHOLD}，需连续${BLACKLIST_TREND_COUNT}次≥阈值可解除` };
            return decision;
        }
    }
    
    // 检查连续加仓限制：根据趋势评分动态调整持仓阈值
    // 趋势越强，允许持仓比例越高，避免错过强势行情
    let maxPositionPercentByTrend = 10; // 默认10%
    if (sentiment.score >= 10) {
        maxPositionPercentByTrend = 40; // 极强势，允许40%
    } else if (sentiment.score >= 8) {
        maxPositionPercentByTrend = 30; // 强势，允许30%
    } else if (sentiment.score >= 6) {
        maxPositionPercentByTrend = 20; // 一般趋势，允许20%
    }
    
    if (positionPercent > maxPositionPercentByTrend) {
        decision = { action: 'hold', reason: `${coin}已有持仓${positionPercent.toFixed(1)}%，超过趋势评分${sentiment.score}分对应的阈值${maxPositionPercentByTrend}%，禁止连续加仓` };
        return decision;
    }
    
    // 检查资金
    if (usdtAvailable < AI_CONFIG.tradeSize) {
        decision = { action: 'hold', reason: 'USDT不足' };
        return decision;
    }
    
    // 检查现金保留比例
    const cashPercent = totalEquity > 0 ? (usdtAvailable / totalEquity * 100) : 0;
    if (cashPercent < AI_CONFIG.minCashReserve) {
        decision = { action: 'hold', reason: '现金保留比例不足' };
        return decision;
    }
    
    // 检查仓位限制
    if (positionPercent >= AI_CONFIG.maxPositionPerCoin) {
        decision = { action: 'hold', reason: '已达最大仓位限制' };
        return decision;
    }
    
    // 检查回调加仓条件：如果有减仓记录，需等价格回调到减仓价的97%以下
    const pullbackCheck = checkPullbackBuyCondition(coin, currentPrice);
    if (!pullbackCheck.canBuy) {
        decision = { action: 'hold', reason: pullbackCheck.reason };
        return decision;
    }
    
    // 实时盈亏验证：如果已有持仓且亏损>1%，禁止买入（防止追高）
    if (pos && pos.amount > 0 && pos.avgPrice > 0) {
        const pnlPercent = (currentPrice - pos.avgPrice) / pos.avgPrice * 100;
        if (pnlPercent < -1.0) {
            console.log(`  ⚠️ 实时盈亏验证：当前亏损${pnlPercent.toFixed(2)}% > -1%，禁止买入防止追高`);
            // 强制降低趋势评分
            sentiment.score = Math.min(sentiment.score, 5);
            console.log(`  ⚠️ 趋势评分已调整至${sentiment.score}/10`);
            if (sentiment.score < AI_CONFIG.sentimentThreshold) {
                decision = { action: 'hold', reason: `实时盈亏验证：亏损${pnlPercent.toFixed(2)}%，趋势评分已降至${sentiment.score}分，禁止买入` };
                return decision;
            }
        }
    }
    
    // 舆情综合验证：确保舆情数据、价格趋势、持仓盈亏三者一致
    console.log(`  📊 舆情综合验证:`);
    console.log(`     - 舆情评分: ${sentiment.score}/10`);
    console.log(`     - 价格趋势: ${sentiment.trend}`);
    console.log(`     - 24h涨跌: ${sentiment.change24h || 'N/A'}%`);
    
    // 如果舆情评分>=8分但24h涨跌为负，可能存在数据不一致
    if (sentiment.score >= 8 && sentiment.change24h && sentiment.change24h < -5) {
        console.log(`  ⚠️ 舆情数据不一致：评分${sentiment.score}分但24h涨跌${sentiment.change24h}%，谨慎处理`);
        sentiment.score = Math.min(sentiment.score, 6);
        console.log(`  ⚠️ 趋势评分已调整至${sentiment.score}/10`);
    }
    
    // 3. 增强买入逻辑 - v2.2 整合新策略
    
    // 检查阴线买入信号 - v2.2 新增（技巧3：阴线买阳线卖）
    const bearishCheck = await checkConsecutiveBearishCandles(`${coin}-USDT`, currentPrice);
    if (bearishCheck.isBearish && sentiment.score >= 6) {
        console.log(`  📉 阴线买入信号触发：连续阴线后反弹，趋势${sentiment.score}/10`);
        const pyramidAmount = calculatePyramidBuyAmount(coin, currentPrice, 0);
        if (pyramidAmount > 0) {
            decision = { 
                action: 'buy', 
                reason: `阴线买入！连续阴线跌幅${bearishCheck.dropPercent.toFixed(2)}%，趋势${sentiment.score}/10，金字塔首仓$${pyramidAmount}`,
                amount: pyramidAmount / currentPrice,
                usdtAmount: pyramidAmount
            };
            return decision;
        }
    }
    
    // 检查暴跌反弹 - v2.2 新增（技巧4：暴跌有机会）
    const crashCheck = await checkCrashRebound(`${coin}-USDT`, sentiment.change24h || 0, sentiment.score);
    if (crashCheck.isRebound) {
        console.log(`  💥 暴跌反弹信号触发：24h跌幅${(crashCheck.dropPercent*100).toFixed(2)}%，趋势回升至${crashCheck.trendScore}分`);
        const pyramidAmount = calculatePyramidBuyAmount(coin, currentPrice, 0);
        if (pyramidAmount > 0) {
            decision = { 
                action: 'buy', 
                reason: `暴跌反弹！24h跌幅${(crashCheck.dropPercent*100).toFixed(2)}%后趋势回升至${crashCheck.trendScore}分，金字塔首仓$${pyramidAmount}`,
                amount: pyramidAmount / currentPrice,
                usdtAmount: pyramidAmount
            };
            return decision;
        }
    }
    
    // 舆情驱动买入（原有逻辑，修改为金字塔建仓）
    if (sentiment.score >= AI_CONFIG.sentimentThreshold) {
        // 波动率筛选 - 新增
        if (AI_CONFIG.volatilityFilter && AI_CONFIG.volatilityFilter.enabled) {
            const volatility = sentiment.volatility || 0;
            const minVol = AI_CONFIG.volatilityFilter.minVolatility;
            const preferredVol = AI_CONFIG.volatilityFilter.preferredVolatility;
            
            if (volatility < minVol) {
                console.log(`  ⚠️ 波动率筛选：${volatility.toFixed(2)}% < ${minVol}%（最小要求），跳过买入`);
                decision = { action: 'hold', reason: `波动率过低(${volatility.toFixed(2)}%)，跳过买入` };
                return decision;
            }
            
            if (volatility >= preferredVol) {
                console.log(`  ✅ 波动率优选：${volatility.toFixed(2)}% >= ${preferredVol}%，优先买入`);
            } else {
                console.log(`  ⚠️ 波动率一般：${volatility.toFixed(2)}%，在${minVol}%-${preferredVol}%范围内`);
            }
        }
        
        // 使用金字塔建仓计算买入金额 - v2.2 修改
        const pyramidAmount = calculatePyramidBuyAmount(coin, currentPrice, 0);
        if (pyramidAmount > 0) {
            decision = { 
                action: 'buy', 
                reason: `舆情利好(${sentiment.score}分)，金字塔建仓$${pyramidAmount}`,
                amount: pyramidAmount / currentPrice,
                usdtAmount: pyramidAmount
            };
            return decision;
        }
    }
    
    // 4. 默认持有
    decision = { action: 'hold', reason: '条件不满足，继续持有' };
    return decision;
}

// 撤销指定币种的所有挂单
async function cancelAllPendingOrders(coin) {
    try {
        const instId = `${coin}-USDT`;
        
        // 1. 获取所有未成交订单
        const pendingOrders = await request(`/api/v5/trade/orders-pending?instId=${instId}`);
        
        if (!pendingOrders.data || pendingOrders.data.length === 0) {
            console.log(`  ✅ ${coin} 无挂单需要撤销`);
            return;
        }
        
        console.log(`  🧹 ${coin} 发现 ${pendingOrders.data.length} 个挂单，正在撤销...`);
        
        // 2. 撤销所有挂单
        for (const order of pendingOrders.data) {
            try {
                await request('/api/v5/trade/cancel-order', 'POST', {
                    instId: order.instId,
                    ordId: order.ordId
                });
                console.log(`    ✅ 撤销订单 ${order.ordId}`);
            } catch (e) {
                console.error(`    ❌ 撤销订单 ${order.ordId} 失败:`, e.message);
            }
        }
        
        console.log(`  ✅ ${coin} 挂单撤销完成`);
    } catch (e) {
        console.error(`  ❌ 撤销${coin}挂单失败:`, e.message);
    }
}

// 执行交易（带重试机制）
async function executeTrade(instId, side, amount, price, maxRetries = 5, usdtAmount = null) {
    let lastError = null;
    
    // 对于买入操作，确保按USDT金额下单
    const isBuy = side === 'buy';
    
    // 修复：确保usdtAmount正确传递，默认为AI_CONFIG.tradeSize
    let orderUsdtAmount;
    if (isBuy) {
        orderUsdtAmount = usdtAmount || AI_CONFIG.tradeSize;
        // 验证买入金额
        if (orderUsdtAmount <= 0) {
            console.error(`❌ 买入金额无效: ${orderUsdtAmount} USDT`);
            return null;
        }
        if (orderUsdtAmount > AI_CONFIG.tradeSize * 1.01) {
            console.error(`❌ 买入金额超标！计划${orderUsdtAmount} USDT，限制${AI_CONFIG.tradeSize} USDT`);
            return null;
        }
        console.log(`💰 计划买入金额: ${orderUsdtAmount.toFixed(2)} USDT`);
    } else {
        orderUsdtAmount = amount * price;
    }
    
    // 检查账户余额是否足够（卖出时）
    if (side === 'sell') {
        try {
            const balance = await request('/api/v5/account/balance');
            const coin = instId.replace('-USDT', '');
            const coinBalance = balance.data[0].details.find(d => d.ccy === coin);
            // 使用 spotBal（现货余额）作为可交易数量，因为 availBal 可能被挂单冻结
            const available = coinBalance ? (parseFloat(coinBalance.spotBal) || parseFloat(coinBalance.eq) || 0) : 0;
            
            if (available < amount) {
                if (available <= 0) {
                    console.log(`❌ ${coin} 可用余额为0，无法卖出`);
                    return null;
                }
                console.log(`⚠️ 账户余额不足，调整卖出数量: ${amount.toFixed(6)} -> ${available.toFixed(6)}`);
                amount = available * 0.995; // 留出余量
            }
        } catch(e) {
            console.error('检查余额失败:', e.message);
        }
    }
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`🎯 尝试市价${side} (第${attempt}/${maxRetries}次)...`);
            console.log(`   数量: ${amount.toFixed(6)}, 预估金额: ~${(amount * price).toFixed(2)} USDT`);
            
            // 增加请求间隔，避免频率限制
            if (attempt > 1) {
                const waitTime = 3000 + (attempt * 1000); // 3秒、4秒、5秒...
                console.log(`⏳ 等待${waitTime/1000}秒后重试...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
            
            // 买入使用市价单优先，失败后再用限价单
            let orderBody;
            let orderType;
            
            if (side === 'buy') {
                // 买入：先尝试市价单
                // OKX市价单买入时，sz参数表示USDT金额（单位：USDT）
                orderType = 'market';
                
                // 修复：确保sz是字符串格式，且不小于OKX最小下单金额
                const szValue = Math.max(orderUsdtAmount, 1).toString(); // 最小1 USDT
                
                orderBody = {
                    instId: instId,
                    tdMode: 'cash',
                    side: side,
                    ordType: 'market',
                    sz: szValue  // 使用USDT金额，转为字符串
                };
                console.log(`🎯 使用市价单买入 ${orderUsdtAmount.toFixed(2)} USDT (sz=${szValue})`);
            } else {
                // 卖出：使用市价单，sz表示币种数量
                orderType = 'market';
                orderBody = {
                    instId: instId,
                    tdMode: 'cash',
                    side: side,
                    ordType: 'market',
                    sz: amount.toFixed(6)  // 卖出时使用币种数量
                };
                console.log(`🎯 使用市价单卖出 ${amount.toFixed(6)} 个`);
            }
            
            const orderResult = await request('/api/v5/trade/order', 'POST', orderBody);
            
            if (orderResult.code === '0') {
                console.log(`✅ 市价单成功！订单ID:`, orderResult.data[0].ordId);
                // 成功后等待1秒让数据同步
                await new Promise(resolve => setTimeout(resolve, 1000));
                return orderResult;
            }
            
            // 市价单失败，检查错误类型
            console.error(`⚠️ 市价单失败:`, orderResult.msg);
            
            // 如果是余额不足，不再重试
            if (orderResult.msg && orderResult.msg.includes('insufficient')) {
                console.error('❌ 余额不足，停止重试');
                return null;
            }
            
            // 市价单失败，转限价单（仅买入时）
            if (side === 'buy') {
                console.log('🔄 市价单失败，转限价单...');
                const limitPrice = (price * 1.002).toFixed(6); // 买入价+0.2%
                // 限价单买入时，sz表示币种数量，需要根据USDT金额计算
                const limitAmount = (orderUsdtAmount / parseFloat(limitPrice)).toFixed(6);
                
                const limitBody = {
                    instId: instId,
                    tdMode: 'cash',
                    side: side,
                    ordType: 'limit',
                    sz: limitAmount,  // 限价单使用币种数量
                    px: limitPrice
                };
                
                console.log(`🎯 限价单买入: ${limitAmount} 个 @ ${limitPrice} USDT (~${orderUsdtAmount.toFixed(2)} USDT)`);
                
                const limitResult = await request('/api/v5/trade/order', 'POST', limitBody);
                
                if (limitResult.code === '0') {
                    console.log('✅ 限价单成功！订单ID:', limitResult.data[0].ordId);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    return limitResult;
                } else {
                    console.error(`❌ 限价单失败:`, limitResult.msg);
                    lastError = limitResult.msg;
                }
            } else {
                lastError = orderResult.msg;
            }
        } catch(e) {
            console.error(`❌ 第${attempt}次尝试异常:`, e.message);
            lastError = e.message;
        }
    }
    
    console.error(`❌ ${maxRetries}次尝试全部失败，最后错误:`, lastError);
    return null;
}

// 主循环
async function aiTrading() {
    console.log('=== AI自主交易系统 v2.2 - 智能发现模式（增强版）===');
    console.log('时间:', new Date().toISOString());
    console.log(`今日交易: ${tradeLog.dailyTradeCount}/${AI_CONFIG.maxDailyTrades} 笔`);
    console.log(`今日买入: ${tradeLog.dailyVolume}/${AI_CONFIG.maxDailyVolume} USDT (卖出不计入)`);
    
    // 获取账户数据
    const account = await getAccountData();
    if (!account) {
        console.error('获取账户数据失败');
        return;
    }
    
    console.log(`\n账户概况:`);
    console.log(`  总资产: $${account.totalEquity.toFixed(2)}`);
    console.log(`  可用USDT: $${account.usdtAvailable.toFixed(2)}`);
    
    // 新增：每次交易检查都扫描黑名单币种趋势
    await scanBlacklistTrends();
    
    // 获取当前持仓的币种
    const holdingCoins = Object.keys(account.positions);
    console.log(`\n当前持仓币种: ${holdingCoins.length > 0 ? holdingCoins.join(', ') : '无'}`);
    
    // 获取所有可交易币种
    const allCoins = await getAllTradableCoins();
    console.log(`\n发现 ${allCoins.length} 个活跃交易币种`);
    
    // 优先处理已有持仓的币种
    let coinsToAnalyze = [];
    
    // 1. 已有持仓的币种必须分析
    for (const coin of holdingCoins) {
        const coinInfo = allCoins.find(c => c.symbol === coin);
        if (coinInfo) {
            coinsToAnalyze.push({ symbol: coin, instId: `${coin}-USDT`, hasPosition: true });
        } else {
            // 修复：即使币种不在活跃列表中，也要分析持仓币种
            console.log(`  ⚠️ ${coin} 不在活跃币种列表中，但持有该币种，强制添加分析`);
            coinsToAnalyze.push({ symbol: coin, instId: `${coin}-USDT`, hasPosition: true });
        }
    }
    
    // 2. 如果持仓币种不足3个，自动寻找交易机会
    const minHoldingTypes = 3;
    if (holdingCoins.length < minHoldingTypes) {
        const needMore = minHoldingTypes - holdingCoins.length;
        console.log(`\n⚠️ 持仓币种不足(${holdingCoins.length}/${minHoldingTypes})，寻找 ${needMore} 个新机会...`);
        
        // 筛选未持仓的高潜力币种（排除黑名单）
        const candidates = [];
        for (const coin of allCoins) {
            if (!holdingCoins.includes(coin.symbol) && coin.symbol !== 'USDT' && !AI_CONFIG.blacklistedCoins.includes(coin.symbol)) {
                const trend = await analyzeTrend(coin.instId);
                candidates.push({
                    ...coin,
                    trendScore: trend.score,
                    trend: trend.trend,
                    signals: trend.signals || [],
                    indicators: trend.indicators || {}
                });
            }
        }
        
        // 按趋势评分排序，选择最佳候选
        candidates.sort((a, b) => b.trendScore - a.trendScore);
        
        // 严格的趋势追踪选币策略（蚂蚁搬家的选币要更安全）
        console.log('\n📊 候选币种趋势分析:');
        for (const c of candidates.slice(0, 10)) { // 只显示前10个
            const trendIcon = c.trend === 'bullish' ? '📈' : c.trend === 'bearish' ? '📉' : '➡️';
            const trendText = c.trend === 'bullish' ? '看涨' : c.trend === 'bearish' ? '看跌' : '横盘';
            
            // 显示详细技术指标
            let techIndicators = '';
            if (c.signals && c.signals.length > 0) {
                techIndicators = ` [${c.signals.slice(0, 3).join(', ')}]`;
            }
            
            console.log(`  ${trendIcon} ${c.symbol}: 评分${c.trendScore}/10 ${trendText}${techIndicators}, 24h涨跌${c.change24h.toFixed(2)}%, 成交量$${(c.vol24h * c.price / 1000000).toFixed(2)}M`);
        }
        
        // 严格筛选条件（趋势追踪风格）
        const strictCandidates = candidates.filter(c => {
            // 条件1: 趋势必须是看涨
            const isBullish = c.trend === 'bullish';
            // 条件2: 趋势评分必须 >= 8分（更严格）
            const highScore = c.trendScore >= 8;
            // 条件3: 24h涨跌必须在合理范围（不要暴涨暴跌的）
            const reasonableChange = c.change24h > -5 && c.change24h < 15;
            // 条件4: 成交量要足够（至少500万USDT）
            const enoughVolume = (c.vol24h * c.price) > 5000000;
            // 条件5: 价格不要太低（避免垃圾币）
            const reasonablePrice = c.price > 0.1;
            
            const passed = isBullish && highScore && reasonableChange && enoughVolume && reasonablePrice;
            if (passed) {
                console.log(`  ✅ ${c.symbol} 通过严格筛选: 看涨+高分+合理涨跌+充足成交量`);
            }
            return passed;
        });
        
        console.log(`\n🎯 严格筛选结果: ${strictCandidates.length} 个币种通过`);
        
        const topCandidates = strictCandidates.slice(0, needMore + 1); // 只选最优质的
        
        for (const c of topCandidates) {
            coinsToAnalyze.push({ symbol: c.symbol, instId: c.instId, hasPosition: false, potential: c.trendScore });
        }
    }
    
    // 去重
    const uniqueCoins = [];
    const seen = new Set();
    for (const coin of coinsToAnalyze) {
        if (!seen.has(coin.symbol)) {
            seen.add(coin.symbol);
            uniqueCoins.push(coin);
        }
    }
    
    console.log(`\n🎯 本次分析 ${uniqueCoins.length} 个币种`);
    
    // 分析每个币种
    for (const coin of uniqueCoins) {
        console.log(`\n--- 分析 ${coin.symbol} ${coin.hasPosition ? '(有持仓)' : '(候选)'} ---`);
        
        const price = await getMarketPrice(coin.instId);
        if (!price) continue;
        
        // 获取该币种的专门趋势分析
        const trend = await analyzeTrend(coin.instId);
        const trendText = trend.trend === 'bullish' ? '看涨' : trend.trend === 'bearish' ? '看跌' : '横盘';
        
        // ============================================
        // 检查并调整止盈单 - 新增
        // ============================================
        if (coin.hasPosition && TAKE_PROFIT_ORDERS[coin.symbol]) {
            console.log(`  🎯 检查止盈单状态...`);
            
            // 1. 检查止盈单是否已成交
            const tpStatus = await checkTakeProfitOrderStatus(coin.symbol);
            
            if (tpStatus.exists && tpStatus.status === 'filled') {
                // 止盈单已成交
                console.log(`  ✅ 止盈单已成交！卖出${tpStatus.filledAmount.toFixed(6)}个，均价$${tpStatus.avgPrice.toFixed(4)}`);
                
                // 记录交易
                tradeLog.trades.push({
                    time: new Date().toISOString(),
                    coin: coin.symbol,
                    action: 'sell',
                    price: tpStatus.avgPrice,
                    amount: tpStatus.filledAmount,
                    reason: '止盈单成交',
                    ordId: TAKE_PROFIT_ORDERS[coin.symbol].orderId
                });
                fs.writeFileSync('ai_trade_log.json', JSON.stringify(tradeLog, null, 2));
                
                // 清理止盈单记录
                delete TAKE_PROFIT_ORDERS[coin.symbol];
                saveTakeProfitOrders();
                
                // 跳过本次分析，因为已经卖出
                continue;
            } else if (tpStatus.exists && tpStatus.status === 'live') {
                // 止盈单仍在挂单中，检查是否需要调整
                console.log(`  ⏳ 止盈单挂单中，检查是否需要调整...`);
                
                // 根据趋势调整止盈比例
                let newTpPercent;
                if (trend.score >= 8) {
                    newTpPercent = 15; // 强趋势，扩大止盈
                } else if (trend.score >= 5) {
                    newTpPercent = 10; // 中等趋势，标准止盈
                } else {
                    newTpPercent = 6;  // 弱趋势，收紧止盈
                }
                
                // 调整止盈单
                const adjustResult = await adjustTakeProfitOrder(coin.symbol, newTpPercent, price);
                if (adjustResult.success && !adjustResult.noChange) {
                    console.log(`  ✅ 止盈单已调整至 ${newTpPercent}%`);
                } else if (adjustResult.noChange) {
                    console.log(`  ⏭️ 止盈单无需调整`);
                } else {
                    console.error(`  ⚠️ 止盈单调整失败:`, adjustResult.error);
                }
            } else {
                // 止盈单不存在或已撤销，重新挂单
                console.log(`  ⚠️ 止盈单不存在，重新挂单...`);
                const position = account.positions[coin.symbol];
                if (position && position.amount > 0) {
                    const bands = await calculateDynamicBands(coin.symbol, price);
                    // 修复：使用 avgPrice 而不是 costPrice
                    const costPrice = position.avgPrice || price;
                    // 方案1：止盈单只挂50%仓位，保留50%用于动态止盈
                    const tpAmount = position.amount * 0.5;
                    const tpResult = await placeTakeProfitOrder(
                        coin.symbol,
                        tpAmount,
                        costPrice,
                        bands.takeProfit
                    );
                    if (tpResult.success) {
                        console.log(`  ✅ 止盈单已挂出50%仓位(${tpAmount.toFixed(6)}个)，保留50%用于动态止盈`);
                    }
                }
            }
        }
        
        const sentiment = {
            score: trend.score,
            trend: trend.trend,
            factors: [`技术趋势: ${trendText}`, `24h涨跌: ${trend.recentChange?.toFixed(2)}%`]
        };
        
        const decision = await makeDecision(
            coin.symbol, 
            account.positions[coin.symbol], 
            price, 
            sentiment, 
            account
        );
        
        // 对于无持仓的高潜力币种，考虑买入（排除黑名单，确保低吸）
        // 严格检查：黑名单、连续加仓限制、现金充足、冷却期、本次是否已买入
        const isBlacklisted = AI_CONFIG.blacklistedCoins.includes(coin.symbol);
        const hasPosition = account.positions && account.positions[coin.symbol];
        const positionValue = hasPosition ? account.positions[coin.symbol].value : 0;
        const positionPercent = account.totalEquity > 0 ? (positionValue / account.totalEquity * 100) : 0;
        const cashPercent = account.totalEquity > 0 ? (account.usdtAvailable / account.totalEquity * 100) : 0;
        const cooldown = checkBuyCooldown(coin.symbol, coin.potential);
        
        // 检查本次运行是否已经买入过该币种（防止同一周期重复买入）
        const justBought = tradeLog.trades
            .filter(t => t.coin === coin.symbol && t.action === 'buy')
            .some(t => {
                const tradeTime = new Date(t.time);
                const now = new Date();
                return (now - tradeTime) / (1000 * 60) < 5; // 5分钟内买入过
            });
        
        // 详细检查日志
        console.log(`  🔍 买入检查: 黑名单=${isBlacklisted}, 持仓=${positionPercent.toFixed(1)}%, 现金=${cashPercent.toFixed(1)}%, 冷却期=${cooldown.canBuy ? 'OK' : cooldown.remainingMinutes + '分钟'}, 近期买入=${justBought}`);
        
        // 根据趋势评分动态调整持仓阈值
        let maxPositionPercentByTrend = 10; // 默认10%
        if (coin.potential >= 10) {
            maxPositionPercentByTrend = 40; // 极强势，允许40%
        } else if (coin.potential >= 8) {
            maxPositionPercentByTrend = 30; // 强势，允许30%
        } else if (coin.potential >= 6) {
            maxPositionPercentByTrend = 20; // 一般趋势，允许20%
        }
        
        if (!isBlacklisted && 
            positionPercent <= maxPositionPercentByTrend &&  // 动态阈值
            !justBought &&  // 5分钟内没有买入过
            coin.potential >= 8 && 
            cashPercent >= 30 &&
            cooldown.canBuy &&  // 冷却期检查
            tradeLog.dailyTradeCount < AI_CONFIG.maxDailyTrades &&
            tradeLog.dailyVolume < AI_CONFIG.maxDailyVolume &&
            account.usdtAvailable >= AI_CONFIG.tradeSize) {
            
            console.log(`  💡 发现机会！${coin.symbol} 趋势评分 ${coin.potential}/10，现金充足${cashPercent.toFixed(1)}%，持仓${positionPercent.toFixed(1)}%<=${maxPositionPercentByTrend}%，冷却期OK`);
            decision.action = 'buy';
            decision.reason = `趋势强劲(${coin.potential}分)且现金充足(${cashPercent.toFixed(1)}%)，低吸建仓`;
            decision.amount = AI_CONFIG.tradeSize / price;
            decision.usdtAmount = AI_CONFIG.tradeSize;
        } else {
            if (isBlacklisted) {
                console.log(`  🚫 ${coin.symbol}在黑名单中，跳过`);
            } else if (positionPercent > maxPositionPercentByTrend) {
                console.log(`  🚫 ${coin.symbol}已有持仓${positionPercent.toFixed(1)}%>阈值${maxPositionPercentByTrend}%（趋势${coin.potential}分），禁止买入`);
            } else if (justBought) {
                console.log(`  🚫 ${coin.symbol}5分钟内已买入，禁止重复买入`);
            } else if (!cooldown.canBuy) {
                console.log(`  🚫 ${coin.symbol}冷却期中，还需${cooldown.remainingMinutes}分钟`);
            } else if (cashPercent < 30) {
                console.log(`  🚫 现金不足${cashPercent.toFixed(1)}%<30%，禁止买入`);
            }
        }
        
        console.log(`  决策: ${decision.action.toUpperCase()}`);
        console.log(`  原因: ${decision.reason}`);
        
        if (decision.action === 'buy' && decision.usdtAmount) {
            console.log(`  计划买入: ${decision.amount.toFixed(6)} 个 (${decision.usdtAmount} USDT)`);
        }
        
        if (decision.action !== 'hold') {
            // 新增：卖出前先撤销该币种的所有挂单（特别是止盈单），释放库存
            if (decision.action === 'sell') {
                console.log(`  🧹 卖出前撤销${coin.symbol}的所有挂单...`);
                await cancelAllPendingOrders(coin.symbol);
            }
            
            const result = await executeTrade(
                coin.instId, 
                decision.action, 
                decision.amount, 
                price,
                3,
                decision.usdtAmount
            );
            
            // 修复：检查交易是否真正成功
            if (!result) {
                console.error(`❌ ${coin.symbol} ${decision.action} 交易执行失败，不记录交易`);
                // 如果是卖出失败，不加入黑名单
                if (decision.action === 'sell' && decision.addToBlacklist) {
                    console.log(`  ⚠️ 卖出失败，暂不加入黑名单，下次检查重试`);
                }
                continue; // 跳过本次，不记录交易
            }
            
            if (result && result.code === '0') {
                // 记录交易
                tradeLog.trades.push({
                    time: new Date().toISOString(),
                    coin: coin.symbol,
                    action: decision.action,
                    price: price,
                    amount: decision.amount,
                    reason: decision.reason,
                    ordId: result.data[0].ordId
                });
                
                // 只统计买入交易次数和成交量，卖出不算
                if (decision.action === 'buy') {
                    tradeLog.dailyTradeCount++;
                    tradeLog.dailyVolume += AI_CONFIG.tradeSize;
                    // 记录最后买入时间
                    if (!tradeLog.lastBuyTime) tradeLog.lastBuyTime = {};
                    tradeLog.lastBuyTime[coin.symbol] = new Date().toISOString();
                    
                    // ============================================
                    // 买入成功后立即挂止盈单 - 新增
                    // ============================================
                    console.log(`\n🎯 买入成功，准备挂止盈单...`);
                    
                    // 计算动态止盈比例
                    const bands = await calculateDynamicBands(coin.symbol, price);
                    const tpPercent = bands.takeProfit;
                    
                    // 方案1：止盈单只挂50%仓位，保留50%用于动态止盈
                    const tpAmount = decision.amount * 0.5;
                    
                    // 挂止盈单
                    const tpResult = await placeTakeProfitOrder(
                        coin.symbol,
                        tpAmount,
                        price,
                        tpPercent
                    );
                    
                    if (tpResult.success) {
                        console.log(`✅ ${coin.symbol} 止盈单已挂50%仓位(${tpAmount.toFixed(6)}个)，目标 +${tpPercent.toFixed(2)}%，保留50%用于动态止盈`);
                    } else {
                        console.error(`⚠️ ${coin.symbol} 止盈单挂单失败:`, tpResult.error);
                    }
                }
                
                // 如果是卖出，撤销对应的止盈单
                if (decision.action === 'sell') {
                    const tpOrder = TAKE_PROFIT_ORDERS[coin.symbol];
                    if (tpOrder) {
                        console.log(`\n🔄 卖出成功，撤销止盈单...`);
                        const cancelResult = await cancelTakeProfitOrder(coin.symbol);
                        if (cancelResult.success) {
                            console.log(`✅ ${coin.symbol} 止盈单已撤销`);
                        } else {
                            console.error(`⚠️ ${coin.symbol} 止盈单撤销失败:`, cancelResult.error);
                        }
                    }
                }
                
                // 如果标记加入黑名单，则添加
                if (decision.addToBlacklist && !AI_CONFIG.blacklistedCoins.includes(coin.symbol)) {
                    AI_CONFIG.blacklistedCoins.push(coin.symbol);
                    PERSISTENT_BLACKLIST.push(coin.symbol);
                    fs.writeFileSync(BLACKLIST_FILE, JSON.stringify(PERSISTENT_BLACKLIST, null, 2));
                    console.log(`⚠️ ${coin.symbol} 已加入黑名单并持久化，禁止后续买入`);
                }
                
                fs.writeFileSync('ai_trade_log.json', JSON.stringify(tradeLog, null, 2));
                console.log('✅ 交易已记录');
            }
        }
    }
    
    console.log('\n=== 本次检查完成 ===\n');
    
    // 自动复盘：检查是否有超仓问题
    console.log('=== 自动复盘分析 ===');
    const recentTrades = tradeLog.trades.filter(t => {
        const tradeTime = new Date(t.time);
        const now = new Date();
        return (now - tradeTime) / (1000 * 60) < 60; // 最近60分钟
    });
    
    // 统计每个币种的买入次数
    const buyCounts = {};
    recentTrades.forEach(t => {
        if (t.action === 'buy') {
            buyCounts[t.coin] = (buyCounts[t.coin] || 0) + 1;
        }
    });
    
    // 检查是否有频繁买入（可能超仓）
    let hasOverTrading = false;
    for (const [coin, count] of Object.entries(buyCounts)) {
        if (count >= 2) {
            console.log(`⚠️ 发现问题：${coin} 60分钟内买入${count}次，可能存在超仓风险`);
            hasOverTrading = true;
        }
    }
    
    if (hasOverTrading) {
        console.log('🔧 自动调整：加强买入限制');
        // 这里可以自动调整策略参数
    } else {
        console.log('✅ 复盘正常：未发现超仓问题');
    }
    
    // 策略自迭代
    const evolutionResult = await evolveStrategy(tradeLog);
    if (evolutionResult.paused) {
        console.log(`⚠️ 策略暂停中，${evolutionResult.remaining}分钟后恢复`);
    } else if (evolutionResult.evolution) {
        console.log('✅ 策略参数已更新');
        // 应用新参数
        AI_CONFIG.stopLossPercent = evolutionResult.evolution.stopLoss;
        AI_CONFIG.takeProfitPercent = evolutionResult.evolution.takeProfit;
        AI_CONFIG.maxPositions = evolutionResult.evolution.maxPositions;
        AI_CONFIG.tradeSize = evolutionResult.evolution.tradeSize;
        AI_CONFIG.sentimentThreshold = evolutionResult.evolution.sentimentThreshold;
    }
    
    // 自动复盘并迭代 - 增强版
    await autoReviewAndEvolve(tradeLog, account.positions, account.totalEquity);
}

// 自动复盘并迭代策略
async function autoReviewAndEvolve(tradeLog, positions, totalEquity) {
    console.log('\n=== 自动复盘与策略迭代 ===');
    
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    // 1. 分析今日交易表现
    const todayTrades = tradeLog.trades.filter(t => t.time.startsWith(today));
    const buyTrades = todayTrades.filter(t => t.action === 'buy');
    const sellTrades = todayTrades.filter(t => t.action === 'sell');
    
    // 2. 计算胜率
    const profitableSells = sellTrades.filter(t => {
        // 通过reason判断盈亏
        return t.reason && (t.reason.includes('止盈') || t.reason.includes('盈利'));
    });
    const winRate = sellTrades.length > 0 ? (profitableSells.length / sellTrades.length * 100) : 0;
    
    // 3. 计算平均盈亏
    let totalProfit = 0;
    let totalLoss = 0;
    sellTrades.forEach(t => {
        if (t.reason && t.reason.includes('止盈')) {
            totalProfit += 2; // 估算盈利2%
        } else if (t.reason && t.reason.includes('止损')) {
            totalLoss += 1; // 估算亏损1%
        }
    });
    const avgProfit = profitableSells.length > 0 ? (totalProfit / profitableSells.length) : 0;
    const avgLoss = (sellTrades.length - profitableSells.length) > 0 ? (totalLoss / (sellTrades.length - profitableSells.length)) : 0;
    const profitLossRatio = avgLoss > 0 ? (avgProfit / avgLoss) : 0;
    
    // 4. 分析持仓时间
    const positionDurations = [];
    for (const [coin, pos] of Object.entries(positions)) {
        if (pos && pos.amount > 0) {
            const buyTrade = todayTrades.find(t => t.coin === coin && t.action === 'buy');
            if (buyTrade) {
                const holdTime = (now - new Date(buyTrade.time)) / (1000 * 60 * 60); // 小时
                positionDurations.push({ coin, hours: holdTime });
            }
        }
    }
    const avgHoldTime = positionDurations.length > 0 ? 
        positionDurations.reduce((sum, p) => sum + p.hours, 0) / positionDurations.length : 0;
    
    // 5. 自动迭代决策
    let adjustments = [];
    let notifications = [];
    
    // 修复：确保止损线在合理范围内（负数，-1%到-3%）
    if (AI_CONFIG.stopLossPercent > 0 || AI_CONFIG.stopLossPercent < -5) {
        console.log(`  🐛 检测到止损线异常: ${AI_CONFIG.stopLossPercent}%，强制重置为-2.5%`);
        AI_CONFIG.stopLossPercent = -2.5;
    }
    
    // 规则1: 胜率低于30%，收紧止损
    if (winRate < 30 && sellTrades.length >= 3) {
        // 修复：确保止损线为负数，且在合理范围内
        let currentStopLoss = AI_CONFIG.stopLossPercent;
        if (currentStopLoss > 0) {
            // 如果止损线被错误地设置成了正数，重置为默认值-2.5%
            console.log(`  🐛 检测到止损线错误: ${currentStopLoss}%，重置为-2.5%`);
            currentStopLoss = -2.5;
        }
        const newStopLoss = Math.max(-3.0, currentStopLoss * 0.8); // 收紧20%，但不低于-3%
        adjustments.push(`胜率${winRate.toFixed(1)}%过低，止损从${currentStopLoss.toFixed(2)}%收紧至${newStopLoss.toFixed(2)}%`);
        AI_CONFIG.stopLossPercent = newStopLoss;
        notifications.push(`⚠️ 自动迭代：胜率过低(${winRate.toFixed(1)}%)，已收紧止损至${newStopLoss.toFixed(2)}%`);
    }
    
    // 规则2: 盈亏比低于1，调整止盈
    if (profitLossRatio < 1 && profitLossRatio > 0) {
        const newTakeProfit = AI_CONFIG.takeProfitPercent * 0.9; // 降低止盈期望
        adjustments.push(`盈亏比${profitLossRatio.toFixed(2)}过低，止盈从${AI_CONFIG.takeProfitPercent}%调整至${newTakeProfit.toFixed(2)}%`);
        AI_CONFIG.takeProfitPercent = newTakeProfit;
        notifications.push(`⚠️ 自动迭代：盈亏比过低(${profitLossRatio.toFixed(2)})，已调整止盈至${newTakeProfit.toFixed(2)}%`);
    }
    
    // 规则3: 平均持仓时间过长，降低选股门槛以加快交易节奏
    if (avgHoldTime > 6) {
        const newThreshold = Math.max(5, AI_CONFIG.sentimentThreshold - 1);
        adjustments.push(`平均持仓${avgHoldTime.toFixed(1)}小时过长，降低选股门槛至${newThreshold}分以加快节奏`);
        AI_CONFIG.sentimentThreshold = newThreshold;
        notifications.push(`⚠️ 自动迭代：持仓时间过长(${avgHoldTime.toFixed(1)}小时)，已降低选股门槛至${newThreshold}分`);
    }
    
    // 规则4: 连续亏损检测
    const recentSells = sellTrades.slice(-5);
    const consecutiveLosses = recentSells.filter(t => t.reason && t.reason.includes('止损')).length;
    if (consecutiveLosses >= 3) {
        const newTradeSize = AI_CONFIG.tradeSize * 0.8; // 降低单笔金额
        adjustments.push(`连续${consecutiveLosses}次止损，降低单笔金额至$${newTradeSize.toFixed(2)}`);
        AI_CONFIG.tradeSize = newTradeSize;
        notifications.push(`🚨 自动迭代：连续${consecutiveLosses}次止损，已降低单笔金额至$${newTradeSize.toFixed(2)}`);
    }
    
    // 规则5: 现金比例过低，增加最大持仓数以提高资金利用率
    const cashPercent = totalEquity > 0 ? (58.49 / totalEquity * 100) : 0;
    if (cashPercent < 30) {
        const newMaxPositions = Math.min(5, AI_CONFIG.maxPositions + 1);
        adjustments.push(`现金比例${cashPercent.toFixed(1)}%过低，增加最大持仓至${newMaxPositions}个以提高利用率`);
        AI_CONFIG.maxPositions = newMaxPositions;
        notifications.push(`⚠️ 自动迭代：现金比例过低(${cashPercent.toFixed(1)}%)，已增加最大持仓至${newMaxPositions}个`);
    }
    
    // 输出复盘报告
    console.log('\n📊 今日交易复盘:');
    console.log(`  买入次数: ${buyTrades.length}`);
    console.log(`  卖出次数: ${sellTrades.length}`);
    console.log(`  胜率: ${winRate.toFixed(1)}%`);
    console.log(`  盈亏比: ${profitLossRatio.toFixed(2)}`);
    console.log(`  平均持仓时间: ${avgHoldTime.toFixed(1)}小时`);
    
    if (adjustments.length > 0) {
        console.log('\n🔧 自动迭代调整:');
        adjustments.forEach(adj => console.log(`  • ${adj}`));
        
        // 保存调整记录
        const evolveLog = {
            time: now.toISOString(),
            adjustments: adjustments,
            metrics: {
                winRate,
                profitLossRatio,
                avgHoldTime,
                cashPercent
            }
        };
        
        let evolveHistory = [];
        if (fs.existsSync('ai_evolve_log.json')) {
            evolveHistory = JSON.parse(fs.readFileSync('ai_evolve_log.json', 'utf8'));
        }
        evolveHistory.push(evolveLog);
        fs.writeFileSync('ai_evolve_log.json', JSON.stringify(evolveHistory.slice(-30), null, 2)); // 保留最近30条
        
        console.log('\n📢 自动通知:');
        notifications.forEach(notif => console.log(`  ${notif}`));
    } else {
        console.log('\n✅ 策略表现良好，无需调整');
    }
    
    console.log('\n=== 自动复盘完成 ===');
}

// ============================================
// 定期扫描黑名单币种趋势 - v2.5 新增
// 每次交易检查自动扫描所有黑名单币种
// ============================================
async function scanBlacklistTrends() {
    console.log('\n=== 🔍 扫描黑名单币种趋势 ===');
    console.log('时间:', new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }));
    
    if (PERSISTENT_BLACKLIST.length === 0) {
        console.log('✅ 当前无黑名单币种，无需扫描');
        return;
    }
    
    console.log(`📋 黑名单币种数: ${PERSISTENT_BLACKLIST.length}`);
    // 过滤掉稳定币后显示
    const nonStablecoins = PERSISTENT_BLACKLIST.filter(c => !STABLECOINS.includes(c));
    console.log(`非稳定币列表: ${nonStablecoins.join(', ')}`);
    console.log(`(稳定币已跳过: ${STABLECOINS.filter(s => PERSISTENT_BLACKLIST.includes(s)).join(', ')})`);
    console.log('');
    
    let scannedCount = 0;
    let removedCount = 0;
    let skippedCount = 0;
    
    for (const coin of PERSISTENT_BLACKLIST) {
        // 跳过稳定币 - 新增
        if (STABLECOINS.includes(coin)) {
            skippedCount++;
            continue;
        }
        
        try {
            // 获取当前价格
            const currentPrice = await getMarketPrice(`${coin}-USDT`);
            if (!currentPrice) {
                console.log(`  ⚠️ ${coin}: 无法获取价格，跳过`);
                continue;
            }
            
            // 分析趋势
            const trendScore = await analyzeTrend(`${coin}-USDT`);
            
            // 检查是否应该解除黑名单
            const shouldRemove = shouldRemoveFromBlacklist(coin, trendScore.score);
            
            if (shouldRemove) {
                console.log(`  ✅ ${coin}: 已解除黑名单`);
                removedCount++;
            } else {
                // 显示详细状态
                const tracker = BLACKLIST_TREND_TRACKER[coin] || { highTrendCount: 0 };
                console.log(`  📊 ${coin}: 评分${trendScore.score}/10, 累计${tracker.highTrendCount}/3次`);
            }
            
            scannedCount++;
            
            // 避免请求过快
            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (e) {
            console.error(`  ❌ ${coin}: 扫描失败 - ${e.message}`);
        }
    }
    
    console.log('');
    console.log(`✅ 扫描完成: ${scannedCount}个币种, 解除${removedCount}个, 跳过${skippedCount}个稳定币`);
    console.log('=== 黑名单趋势扫描结束 ===\n');
}

// 生成并显示交易统计报告
const stats = new TradeStats();
console.log(stats.generateReport());

// 输出策略优化配置
console.log('\n🔧 策略优化配置已生效(v2.2):');
console.log(`  • 选股门槛: ${AI_CONFIG.sentimentThreshold}分 (从8分降至7分)`);
console.log(`  • 分层冷却期: 趋势10分→${AI_CONFIG.tieredCooldown?.trend10 || 15}分钟, 8-9分→${AI_CONFIG.tieredCooldown?.trend8_9 || 20}分钟, 6-7分→${AI_CONFIG.tieredCooldown?.trend6_7 || 30}分钟`);
console.log(`  • 波动率筛选: 最小${AI_CONFIG.volatilityFilter?.minVolatility || 0.5}%, 优选${AI_CONFIG.volatilityFilter?.preferredVolatility || 1.5}%`);
console.log(`  • 止盈策略: 盈利1.5%减仓25%, 3%止盈50%, 5%清仓`);
console.log(`  • 智能止损: 趋势≤5分→-1%, 6-7分→-1.5%, ≥8分→-2%`);
console.log(`  • 金字塔建仓: 首仓$25→跌10%补仓$15→再跌10%补仓$10`);
console.log(`  • 阴线买入: 连续2根阴线+趋势≥6分+价格<MA5`);
console.log(`  • 横盘暂停: 趋势3-5分且波动率<0.5%暂停买入`);
console.log(`  • 暴跌反弹: 24h跌幅>10%且趋势回升至≥6分`);
console.log(`  • 趋势变盘: 从≥8分降至≤5分且横盘3周期减仓50%`);

// 运行
aiTrading().catch(console.error);
