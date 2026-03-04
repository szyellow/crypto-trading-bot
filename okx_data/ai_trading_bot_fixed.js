// ============================================
// AI自主交易系统 v2.2 - 修复下单数量问题
// 修复：市价单买入时sz参数使用正确的USDT金额格式
// ============================================

const fs = require('fs');
const { request } = require('./okx-api.js');
const { evolveStrategy } = require('./strategy-evolution.js');

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
const BLACKLIST_TREND_COUNT = 3; // 连续多少次≥阈值才解除

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
        
        // 如果连续达到阈值次数，解除黑名单
        if (tracker.highTrendCount >= BLACKLIST_TREND_COUNT) {
            console.log(`✅ ${coin} 趋势连续${BLACKLIST_TREND_COUNT}次≥${BLACKLIST_TREND_THRESHOLD}，解除黑名单`);
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
    maxPositionPerCoin: 50,      // 单币种最大仓位50%（提高集中度）
    maxDailyTrades: 20,          // 每日最大交易次数（减少频率）
    maxDailyVolume: 500,         // 每日最大交易量$500（提高上限）
    stopLossPercent: -5,         // 止损线-5%
    takeProfitPercent: 12,       // 止盈线+12%（固定更高目标）
    minOrderInterval: 300000,     // 最小下单间隔5分钟
    sentimentThreshold: 7,       // 舆情买入阈值(>7分买入)
    sentimentSellThreshold: 3,   // 舆情卖出阈值(<3分卖出)
    minCashReserve: 10,          // 最小现金保留10%（提高保留）
    tradeSize: 25,               // 单笔交易金额$25（提高金额）
    blacklistedCoins: [...new Set(['BIO', 'KITE', 'HYPE', ...PERSISTENT_BLACKLIST])],
    maxPositionPercent: 50,      // 单币种最大占比50%（提高集中度）
    buyCooldownMinutes: 60       // 买入冷却期60分钟（减少频率）
};

// 交易日志
let tradeLog = {
    date: new Date().toDateString(),
    trades: [],
    dailyTradeCount: 0,
    dailyVolume: 0,
    lastBuyTime: {}
};

// 加载交易日志
const LOG_FILE = './ai_trade_log.json';
if (fs.existsSync(LOG_FILE)) {
    try {
        const savedLog = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8'));
        if (savedLog.date === tradeLog.date) {
            tradeLog = savedLog;
            console.log(`📊 已加载今日交易记录: ${tradeLog.trades.length}笔交易`);
        } else {
            console.log('🌅 新的一天，重置交易计数');
        }
    } catch (e) {
        console.error('加载交易日志失败:', e.message);
    }
}

// 保存交易日志
function saveTradeLog() {
    fs.writeFileSync(LOG_FILE, JSON.stringify(tradeLog, null, 2));
}

// 保存止盈订单记录
const TP_ORDER_FILE = './ai_tp_orders.json';
let tpOrderRecord = {};
if (fs.existsSync(TP_ORDER_FILE)) {
    try {
        tpOrderRecord = JSON.parse(fs.readFileSync(TP_ORDER_FILE, 'utf8'));
    } catch (e) {
        console.error('加载止盈订单记录失败:', e.message);
    }
}

function saveTPOrderRecord() {
    fs.writeFileSync(TP_ORDER_FILE, JSON.stringify(tpOrderRecord, null, 2));
}

// 保存迭代日志
const EVOLVE_LOG_FILE = './ai_evolve_log.json';
let evolveLog = [];
if (fs.existsSync(EVOLVE_LOG_FILE)) {
    try {
        evolveLog = JSON.parse(fs.readFileSync(EVOLVE_LOG_FILE, 'utf8'));
    } catch (e) {
        console.error('加载迭代日志失败:', e.message);
    }
}

function saveEvolveLog() {
    fs.writeFileSync(EVOLVE_LOG_FILE, JSON.stringify(evolveLog, null, 2));
}

// 计算动态止损止盈
async function calculateDynamicBands(coin, currentPrice) {
    try {
        // 获取24h数据
        const candle24h = await request(`/api/v5/market/candles?instId=${coin}-USDT&bar=1D&limit=2`);
        const open24h = candle24h.data && candle24h.data[1] ? parseFloat(candle24h.data[1][1]) : currentPrice;
        const change24h = ((currentPrice - open24h) / open24h) * 100;
        
        // 获取历史波动率
        const candles = await request(`/api/v5/market/candles?instId=${coin}-USDT&bar=1H&limit=24`);
        let volatility = 0;
        if (candles.data && candles.data.length > 1) {
            const prices = candles.data.map(c => parseFloat(c[4]));
            const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
            const variance = prices.reduce((sum, p) => sum + Math.pow(p - avgPrice, 2), 0) / prices.length;
            volatility = Math.sqrt(variance) / avgPrice * 100;
        }
        
        // 获取市值信息
        const ticker = await request(`/api/v5/market/ticker?instId=${coin}-USDT`);
        const vol24h = ticker.data && ticker.data[0] ? parseFloat(ticker.data[0].vol24h) : 0;
        
        // 市值级别判断
        let marketCapLevel = 'small';
        if (vol24h > 1000000000) marketCapLevel = 'large';
        else if (vol24h > 100000000) marketCapLevel = 'medium';
        
        // 动态计算
        const baseStopLoss = -1.5;
        const baseTakeProfit = 3;
        
        // 根据波动率调整
        const volatilityFactor = Math.min(Math.max(volatility / 2, 0.5), 2);
        
        // 根据市值调整
        const marketCapFactor = marketCapLevel === 'large' ? 0.8 : 
                               marketCapLevel === 'medium' ? 1.0 : 1.2;
        
        // 根据24h涨跌调整
        const changeFactor = change24h > 10 ? 0.8 : 
                            change24h < -5 ? 1.2 : 1.0;
        
        const dynamicStopLoss = baseStopLoss * volatilityFactor * marketCapFactor * changeFactor;
        const dynamicTakeProfit = baseTakeProfit * volatilityFactor * marketCapFactor * changeFactor;
        
        return {
            stopLoss: Math.max(dynamicStopLoss, -3),
            takeProfit: Math.min(dynamicTakeProfit, 5),
            volatility,
            change24h,
            marketCapLevel
        };
    } catch (e) {
        console.error('计算动态波段失败:', e.message);
        return { stopLoss: -2, takeProfit: 4 };
    }
}

// 计算趋势评分
async function calculateTrendScore(coin) {
    try {
        // 获取K线数据
        const candles = await request(`/api/v5/market/candles?instId=${coin}-USDT&bar=1H&limit=50`);
        if (!candles.data || candles.data.length < 20) {
            console.log(`⚠️ ${coin} K线数据不足，跳过分析`);
            return { score: 0, reasons: ['数据不足'] };
        }
        
        const prices = candles.data.map(c => ({
            open: parseFloat(c[1]),
            high: parseFloat(c[2]),
            low: parseFloat(c[3]),
            close: parseFloat(c[4]),
            volume: parseFloat(c[5])
        })).reverse();
        
        const currentPrice = prices[prices.length - 1].close;
        
        // 计算移动平均线
        const ma7 = prices.slice(-7).reduce((sum, p) => sum + p.close, 0) / 7;
        const ma20 = prices.slice(-20).reduce((sum, p) => sum + p.close, 0) / 20;
        const ma50 = prices.length >= 50 ? prices.slice(-50).reduce((sum, p) => sum + p.close, 0) / 50 : ma20;
        
        // 计算RSI
        let gains = 0, losses = 0;
        for (let i = prices.length - 14; i < prices.length; i++) {
            const change = prices[i].close - prices[i-1].close;
            if (change > 0) gains += change;
            else losses -= change;
        }
        const rs = gains / 14 / (losses / 14 || 1);
        const rsi = 100 - (100 / (1 + rs));
        
        // 计算MACD
        const ema12 = prices.slice(-12).reduce((sum, p, i) => sum + p.close * (2/(12+1)), 0);
        const ema26 = prices.slice(-26).reduce((sum, p, i) => sum + p.close * (2/(26+1)), 0);
        const macd = ema12 - ema26;
        
        // 计算布林带
        const std20 = Math.sqrt(prices.slice(-20).reduce((sum, p) => sum + Math.pow(p.close - ma20, 2), 0) / 20);
        const upperBand = ma20 + 2 * std20;
        const lowerBand = ma20 - 2 * std20;
        
        // 综合评分
        let score = 5; // 基础分
        const reasons = [];
        
        // 均线判断
        if (currentPrice > ma7 && ma7 > ma20) {
            score += 1.5;
            reasons.push('均线多头排列');
        } else if (currentPrice < ma7 && ma7 < ma20) {
            score -= 1.5;
            reasons.push('均线空头排列');
        }
        
        // RSI判断
        if (rsi > 70) {
            score -= 1;
            reasons.push('RSI超买');
        } else if (rsi < 30) {
            score += 1;
            reasons.push('RSI超卖');
        } else if (rsi > 50 && rsi < 70) {
            score += 0.5;
            reasons.push('RSI强势区');
        }
        
        // MACD判断
        if (macd > 0) {
            score += 1;
            reasons.push('MACD金叉');
        } else {
            score -= 1;
            reasons.push('MACD死叉');
        }
        
        // 布林带判断
        if (currentPrice > ma20) {
            score += 0.5;
            reasons.push('价格中轨偏上');
        } else {
            score -= 0.5;
            reasons.push('价格中轨偏下');
        }
        
        // 成交量判断
        const recentVolume = prices.slice(-5).reduce((sum, p) => sum + p.volume, 0) / 5;
        const avgVolume = prices.reduce((sum, p) => sum + p.volume, 0) / prices.length;
        if (recentVolume > avgVolume * 1.2) {
            score += 0.5;
            reasons.push('成交量放大');
        }
        
        return {
            score: Math.max(1, Math.min(10, Math.round(score))),
            reasons: reasons.slice(0, 3),
            indicators: { rsi, macd, ma7, ma20, currentPrice }
        };
    } catch (e) {
        console.error(`计算${coin}趋势评分失败:`, e.message);
        return { score: 0, reasons: ['计算错误'] };
    }
}

// 挂止盈单
async function placeTakeProfitOrder(coin, amount, costPrice, takeProfitPercent) {
    try {
        const tpPrice = (costPrice * (1 + takeProfitPercent / 100)).toFixed(6);
        console.log(`   成本价: $${costPrice.toFixed(4)}`);
        console.log(`   止盈价: $${tpPrice} (+${takeProfitPercent}%)`);
        console.log(`   数量: ${amount.toFixed(6)}`);
        
        const orderBody = {
            instId: `${coin}-USDT`,
            tdMode: 'cash',
            side: 'sell',
            ordType: 'limit',
            sz: amount.toFixed(6),
            px: tpPrice
        };
        
        const result = await request('/api/v5/trade/order', 'POST', orderBody);
        
        if (result.code === '0') {
            console.log(`✅ 止盈单挂单成功！订单ID:`, result.data[0].ordId);
            // 记录止盈单
            tpOrderRecord[coin] = {
                ordId: result.data[0].ordId,
                amount: amount,
                costPrice: costPrice,
                tpPrice: parseFloat(tpPrice),
                tpPercent: takeProfitPercent,
                time: new Date().toISOString()
            };
            saveTPOrderRecord();
            return { success: true, ordId: result.data[0].ordId };
        } else {
            console.error(`⚠️ ${coin} 止盈单挂单失败:`, result.msg);
            return { success: false, error: result.msg };
        }
    } catch (e) {
        console.error(`挂${coin}止盈单失败:`, e.message);
        return { success: false, error: e.message };
    }
}

// 调整止盈单
async function adjustTakeProfitOrder(coin, newTpPercent) {
    const tpOrder = tpOrderRecord[coin];
    if (!tpOrder) return false;
    
    try {
        // 查询原订单状态
        const orderInfo = await request(`/api/v5/trade/order?instId=${coin}-USDT&ordId=${tpOrder.ordId}`);
        
        if (orderInfo.code === '0' && orderInfo.data[0]) {
            const status = orderInfo.data[0].state;
            
            // 如果已经成交，从记录中移除
            if (status === 'filled') {
                console.log(`✅ ${coin} 止盈单已成交！`);
                delete tpOrderRecord[coin];
                saveTPOrderRecord();
                return true;
            }
            
            // 如果还在挂单中，撤销并重新挂
            if (status === 'live') {
                console.log(`🔄 调整止盈单: ${coin}`);
                console.log(`   原止盈价: $${tpOrder.tpPrice.toFixed(4)} (${tpOrder.tpPercent}%)`);
                
                // 撤销原订单
                const cancelResult = await request('/api/v5/trade/cancel-order', 'POST', {
                    instId: `${coin}-USDT`,
                    ordId: tpOrder.ordId
                });
                
                if (cancelResult.code === '0') {
                    console.log(`✅ 止盈单撤销成功`);
                    delete tpOrderRecord[coin];
                    saveTPOrderRecord();
                    
                    // 重新挂新的止盈单
                    return await placeTakeProfitOrder(coin, tpOrder.amount, tpOrder.costPrice, newTpPercent);
                }
            }
        }
        return false;
    } catch (e) {
        console.error(`调整${coin}止盈单失败:`, e.message);
        return false;
    }
}

// 检查止盈单状态
async function checkTakeProfitStatus(coin) {
    const tpOrder = tpOrderRecord[coin];
    if (!tpOrder) return null;
    
    try {
        const orderInfo = await request(`/api/v5/trade/order?instId=${coin}-USDT&ordId=${tpOrder.ordId}`);
        
        if (orderInfo.code === '0' && orderInfo.data[0]) {
            const order = orderInfo.data[0];
            return {
                state: order.state,
                filledAmount: parseFloat(order.accFillSz || 0),
                avgPrice: parseFloat(order.avgPx || 0)
            };
        }
        return null;
    } catch (e) {
        console.error(`检查${coin}止盈单状态失败:`, e.message);
        return null;
    }
}

// ============================================
// 修复版：执行交易 - 修复下单数量问题
// ============================================
async function executeTrade(instId, side, amount, price, maxRetries = 5, usdtAmount = null) {
    let lastError = null;
    
    // 对于买入操作，确保按USDT金额下单
    const isBuy = side === 'buy';
    
    // 修复：确保usdtAmount正确传递，默认为AI_CONFIG.tradeSize
    const orderUsdtAmount = isBuy ? (usdtAmount || AI_CONFIG.tradeSize) : (amount * price);
    
    // 验证买入金额
    if (isBuy) {
        if (orderUsdtAmount <= 0) {
            console.error(`❌ 买入金额无效: ${orderUsdtAmount} USDT`);
            return null;
        }
        if (orderUsdtAmount > AI_CONFIG.tradeSize * 1.01) {
            console.error(`❌ 买入金额超标！计划${orderUsdtAmount} USDT，限制${AI_CONFIG.tradeSize} USDT`);
            return null;
        }
        console.log(`💰 计划买入金额: ${orderUsdtAmount.toFixed(2)} USDT`);
    }
    
    // 检查账户余额是否足够（卖出时）
    if (side === 'sell') {
        try {
            const balance = await request('/api/v5/account/balance');
            const coin = instId.replace('-USDT', '');
            const coinBalance = balance.data[0].details.find(d => d.ccy === coin);
            const available = coinBalance ? parseFloat(coinBalance.availBal) : 0;
            
            if (available < amount) {
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
            
            if (isBuy) {
                console.log(`   买入金额: ${orderUsdtAmount.toFixed(2)} USDT`);
            } else {
                console.log(`   卖出数量: ${amount.toFixed(6)} 个, 预估金额: ~${(amount * price).toFixed(2)} USDT`);
            }
            
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
            
        } catch (e) {
            console.error(`❌ 交易执行错误 (尝试 ${attempt}/${maxRetries}):`, e.message);
            lastError = e.message;
            
            // 网络错误时继续重试
            if (e.message.includes('network') || e.message.includes('timeout')) {
                continue;
            }
        }
    }
    
    console.error(`❌ 交易失败，已重试${maxRetries}次:`, lastError);
    return null;
}

// 导出模块
module.exports = { aiTrading, executeTrade };

// 如果直接运行，执行主循环
if (require.main === module) {
    aiTrading().catch(console.error);
}