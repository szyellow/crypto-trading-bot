const { request } = require('/root/.openclaw/workspace/okx_data/okx-api.js');
const https = require('https');

// 获取OKX账户余额
async function getAccountBalance() {
    try {
        const data = await request('/api/v5/account/balance');
        console.log('=== 账户余额 ===');
        console.log(JSON.stringify(data, null, 2));
        return data;
    } catch (error) {
        console.error('获取账户余额失败:', error.message);
        return null;
    }
}

// 获取持仓
async function getPositions() {
    try {
        const data = await request('/api/v5/account/positions');
        console.log('=== 持仓信息 ===');
        console.log(JSON.stringify(data, null, 2));
        return data;
    } catch (error) {
        console.error('获取持仓失败:', error.message);
        return null;
    }
}

// 获取网格策略
async function getGridStrategies() {
    try {
        const data = await request('/api/v5/tradingBot/grid/orders-algo-pending?algoOrdType=grid');
        console.log('=== 网格策略 ===');
        console.log(JSON.stringify(data, null, 2));
        return data;
    } catch (error) {
        console.error('获取网格策略失败:', error.message);
        return null;
    }
}

// 获取CoinGecko价格
async function getCoinGeckoPrices(coins) {
    return new Promise((resolve, reject) => {
        const ids = coins.join(',');
        const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`;
        
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve(json);
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

// 主函数
async function main() {
    const balance = await getAccountBalance();
    const positions = await getPositions();
    const grids = await getGridStrategies();
    
    // 提取持有的币种
    const holdings = [];
    if (balance && balance.data && balance.data[0] && balance.data[0].details) {
        for (const detail of balance.data[0].details) {
            if (parseFloat(detail.eqUsd) > 1) {  // 只显示有价值超过1美元的币种
                holdings.push({
                    ccy: detail.ccy,
                    eq: detail.eq,
                    eqUsd: detail.eqUsd,
                    avgCost: detail.avgCost || 'N/A'
                });
            }
        }
    }
    
    console.log('\n=== 持仓汇总 ===');
    console.log(JSON.stringify(holdings, null, 2));
    
    // 获取主要币种的价格
    const coinIds = ['bitcoin', 'ethereum', 'solana', 'ripple', 'cardano', 'sui'];
    const prices = await getCoinGeckoPrices(coinIds);
    console.log('\n=== CoinGecko价格 ===');
    console.log(JSON.stringify(prices, null, 2));
    
    return { balance, positions, grids, holdings, prices };
}

main().then(result => {
    // 输出完整结果供后续处理
    console.log('\n=== 完整数据 ===');
    console.log(JSON.stringify(result, null, 2));
}).catch(console.error);
