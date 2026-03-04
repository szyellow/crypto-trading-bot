// ============================================
// 趋势跟踪交易策略 v1.1
// 核心：顺势而为，截断亏损，让利润奔跑
// 更新：加入成交量确认（1.5倍）
// ============================================

const fs = require('fs');
const { request } = require('./okx-api.js');

// 策略配置
const STRATEGY_CONFIG = {
    // 交易参数
    tradeSize: 10,              // 单笔交易金额
    maxPositions: 2,            // 最大持仓币种数
    maxTotalPosition: 60,       // 最大总仓位百分比
    
    // 入场条件
    entryLookback: 20,          // 突破周期（20个K线）
    minRsi: 50,                 // RSI最小值
    maxRsi: 80,                 // RSI最大值（避免超买）
    volumeMultiplier: 1.5,      // 成交量确认倍数（1.5倍）
    
    // 止损止盈
    stopLossPercent: -2,        // 固定止损 -2%
    takeProfitPercent: 5,       // 初始止盈 5%
    trailingStop: true,         // 启用移动止损
    trailingStopPercent: 3,     // 移动止损回撤3%
    
    // 风险控制
    maxDailyTrades: 5,          // 每日最大交易次数
    maxDailyLoss: 20,           // 每日最大亏损$20
    cooldownMinutes: 30,        // 买入冷却期
    
    // 监控币种（主流币）
    watchList: ['BTC', 'ETH', 'SOL', 'DOGE', 'XRP']
};

// 交易日志
let tradeLog = {
    date: new Date().toISOString().split('T')[0],
    trades: [],
    dailyVolume: 0,
    dailyTradeCount: 0,
    dailyLoss: 0,
    positions: {},
    lastBuyTime: {}
};

// 加载历史日志
if (fs.existsSync('trend_trade_log.json')) {
    tradeLog = JSON.parse(fs.readFileSync('trend_trade_log.json', 'utf8'));
    const today = new Date().toISOString().split('T')[0];
    if (tradeLog.date !== today) {
        tradeLog = { 
            date: today, 
            trades: [], 
            dailyVolume: 0, 
            dailyTradeCount: 0,
            dailyLoss: 0,
            positions: {},
            lastBuyTime: {}
        };
    }
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
            if (parseFloat(d.eqUsd) > 1 && d.ccy !== 'USDT') {
                positions[d.ccy] = {
                    amount: parseFloat(d.spotBal) || parseFloat(d.eq),
                    value: parseFloat(d.eqUsd),
                    avgPrice: parseFloat(d.accAvgPx) || 0
                };
            }
        });
        
        return { totalEquity, usdtAvailable, positions };
    } catch(e) {
        console.error('获取账户数据失败:', e.message);
        return null;
    }
}

// 获取K线数据
async function getCandles(instId, bar = '1H', limit = 30) {
    try {
        const result = await request(`/api/v5/market/candles?instId=${instId}&bar=${bar}&limit=${limit}`);
        if (result.code === '0' && result.data) {
            return result.data.map(c => ({
                timestamp: parseInt(c[0]),
                open: parseFloat(c[1]),
                high: parseFloat(c[2]),
                low: parseFloat(c[3]),
                close: parseFloat(c[4]),
                volume: parseFloat(c[5])
            })).reverse();
        }
        return null;
    } catch(e) {
        console.error(`获取K线失败 ${instId}:`, e.message);
        return null;
    }
}

// 计算技术指标
function calculateIndicators(candles) {
    if (!candles || candles.length < 20) return null;
    
    const closes = candles.map(c => c.close);
    const volumes = candles.map(c => c.volume);
    const current = closes[closes.length - 1];
    const currentVolume = volumes[volumes.length - 1];
    
    // 计算20周期最高价
    const high20 = Math.max(...candles.slice(-20).map(c => c.high));
    
    // 计算20周期平均成交量
    const avgVolume20 = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    
    // 简单RSI计算
    const rsi = calculateRSI(closes, 14);
    
    // 简单MACD
    const macd = calculateMACD(closes);
    
    return {
        current,
        high20,
        rsi,
        macd,
        currentVolume,
        avgVolume20,
        volumeRatio: currentVolume / avgVolume20,
        trend: current > high20 * 0.98 ? 'bullish' : 'bearish'
    };
}

// 计算RSI
function calculateRSI(closes, period = 14) {
    if (closes.length < period + 1) return 50;
    
    let gains = 0;
    let losses = 0;
    
    for (let i = closes.length - period; i < closes.length; i++) {
        const change = closes[i] - closes[i - 1];
        if (change > 0) gains += change;
        else losses -= change;
    }
    
    const avgGain = gains / period;
    const avgLoss = losses / period;
    
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
}

// 简化MACD
function calculateMACD(closes) {
    const ema12 = calculateEMA(closes, 12);
    const ema26 = calculateEMA(closes, 26);
    const macdLine = ema12 - ema26;
    const signalLine = calculateEMA([...closes.slice(-9), macdLine], 9);
    
    return {
        macd: macdLine,
        signal: signalLine,
        histogram: macdLine - signalLine,
        bullish: macdLine > signalLine
    };
}

// 计算EMA
function calculateEMA(closes, period) {
    if (closes.length < period) return closes[closes.length - 1];
    
    const multiplier = 2 / (period + 1);
    let ema = closes.slice(0, period).reduce((a, b) => a + b) / period;
    
    for (let i = period; i < closes.length; i++) {
        ema = (closes[i] - ema) * multiplier + ema;
    }
    
    return ema;
}

// 检查买入信号
async function checkEntrySignal(coin) {
    const instId = `${coin}-USDT`;
    const candles = await getCandles(instId, '1H', 30);
    
    if (!candles) return { signal: false, reason: '无法获取数据' };
    
    const indicators = calculateIndicators(candles);
    if (!indicators) return { signal: false, reason: '数据不足' };
    
    const { current, high20, rsi, macd, currentVolume, avgVolume20, volumeRatio } = indicators;
    
    // 买入条件：
    // 1. 价格突破20周期高点
    // 2. RSI > 50 且 < 80（避免超买）
    // 3. MACD金叉
    // 4. 成交量 > 20周期平均成交量 * 1.5（成交量确认）
    const breakout = current >= high20 * 0.995; // 允许0.5%误差
    const rsiOk = rsi >= STRATEGY_CONFIG.minRsi && rsi <= STRATEGY_CONFIG.maxRsi;
    const macdOk = macd.bullish;
    const volumeOk = volumeRatio >= STRATEGY_CONFIG.volumeMultiplier;
    
    console.log(`  ${coin} 分析: 价格=$${current.toFixed(4)}, 20高=$${high20.toFixed(4)}, RSI=${rsi.toFixed(1)}, MACD=${macdOk ? '金叉' : '死叉'}, 成交量比=${volumeRatio.toFixed(2)}`);
    
    if (breakout && rsiOk && macdOk && volumeOk) {
        return { 
            signal: true, 
            price: current,
            reason: `突破20周期高点($${high20.toFixed(4)}) + RSI=${rsi.toFixed(1)} + MACD金叉 + 成交量放大${volumeRatio.toFixed(1)}倍`,
            indicators
        };
    }
    
    let reasons = [];
    if (!breakout) reasons.push(`未突破20周期高点($${high20.toFixed(4)})`);
    if (!rsiOk) reasons.push(`RSI=${rsi.toFixed(1)}不在${STRATEGY_CONFIG.minRsi}-${STRATEGY_CONFIG.maxRsi}区间`);
    if (!macdOk) reasons.push('MACD未金叉');
    if (!volumeOk) reasons.push(`成交量比=${volumeRatio.toFixed(2)} < ${STRATEGY_CONFIG.volumeMultiplier}倍`);
    
    return { signal: false, reason: reasons.join(', ') };
}

// 检查卖出信号
async function checkExitSignal(coin, position) {
    const instId = `${coin}-USDT`;
    const ticker = await request(`/api/v5/market/ticker?instId=${instId}`);
    
    if (ticker.code !== '0') return { signal: false };
    
    const currentPrice = parseFloat(ticker.data[0].last);
    const avgPrice = position.avgPrice;
    const pnlPercent = (currentPrice - avgPrice) / avgPrice * 100;
    
    console.log(`  ${coin} 持仓分析: 成本=$${avgPrice.toFixed(4)}, 现价=$${currentPrice.toFixed(4)}, 盈亏=${pnlPercent.toFixed(2)}%`);
    
    // 1. 固定止损 -2%
    if (pnlPercent <= STRATEGY_CONFIG.stopLossPercent) {
        return { 
            signal: true, 
            action: 'stop_loss',
            price: currentPrice,
            reason: `触发止损！亏损${pnlPercent.toFixed(2)}% <= ${STRATEGY_CONFIG.stopLossPercent}%`,
            amount: position.amount * 0.995
        };
    }
    
    // 2. 移动止损：盈利后回撤3%卖出
    if (pnlPercent >= 3 && STRATEGY_CONFIG.trailingStop) {
        // 获取最高价
        const candles = await getCandles(instId, '1H', 24);
        if (candles) {
            const highest = Math.max(...candles.map(c => c.high));
            const drawdown = (highest - currentPrice) / highest * 100;
            
            if (drawdown >= STRATEGY_CONFIG.trailingStopPercent) {
                return {
                    signal: true,
                    action: 'trailing_stop',
                    price: currentPrice,
                    reason: `移动止损！从最高点回撤${drawdown.toFixed(2)}% >= ${STRATEGY_CONFIG.trailingStopPercent}%`,
                    amount: position.amount * 0.995
                };
            }
        }
    }
    
    // 3. 固定止盈 5%
    if (pnlPercent >= STRATEGY_CONFIG.takeProfitPercent) {
        return {
            signal: true,
            action: 'take_profit',
            price: currentPrice,
            reason: `触发止盈！盈利${pnlPercent.toFixed(2)}% >= ${STRATEGY_CONFIG.takeProfitPercent}%`,
            amount: position.amount * 0.995
        };
    }
    
    return { signal: false, pnlPercent };
}

// 执行交易
async function executeTrade(instId, side, amount, price) {
    try {
        console.log(`🎯 执行${side}单: ${amount.toFixed(6)} @ $${price.toFixed(4)}`);
        
        const body = {
            instId: instId,
            tdMode: 'cash',
            side: side,
            ordType: 'market',
            sz: amount.toFixed(6)
        };
        
        const result = await request('/api/v5/trade/order', 'POST', body);
        
        if (result.code === '0') {
            console.log('✅ 订单成功:', result.data[0].ordId);
            return result;
        } else {
            console.error('❌ 订单失败:', result.msg);
            return null;
        }
    } catch(e) {
        console.error('执行交易失败:', e.message);
        return null;
    }
}

// 主策略循环
async function trendTrading() {
    console.log('=== 趋势跟踪策略 v1.1（成交量确认版）===');
    console.log('时间:', new Date().toISOString());
    console.log(`今日交易: ${tradeLog.dailyTradeCount}/${STRATEGY_CONFIG.maxDailyTrades}`);
    console.log(`今日亏损: $${tradeLog.dailyLoss.toFixed(2)}/${STRATEGY_CONFIG.maxDailyLoss}`);
    
    // 获取账户数据
    const account = await getAccountData();
    if (!account) {
        console.error('获取账户数据失败');
        return;
    }
    
    console.log(`\n账户概况:`);
    console.log(`  总资产: $${account.totalEquity.toFixed(2)}`);
    console.log(`  可用USDT: $${account.usdtAvailable.toFixed(2)}`);
    
    const holdingCoins = Object.keys(account.positions);
    console.log(`  当前持仓: ${holdingCoins.length > 0 ? holdingCoins.join(', ') : '无'}`);
    
    // 计算总仓位
    let totalPositionValue = 0;
    for (const pos of Object.values(account.positions)) {
        totalPositionValue += pos.value;
    }
    const totalPositionPercent = account.totalEquity > 0 ? (totalPositionValue / account.totalEquity * 100) : 0;
    console.log(`  总仓位: ${totalPositionPercent.toFixed(1)}%`);
    
    // 1. 先检查持仓是否需要卖出
    console.log('\n=== 检查持仓卖出信号 ===');
    for (const coin of holdingCoins) {
        const position = account.positions[coin];
        const exitSignal = await checkExitSignal(coin, position);
        
        if (exitSignal.signal) {
            console.log(`\n🔥 ${coin} 卖出信号: ${exitSignal.reason}`);
            
            const result = await executeTrade(
                `${coin}-USDT`,
                'sell',
                exitSignal.amount,
                exitSignal.price
            );
            
            if (result) {
                tradeLog.trades.push({
                    time: new Date().toISOString(),
                    coin,
                    action: 'sell',
                    price: exitSignal.price,
                    amount: exitSignal.amount,
                    reason: exitSignal.reason
                });
                
                // 更新每日亏损
                if (exitSignal.action === 'stop_loss') {
                    const loss = STRATEGY_CONFIG.tradeSize * 0.02;
                    tradeLog.dailyLoss += loss;
                }
                
                fs.writeFileSync('trend_trade_log.json', JSON.stringify(tradeLog, null, 2));
            }
        } else {
            console.log(`  ${coin}: 持有中，${exitSignal.pnlPercent ? '盈亏 ' + exitSignal.pnlPercent.toFixed(2) + '%' : '等待信号'}`);
        }
    }
    
    // 2. 检查是否需要买入
    console.log('\n=== 检查买入信号 ===');
    
    // 风险控制检查
    if (tradeLog.dailyTradeCount >= STRATEGY_CONFIG.maxDailyTrades) {
        console.log('⚠️ 已达每日最大交易次数');
        return;
    }
    
    if (tradeLog.dailyLoss >= STRATEGY_CONFIG.maxDailyLoss) {
        console.log('⚠️ 已达每日最大亏损限制');
        return;
    }
    
    if (totalPositionPercent >= STRATEGY_CONFIG.maxTotalPosition) {
        console.log(`⚠️ 总仓位${totalPositionPercent.toFixed(1)}% >= ${STRATEGY_CONFIG.maxTotalPosition}%，暂停买入`);
        return;
    }
    
    if (holdingCoins.length >= STRATEGY_CONFIG.maxPositions) {
        console.log(`⚠️ 已达最大持仓数${STRATEGY_CONFIG.maxPositions}`);
        return;
    }
    
    // 检查监控列表中的币种
    for (const coin of STRATEGY_CONFIG.watchList) {
        // 跳过已有持仓的币种
        if (holdingCoins.includes(coin)) {
            console.log(`  ${coin}: 已有持仓，跳过`);
            continue;
        }
        
        // 检查冷却期
        const lastBuy = tradeLog.lastBuyTime[coin];
        if (lastBuy) {
            const minutesSince = (new Date() - new Date(lastBuy)) / (1000 * 60);
            if (minutesSince < STRATEGY_CONFIG.cooldownMinutes) {
                console.log(`  ${coin}: 冷却期中，还需${Math.ceil(STRATEGY_CONFIG.cooldownMinutes - minutesSince)}分钟`);
                continue;
            }
        }
        
        console.log(`\n📊 分析 ${coin}...`);
        const entrySignal = await checkEntrySignal(coin);
        
        if (entrySignal.signal) {
            console.log(`🔥 ${coin} 买入信号: ${entrySignal.reason}`);
            
            const amount = STRATEGY_CONFIG.tradeSize / entrySignal.price;
            
            const result = await executeTrade(
                `${coin}-USDT`,
                'buy',
                amount,
                entrySignal.price
            );
            
            if (result) {
                tradeLog.trades.push({
                    time: new Date().toISOString(),
                    coin,
                    action: 'buy',
                    price: entrySignal.price,
                    amount,
                    reason: entrySignal.reason
                });
                
                tradeLog.dailyTradeCount++;
                tradeLog.dailyVolume += STRATEGY_CONFIG.tradeSize;
                tradeLog.lastBuyTime[coin] = new Date().toISOString();
                
                fs.writeFileSync('trend_trade_log.json', JSON.stringify(tradeLog, null, 2));
                
                // 买入成功后更新持仓数
                holdingCoins.push(coin);
                if (holdingCoins.length >= STRATEGY_CONFIG.maxPositions) {
                    console.log('✅ 已达最大持仓数，停止买入扫描');
                    break;
                }
            }
        } else {
            console.log(`  ${coin}: ${entrySignal.reason}`);
        }
    }
    
    console.log('\n=== 本次检查完成 ===\n');
}

// 运行
trendTrading().catch(console.error);
