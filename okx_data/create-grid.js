const { request } = require('./okx-api.js');

async function createGridOrder() {
    try {
        // ETH-USDT网格参数
        const body = {
            instId: 'ETH-USDT',
            direction: 'buy',
            gridNum: '15',
            minPx: '1800',
            maxPx: '2200',
            runType: '1',  // 等差
            totalInv: '40',
            quoteSz: '2',
            baseSz: '0.001',
            tpRatio: '10',
            slRatio: '5'
        };
        
        console.log('创建ETH-USDT网格订单...');
        console.log('参数:', JSON.stringify(body, null, 2));
        
        // 使用POST请求创建网格
        const result = await request('/api/v5/tradingBot/grid/order', 'POST', body);
        console.log('结果:', JSON.stringify(result, null, 2));
        
    } catch(e) {
        console.error('错误:', e.message);
    }
}

createGridOrder();
