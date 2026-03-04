const { request } = require('./okx-api.js');

async function fetchAllData() {
    try {
        // 1. 获取账户余额
        const balance = await request('/api/v5/account/balance');
        console.log('=== BALANCE ===');
        console.log(JSON.stringify(balance, null, 2));

        // 2. 获取网格策略
        const gridStrategies = await request('/api/v5/tradingBot/grid/orders-pending');
        console.log('\n=== GRID STRATEGIES ===');
        console.log(JSON.stringify(gridStrategies, null, 2));

        // 3. 获取市场行情
        const tickers = await request('/api/v5/market/tickers?instType=SPOT');
        console.log('\n=== TICKERS ===');
        console.log(JSON.stringify(tickers, null, 2));

        // 4. 获取持仓
        const positions = await request('/api/v5/account/positions');
        console.log('\n=== POSITIONS ===');
        console.log(JSON.stringify(positions, null, 2));

    } catch (err) {
        console.error('Error:', err.message);
    }
}

fetchAllData();
