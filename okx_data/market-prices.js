const { request } = require('./okx-api.js');

async function getMarketPrices() {
    try {
        // 获取BTC, ETH, XRP, SOL, DOGE的市场价格
        const symbols = ['BTC-USDT', 'ETH-USDT', 'XRP-USDT', 'SOL-USDT', 'DOGE-USDT', 'LTC-USDT', 'ADA-USDT'];
        const prices = {};
        
        for (const symbol of symbols) {
            const data = await request(`/api/v5/market/ticker?instId=${symbol}`);
            if (data.code === '0' && data.data && data.data[0]) {
                const ticker = data.data[0];
                const open24h = parseFloat(ticker.open24h);
                const last = parseFloat(ticker.last);
                const changePercent = open24h > 0 ? ((last - open24h) / open24h * 100).toFixed(2) : '0.00';
                
                prices[symbol.replace('-USDT', '')] = {
                    price: last,
                    change24h: parseFloat(ticker.change24h) || (last - open24h),
                    changePercent: changePercent,
                    high24h: parseFloat(ticker.high24h),
                    low24h: parseFloat(ticker.low24h),
                    vol24h: parseFloat(ticker.vol24h)
                };
            }
        }
        
        console.log(JSON.stringify(prices, null, 2));
    } catch (err) {
        console.error('Error:', err.message);
    }
}

getMarketPrices();
