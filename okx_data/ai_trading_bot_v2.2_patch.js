// ============================================
// AI自主交易系统 v2.2 - 增强版
// 整合《短线六大必杀法》
// ============================================

const fs = require('fs');
const { request } = require('./okx-api.js');
const { evolveStrategy } = require('./strategy-evolution.js');
const TradeStats = require('./trade-stats.js');

// ============================================
// 导入增强策略模块 - 新增
// ============================================
const {
    calculatePyramidBuyAmount,
    resetPyramidLayers,
    checkConsecutiveBearishCandles,
    isSidewaysMarket,
    checkCrashRebound,
    checkTrendReversal
} = require('./strategy-enhanced.js');

// ... (原有代码保持不变) ...

// ============================================
// 修改AI决策引擎 - 整合新策略
// ============================================
async function makeDecision(coin, position, currentPrice, sentiment, account) {
    const { totalEquity, usdtAvailable, positions } = account;
    
    console.log(`\n🤖 AI分析 ${coin}...`);
    console.log(`  当前价格: $${currentPrice}`);
    const trendText = sentiment.trend === 'bullish' ? '看涨' : sentiment.trend === 'bearish' ? '看跌' : '横盘';
    console.log(`  趋势评分: ${sentiment.score}/10 (${trendText})`);
    
    // 检查横盘状态 - 新增（技巧1、2：盘整必变盘、横盘藏陷阱）
    const sidewaysCheck = await isSidewaysMarket(`${coin}-USDT`, sentiment.score, sentiment.volatility || 0);
    if (sidewaysCheck.isSideways) {
        console.log(`  ➡️ 横盘期暂停：${coin}处于横盘状态(${sidewaysCheck.periods}周期)，暂不操作`);
        return { action: 'hold', reason: `横盘期暂停(${sidewaysCheck.periods}周期)，等待方向明朗` };
    }
    
    // 检查买入冷却期
    const cooldown = checkBuyCooldown(coin, sentiment.score);
    if (!cooldown.canBuy) {
        console.log(`  ⏳ ${coin} 冷却期中，还需${cooldown.remainingMinutes}分钟`);
        return { action: 'hold', reason: `冷却期中，还需${cooldown.remainingMinutes}分钟` };
    }
    
    // 检查持仓
    const pos = positions[coin];
    const positionValue = pos ? pos.value : 0;
    const positionPercent = totalEquity > 0 ? (positionValue / totalEquity * 100) : 0;
    
    console.log(`  当前持仓: ${positionValue.toFixed(2)} USD (${positionPercent.toFixed(1)}%)`);
    console.log(`  可用USDT: ${usdtAvailable.toFixed(2)}`);
    
    // 计算动态波段
    const dynamicBands = await calculateDynamicBands(coin, currentPrice);
    const stopLossPercent = dynamicBands.stopLoss;
    const takeProfitPercent = dynamicBands.takeProfit;
    
    // 决策逻辑
    let decision = { action: 'hold', reason: '' };
    
    // 智能止损
    let smartStopLoss = stopLossPercent;
    if (sentiment.score >= 8) {
        smartStopLoss = -3.0;
        console.log(`  🛡️ 智能止损：趋势评分${sentiment.score}/10，放宽止损至-3%`);
    } else if (sentiment.score >= 6) {
        smartStopLoss = -2.0;
        console.log(`  🛡️ 智能止损：趋势评分${sentiment.score}/10，止损-2%`);
    } else {
        smartStopLoss = -1.5;
        console.log(`  🛡️ 智能止损：趋势评分${sentiment.score}/10，止损-1.5%`);
    }
    
    // 1. 如果有持仓，检查止盈止损、补仓机会和趋势变盘
    if (pos && pos.amount > 0 && pos.avgPrice > 0) {
        const pnlPercent = (currentPrice - pos.avgPrice) / pos.avgPrice * 100;
        const pnlValue = (currentPrice - pos.avgPrice) * pos.amount;
        console.log(`  持仓数量: ${pos.amount.toFixed(6)} 个`);
        console.log(`  持仓成本: $${pos.avgPrice.toFixed(4)}`);
        console.log(`  当前价格: $${currentPrice.toFixed(4)}`);
        console.log(`  持仓盈亏: ${pnlPercent.toFixed(2)}% ($${pnlValue.toFixed(2)})`);
        console.log(`  动态止损: ${smartStopLoss.toFixed(2)}%, 动态止盈: ${takeProfitPercent.toFixed(2)}%`);
        
        // 检查趋势变盘减仓 - 新增（技巧6：变盘快清仓）
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
        
        // 金字塔建仓补仓 - 新增（技巧5：金字塔建仓）
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
        
        // 智能止损
        if (pnlPercent <= smartStopLoss) {
            // 如果趋势评分很高，考虑补仓而不是止损
            if (sentiment.score >= 8 && positionPercent < 15 && usdtAvailable >= 25) {
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
            resetPyramidLayers(coin); // 重置金字塔层级
            decision = { 
                action: 'sell', 
                reason: `触发智能止损！亏损${pnlPercent.toFixed(2)}% (止损线${smartStopLoss.toFixed(2)}%)，加入黑名单`,
                amount: sellAmount,
                addToBlacklist: true
            };
            return decision;
        }
        
        // 止盈
        if (pnlPercent >= takeProfitPercent) {
            const sellAmount = pos.amount * 0.995;
            resetPyramidLayers(coin); // 重置金字塔层级
            decision = { 
                action: 'sell', 
                reason: `触发动态止盈！盈利${pnlPercent.toFixed(2)}% >= 止盈线${takeProfitPercent.toFixed(2)}%，及时高抛`,
                amount: sellAmount
            };
            return decision;
        }
        
        // 小盈减仓
        if (pnlPercent >= (takeProfitPercent / 2) && positionPercent > 15) {
            const sellAmount = pos.amount * 0.5;
            recordReducePositionPrice(coin, currentPrice);
            decision = { 
                action: 'sell', 
                reason: `小盈减仓！盈利${pnlPercent.toFixed(2)}%>=${(takeProfitPercent/2).toFixed(2)}%且占比${positionPercent.toFixed(1)}%>15%，先抛一半`,
                amount: sellAmount
            };
            return decision;
        }
    }
    
    // 2. 检查是否满足买入条件
    // ... (原有检查代码保持不变) ...
    
    // 3. 增强买入逻辑 - 整合新策略
    
    // 检查阴线买入信号 - 新增（技巧3：阴线买阳线卖）
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
    
    // 检查暴跌反弹 - 新增（技巧4：暴跌有机会）
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
    
    // 舆情驱动买入（原有逻辑）
    if (sentiment.score >= AI_CONFIG.sentimentThreshold) {
        // 波动率筛选
        if (AI_CONFIG.volatilityFilter && AI_CONFIG.volatilityFilter.enabled) {
            const volatility = sentiment.volatility || 0;
            const minVol = AI_CONFIG.volatilityFilter.minVolatility;
            
            if (volatility < minVol) {
                console.log(`  ⚠️ 波动率筛选：${volatility.toFixed(2)}% < ${minVol}%，跳过买入`);
                decision = { action: 'hold', reason: `波动率过低(${volatility.toFixed(2)}%)，跳过买入` };
                return decision;
            }
        }
        
        // 使用金字塔建仓计算买入金额
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

// ============================================
// 修改卖出后处理 - 重置金字塔层级
// ============================================
async function executeTrade(decision, coin, currentPrice) {
    // ... (原有代码) ...
    
    if (decision.action === 'sell') {
        // 卖出后重置金字塔层级 - 新增
        resetPyramidLayers(coin);
        // ... (原有代码) ...
    }
    
    // ... (原有代码) ...
}

// ... (其余代码保持不变) ...
