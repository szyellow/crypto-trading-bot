const { request } = require('/root/.openclaw/workspace/okx_data/okx-api.js');
const https = require('https');

// 获取CoinGecko价格（带User-Agent）
async function getCoinGeckoPrices(coins) {
    return new Promise((resolve, reject) => {
        const ids = coins.join(',');
        const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`;
        
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        };
        
        https.get(url, options, (res) => {
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

// 获取加密货币市场数据
async function getMarketData() {
    return new Promise((resolve, reject) => {
        const url = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=10&page=1&sparkline=false&price_change_percentage=24h';
        
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        };
        
        https.get(url, options, (res) => {
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

async function main() {
    try {
        const prices = await getCoinGeckoPrices(['bitcoin', 'ethereum', 'ripple']);
        console.log('=== CoinGecko价格 ===');
        console.log(JSON.stringify(prices, null, 2));
        
        const market = await getMarketData();
        console.log('\n=== 市场数据 ===');
        console.log(JSON.stringify(market, null, 2));
    } catch (error) {
        console.error('错误:', error.message);
    }
}

main();
