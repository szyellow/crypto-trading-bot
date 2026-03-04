const { request } = require('./okx-api.js');
const fs = require('fs');

// 网格配置
const GRID_CONFIG = {
    ETH: {
        instId: 'ETH-USDT',
        minPrice: 1800,
        maxPrice: 2200,
        gridNum: 15,
        investment: 40,
        gridSize: (2200 - 1800) / 15, // 26.67
        lastTradePrice: null,
        orders: []
    },
    DOGE: {
        instId: 'DOGE-USDT',
        minPrice: 0.09,
        maxPrice: 0.11,
        gridNum: 10,
        investment: 10,
        gridSize: (0.11 - 0.09) / 10, // 0.002
        lastTradePrice: null,
        orders: []
    }
};

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
    
    // 计算当前价格在哪个网格
    const gridIndex = Math.floor((currentPrice - minPrice) / gridSize);
    const gridLower = minPrice + (gridIndex * gridSize);
    const gridUpper = gridLower + gridSize;
    
    console.log(`${instId} 当前价格: $${currentPrice.toFixed(4)}`);
    console.log(`  所在网格: $${gridLower.toFixed(4)} - $${gridUpper.toFixed(4)}`);
    
    // 如果没有上次交易价格，初始化
    if (!lastTradePrice) {
        config.lastTradePrice = currentPrice;
        return null;
    }
    
    // 计算价格变动
    const priceChange = currentPrice - lastTradePrice;
    const changePercent = (priceChange / lastTradePrice) * 100;
    
    // 触发条件：价格变动超过半个网格
    const halfGrid = gridSize / 2;
    
    if (currentPrice <= gridLower + halfGrid && lastTradePrice > gridLower + halfGrid) {
        // 价格下跌，触发买入
        return { action: 'buy', price: currentPrice, reason: '网格下沿买入' };
    } else if (currentPrice >= gridUpper - halfGrid && lastTradePrice < gridUpper - halfGrid) {
        // 价格上涨，触发卖出
        return { action: 'sell', price: currentPrice, reason: '网格上沿卖出' };
    }
    
    return null;
}

// 执行交易
async function executeTrade(instId, action, price, amount) {
    try {
        const side = action === 'buy' ? 'buy' : 'sell';
        const ordType = 'market'; // 市价单，立即成交
        
        const body = {
            instId: instId,
            tdMode: 'cash', // 现货模式
            side: side,
            ordType: ordType,
            sz: amount.toString()
        };
        
        console.log(`执行${action}:`, JSON.stringify(body, null, 2));
        
        // 实际下单（启用真实交易）
        const result = await request('/api/v5/trade/order', 'POST', body);
        
        if (result.code === '0') {
            console.log('✅ 交易成功！订单ID:', result.data[0].ordId);
            
            // 发送交易通知
            const tradeMsg = `🎯 网格交易执行\n\n操作: ${action.toUpperCase()}\n币种: ${instId}\n数量: ${amount}\n价格: $${price}\n时间: ${new Date().toISOString()}`;
            console.log(tradeMsg);
            
            return result;
        } else {
            console.error('❌ 交易失败:', result.msg);
            return null;
        }
    } catch(e) {
        console.error('交易失败:', e.message);
        return null;
    }
}

// 主循环
async function gridTradingLoop() {
    console.log('=== 启动现货网格交易系统 ===');
    console.log('时间:', new Date().toISOString());
    
    for (const [name, config] of Object.entries(GRID_CONFIG)) {
        console.log(`\n--- 检查 ${name} 网格 ---`);
        
        const currentPrice = await getCurrentPrice(config.instId);
        if (!currentPrice) continue;
        
        const trigger = await checkGridTrigger(config, currentPrice);
        
        if (trigger) {
            console.log(`🎯 触发${trigger.action}: ${trigger.reason} @ $${trigger.price}`);
            
            // 计算交易数量
            const amount = name === 'ETH' ? 0.01 : 100; // ETH 0.01个，DOGE 100个
            
            // 执行交易
            const result = await executeTrade(config.instId, trigger.action, trigger.price, amount);
            
            if (result && result.code === '0') {
                console.log('✅ 交易成功:', result.data[0].ordId);
                config.lastTradePrice = trigger.price;
                
                // 记录交易
                config.orders.push({
                    time: new Date().toISOString(),
                    action: trigger.action,
                    price: trigger.price,
                    amount: amount,
                    ordId: result.data[0].ordId
                });
                
                // 保存到文件
                fs.writeFileSync('grid_trading_log.json', JSON.stringify(GRID_CONFIG, null, 2));
            }
        } else {
            console.log('⏸️ 未触发网格交易');
        }
    }
    
    console.log('\n=== 本次检查完成 ===\n');
}

// 运行
gridTradingLoop().catch(console.error);
