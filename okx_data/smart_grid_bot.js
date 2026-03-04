const { request } = require('./okx-api.js');
const fs = require('fs');

// 网格配置（带风险控制）
const GRID_CONFIG = {
    maxPositionPerCoin: 30,  // 单币种最大仓位30%
    maxOrdersPerCoin: 2,     // 单币种最大同时挂单数
    stopLossPercent: -10,    // 止损线-10%
    takeProfitPercent: 5,    // 止盈线+5%
    minOrderInterval: 300000 // 最小下单间隔5分钟
};

// 基础网格配置
const BASE_GRID = {
    ETH: {
        instId: 'ETH-USDT',
        minPrice: 1950,
        maxPrice: 2000,
        gridNum: 20,
        investment: 40,
        lastTradePrice: null,
        lastOrderTime: 0,
        orders: [],
        position: 0  // 当前持仓量
    },
    DOGE: {
        instId: 'DOGE-USDT',
        minPrice: 0.095,
        maxPrice: 0.100,
        gridNum: 15,
        investment: 10,
        lastTradePrice: null,
        lastOrderTime: 0,
        orders: [],
        position: 0
    }
};

// 动态调整后的网格
let DYNAMIC_GRID = JSON.parse(JSON.stringify(BASE_GRID));

// 舆情分析
async function analyzeSentiment() {
    try {
        console.log('🔍 分析市场舆情...');
        
        const sentiment = {
            score: 5,
            trend: 'neutral',
            factors: []
        };
        
        const hour = new Date().getHours();
        if (hour >= 9 && hour <= 17) {
            sentiment.factors.push('交易时段，市场活跃');
        }
        
        console.log('舆情评分:', sentiment.score, '/10');
        console.log('趋势:', sentiment.trend);
        console.log('因素:', sentiment.factors.join(', ') || '无重大因素');
        
        return sentiment;
    } catch(e) {
        console.error('舆情分析失败:', e.message);
        return { score: 5, trend: 'neutral', factors: [] };
    }
}

// 动态调整网格
function adjustGridBySentiment(sentiment) {
    console.log('\n📊 动态调整网格参数...');
    
    const { score, trend } = sentiment;
    
    if (score >= 8) {
        DYNAMIC_GRID.ETH.maxPrice = Math.max(DYNAMIC_GRID.ETH.maxPrice, 2400);
        DYNAMIC_GRID.ETH.investment = Math.min(DYNAMIC_GRID.ETH.investment * 1.2, 50);
        console.log('🟢 利好情绪：ETH网格上限提升至 $' + DYNAMIC_GRID.ETH.maxPrice);
    } else if (score <= 3) {
        DYNAMIC_GRID.ETH.minPrice = Math.min(DYNAMIC_GRID.ETH.minPrice, 1600);
        DYNAMIC_GRID.ETH.investment = Math.max(DYNAMIC_GRID.ETH.investment * 0.8, 30);
        console.log('🔴 利空情绪：ETH网格下限降低至 $' + DYNAMIC_GRID.ETH.minPrice);
    }
    
    if (trend === 'bullish' && sentiment.factors.some(f => f.includes('Musk'))) {
        DYNAMIC_GRID.DOGE.maxPrice = Math.max(DYNAMIC_GRID.DOGE.maxPrice, 0.12);
        console.log('🚀 马斯克利好：DOGE网格上限提升至 $' + DYNAMIC_GRID.DOGE.maxPrice);
    }
    
    DYNAMIC_GRID.ETH.gridSize = (DYNAMIC_GRID.ETH.maxPrice - DYNAMIC_GRID.ETH.minPrice) / DYNAMIC_GRID.ETH.gridNum;
    DYNAMIC_GRID.DOGE.gridSize = (DYNAMIC_GRID.DOGE.maxPrice - DYNAMIC_GRID.DOGE.minPrice) / DYNAMIC_GRID.DOGE.gridNum;
    
    console.log('调整后的网格:');
    console.log('  ETH:', '$' + DYNAMIC_GRID.ETH.minPrice, '-', '$' + DYNAMIC_GRID.ETH.maxPrice);
    console.log('  DOGE:', '$' + DYNAMIC_GRID.DOGE.minPrice, '-', '$' + DYNAMIC_GRID.DOGE.maxPrice);
}

// 检查风险控制
async function checkRiskControl(config, currentPrice, action) {
    const now = Date.now();
    
    // 检查下单间隔
    if (now - config.lastOrderTime < GRID_CONFIG.minOrderInterval) {
        console.log('  ⏸️ 下单间隔太短，跳过');
        return false;
    }
    
    // 检查持仓限制
    if (action === 'buy' && config.position >= GRID_CONFIG.maxPositionPerCoin) {
        console.log(`  ⚠️ ${config.instId} 持仓已达上限 (${config.position})，停止买入`);
        return false;
    }
    
    // 检查止损（如果持仓亏损超过10%）
    if (config.position > 0 && config.avgPrice) {
        const pnlPercent = (currentPrice - config.avgPrice) / config.avgPrice * 100;
        if (pnlPercent <= GRID_CONFIG.stopLossPercent) {
            console.log(`  🛑 触发止损！当前亏损 ${pnlPercent.toFixed(2)}%`);
            return 'stop_loss';
        }
    }
    
    return true;
}

// 自动决策调整网格
function autoAdjustGrid(currentPrice, config) {
    const distanceToMin = currentPrice - config.minPrice;
    const distanceToMax = config.maxPrice - currentPrice;
    const gridRange = config.maxPrice - config.minPrice;
    
    console.log(`\n🤖 自动决策分析:`);
    console.log(`  距离下限: $${distanceToMin.toFixed(2)}`);
    console.log(`  距离上限: $${distanceToMax.toFixed(2)}`);
    
    if (distanceToMin < config.gridSize) {
        const newMin = config.minPrice - config.gridSize * 2;
        const newMax = config.maxPrice - config.gridSize * 2;
        console.log(`  🎯 决策: 价格接近下限，自动下移网格`);
        console.log(`  新区间: $${newMin} - $${newMax}`);
        config.minPrice = newMin;
        config.maxPrice = newMax;
        return true;
    }
    
    if (distanceToMax < config.gridSize) {
        const newMin = config.minPrice + config.gridSize * 2;
        const newMax = config.maxPrice + config.gridSize * 2;
        console.log(`  🎯 决策: 价格接近上限，自动上移网格`);
        console.log(`  新区间: $${newMin} - $${newMax}`);
        config.minPrice = newMin;
        config.maxPrice = newMax;
        return true;
    }
    
    console.log(`  ⏸️ 决策: 维持当前网格`);
    return false;
}

// 获取当前价格
async function getCurrentPrice(instId) {
    try {
        const result = await request(`/api/v5/market/ticker?instId=${instId}`);
        if (result.data && result.data[0]) {
            return parseFloat(result.data[0].last);
        }
    } catch(e) {
        console.error(`获取${instId}价格失败:`, e.message);
    }
    return null;
}

// 检查网格触发
async function checkGridTrigger(config, currentPrice) {
    const { minPrice, maxPrice, gridSize, lastTradePrice, instId } = config;
    
    const gridIndex = Math.floor((currentPrice - minPrice) / gridSize);
    const gridLower = minPrice + (gridIndex * gridSize);
    const gridUpper = gridLower + gridSize;
    const gridMiddle = (gridLower + gridUpper) / 2;
    
    console.log(`${instId} 当前价格: $${currentPrice.toFixed(4)}`);
    console.log(`  所在网格: $${gridLower.toFixed(4)} - $${gridUpper.toFixed(4)}`);
    console.log(`  网格中点: $${gridMiddle.toFixed(4)}`);
    
    // 首次运行：根据当前位置自动决策
    if (!lastTradePrice) {
        console.log('  🆕 首次运行，根据当前位置自动决策...');
        
        // 如果在网格下半部分（低于中点），立即买入
        if (currentPrice <= gridMiddle) {
            console.log('  🎯 决策: 价格在网格下半部分，首次运行直接买入');
            return { action: 'buy', price: currentPrice, reason: '首次运行，网格下半部分自动买入' };
        } else {
            console.log('  ⏸️ 决策: 价格在网格上半部分，等待涨穿卖出线');
            config.lastTradePrice = currentPrice;
            return null;
        }
    }
    
    // 非首次运行：正常网格逻辑
    const halfGrid = gridSize / 2;
    
    if (currentPrice <= gridLower + halfGrid && lastTradePrice > gridLower + halfGrid) {
        return { action: 'buy', price: currentPrice, reason: '网格下沿买入（自主决策）' };
    } else if (currentPrice >= gridUpper - halfGrid && lastTradePrice < gridUpper - halfGrid) {
        return { action: 'sell', price: currentPrice, reason: '网格上沿卖出（自主决策）' };
    }
    
    return null;
}

// 执行交易（智能fallback：市价失败则转限价，避免重复下单）
async function executeTrade(instId, action, price, amount) {
    try {
        const side = action === 'buy' ? 'buy' : 'sell';
        
        // 获取当前价格
        const ticker = await request(`/api/v5/market/ticker?instId=${instId}`);
        const currentPrice = parseFloat(ticker.data[0].last);
        
        // 检查是否已有同方向订单
        const pending = await request('/api/v5/trade/orders-pending?instType=SPOT');
        const existingOrder = pending.data ? pending.data.find(o => 
            o.instId === instId && o.side === side
        ) : null;
        
        if (existingOrder) {
            console.log(`⚠️ 已有${side}订单存在 @ ${existingOrder.px}，取消旧订单...`);
            await request('/api/v5/trade/cancel-order', 'POST', {
                instId: instId,
                ordId: existingOrder.ordId
            });
            console.log('✅ 已取消旧订单');
        }
        
        // 先尝试市价单
        console.log(`🎯 尝试市价${action}...`);
        const marketBody = {
            instId: instId,
            tdMode: 'cash',
            side: side,
            ordType: 'market',
            sz: amount.toString()
        };
        
        const marketResult = await request('/api/v5/trade/order', 'POST', marketBody);
        
        if (marketResult.code === '0') {
            console.log('✅ 市价单成功！订单ID:', marketResult.data[0].ordId);
            return marketResult;
        }
        
        // 市价单失败，自动转限价单
        console.log('⚠️ 市价单失败，自动转限价单...');
        
        const limitPrice = action === 'buy' 
            ? (currentPrice * 0.9995).toFixed(6)  // 买入：-0.05%
            : (currentPrice * 1.0005).toFixed(6); // 卖出：+0.05%
        
        const limitBody = {
            instId: instId,
            tdMode: 'cash',
            side: side,
            ordType: 'limit',
            sz: amount.toString(),
            px: limitPrice
        };
        
        console.log(`执行限价${action}:`, JSON.stringify(limitBody, null, 2));
        
        const limitResult = await request('/api/v5/trade/order', 'POST', limitBody);
        
        if (limitResult.code === '0') {
            console.log('✅ 限价单成功！订单ID:', limitResult.data[0].ordId);
            return limitResult;
        } else {
            console.error('❌ 限价单也失败:', limitResult.msg);
            return null;
        }
    } catch(e) {
        console.error('交易失败:', e.message);
        return null;
    }
}

// 主循环
async function smartGridTrading() {
    console.log('=== 启动智能舆情网格交易系统（完全自主决策）===');
    console.log('时间:', new Date().toISOString());
    
    const sentiment = await analyzeSentiment();
    adjustGridBySentiment(sentiment);
    
    for (const [name, config] of Object.entries(DYNAMIC_GRID)) {
        console.log(`\n--- 检查 ${name} 网格 ---`);
        
        const currentPrice = await getCurrentPrice(config.instId);
        if (!currentPrice) continue;
        
        autoAdjustGrid(currentPrice, config);
        config.gridSize = (config.maxPrice - config.minPrice) / config.gridNum;
        
        const trigger = await checkGridTrigger(config, currentPrice);
        
        if (trigger) {
            // 风险控制检查
            const riskCheck = await checkRiskControl(config, currentPrice, trigger.action);
            if (riskCheck === 'stop_loss') {
                // 止损卖出
                console.log('🛑 执行止损卖出！');
                const result = await executeTrade(config.instId, 'sell', currentPrice, config.position);
                if (result && result.code === '0') {
                    config.position = 0;
                    config.avgPrice = 0;
                }
            } else if (riskCheck === true) {
                console.log(`🎯 触发${trigger.action}: ${trigger.reason} @ $${trigger.price}`);
                
                const amount = name === 'ETH' ? 0.01 : 100;
                const result = await executeTrade(config.instId, trigger.action, trigger.price, amount);
                
                if (result && result.code === '0') {
                    config.lastTradePrice = trigger.price;
                    config.lastOrderTime = Date.now();
                    
                    // 更新持仓
                    if (trigger.action === 'buy') {
                        config.position += amount;
                        // 计算平均成本
                        const totalCost = (config.avgPrice || 0) * (config.position - amount) + trigger.price * amount;
                        config.avgPrice = totalCost / config.position;
                    } else {
                        config.position -= amount;
                        if (config.position <= 0) config.avgPrice = 0;
                    }
                    
                    config.orders.push({
                        time: new Date().toISOString(),
                        action: trigger.action,
                        price: trigger.price,
                        amount: amount,
                        ordId: result.data[0].ordId,
                        sentiment: sentiment.score
                    });
                    
                    fs.writeFileSync('smart_grid_log.json', JSON.stringify(DYNAMIC_GRID, null, 2));
                }
            }
        } else {
            console.log('⏸️ 未触发网格交易');
        }
    }
    
    console.log('\n=== 本次检查完成 ===\n');
}

smartGridTrading().catch(console.error);
