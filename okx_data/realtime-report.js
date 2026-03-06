const { request } = require('./okx-api.js');

async function getRealTimeReport() {
    console.log('🔍 获取实时数据...\n');
    
    // 获取账户数据
    const balance = await request('/api/v5/account/balance');
    const details = balance.data[0].details || [];
    
    // 获取主要持仓的价格
    const coins = ['BNB', 'TRX'];
    const prices = {};
    
    for (const coin of coins) {
        try {
            const ticker = await request(`/api/v5/market/ticker?instId=${coin}-USDT`);
            if (ticker.data && ticker.data[0]) {
                prices[coin] = {
                    price: parseFloat(ticker.data[0].last),
                    ts: ticker.data[0].ts
                };
            }
        } catch (e) {
            console.error(`获取${coin}价格失败:`, e.message);
        }
    }
    
    // 计算持仓盈亏
    console.log('📊 实时持仓状态:\n');
    
    let totalValue = 0;
    let totalCost = 0;
    
    for (const coin of coins) {
        const d = details.find(x => x.ccy === coin);
        if (d && prices[coin]) {
            const amount = parseFloat(d.eq);
            const avgPrice = parseFloat(d.openAvgPx) || parseFloat(d.accAvgPx) || 0;
            const currentPrice = prices[coin].price;
            const pnlPercent = avgPrice > 0 ? ((currentPrice - avgPrice) / avgPrice * 100) : 0;
            const value = amount * currentPrice;
            const cost = amount * avgPrice;
            
            totalValue += value;
            totalCost += cost;
            
            console.log(`${coin}:`);
            console.log(`  持仓: ${amount.toFixed(6)} 个`);
            console.log(`  成本价: ${avgPrice.toFixed(4)} USDT`);
            console.log(`  当前价: ${currentPrice.toFixed(4)} USDT`);
            console.log(`  盈亏: ${pnlPercent.toFixed(2)}%`);
            console.log(`  OKX时间: ${new Date(parseInt(prices[coin].ts)).toLocaleTimeString()}`);
            console.log('');
        }
    }
    
    // 账户概况
    const usdt = details.find(d => d.ccy === 'USDT');
    const totalEq = parseFloat(balance.data[0].totalEq || 0);
    const usdtAvailable = usdt ? parseFloat(usdt.availEq || 0) : 0;
    
    console.log('💰 账户概况:');
    console.log(`  总资产: ${totalEq.toFixed(2)} USDT`);
    console.log(`  可用USDT: ${usdtAvailable.toFixed(2)}`);
    console.log(`  持仓价值: ${totalValue.toFixed(2)} USDT`);
    console.log(`  持仓成本: ${totalCost.toFixed(2)} USDT`);
    console.log(`  持仓盈亏: ${totalCost > 0 ? ((totalValue - totalCost) / totalCost * 100).toFixed(2) : 0}%`);
}

getRealTimeReport().catch(console.error);
