// ============================================
// CoinGecko 市场情绪监控模块 - v2.3 优化版
// 快速缓存优先，后台更新
// ============================================

const https = require('https');

const COINGECKO_BASE_URL = 'api.coingecko.com';
const CACHE_DURATION = 10 * 60 * 1000; // 10分钟缓存

let sentimentCache = {};
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 3000; // 3秒间隔

// 币种ID映射
const coinIdMap = {
    'BTC': 'bitcoin', 'ETH': 'ethereum', 'XRP': 'ripple',
    'SOL': 'solana', 'ADA': 'cardano', 'DOT': 'polkadot',
    'DOGE': 'dogecoin', 'AVAX': 'avalanche-2', 'LINK': 'chainlink',
    'MATIC': 'matic-network', 'LTC': 'litecoin', 'BCH': 'bitcoin-cash',
    'XLM': 'stellar', 'TRX': 'tron', 'FIL': 'filecoin',
    'ETC': 'ethereum-classic', 'XMR': 'monero', 'ALGO': 'algorand',
    'VET': 'vechain', 'ICP': 'internet-computer', 'NEAR': 'near',
    'ATOM': 'cosmos', 'APT': 'aptos', 'OP': 'optimism',
    'ARB': 'arbitrum', 'SUI': 'sui', 'SEI': 'sei-network',
    'TON': 'the-open-network', 'XAUT': 'tether-gold',
    'PAXG': 'pax-gold', 'USDC': 'usd-coin', 'USDT': 'tether',
    'BNB': 'binancecoin'
};

// 快速获取数据（优先缓存，不阻塞）
async function getCoinGeckoData(coin) {
    // 检查缓存
    if (sentimentCache[coin] && Date.now() - sentimentCache[coin].timestamp < CACHE_DURATION) {
        return sentimentCache[coin].data;
    }
    
    // 无缓存时返回null，后台更新
    fetchCoinGeckoDataAsync(coin);
    return null;
}

// 后台异步获取（不阻塞主流程）
async function fetchCoinGeckoDataAsync(coin) {
    try {
        const data = await fetchWithRateLimit(coin);
        if (data) {
            sentimentCache[coin] = {
                data: data,
                timestamp: Date.now()
            };
        }
    } catch (e) {
        // 后台错误忽略
    }
}

// 带频率控制的请求
async function fetchWithRateLimit(coin) {
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
        await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest));
    }
    
    const coinId = coinIdMap[coin] || coin.toLowerCase();
    const path = `/api/v3/coins/${coinId}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false`;
    
    return new Promise((resolve, reject) => {
        const req = https.get({
            hostname: COINGECKO_BASE_URL,
            path: path,
            method: 'GET',
            timeout: 8000,
            headers: { 'User-Agent': 'TradingBot/1.0' }
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                lastRequestTime = Date.now();
                if (res.statusCode === 200) {
                    try {
                        const parsed = JSON.parse(data);
                        resolve(extractData(parsed));
                    } catch (e) {
                        reject(e);
                    }
                } else {
                    reject(new Error(`HTTP ${res.statusCode}`));
                }
            });
        });
        
        req.on('error', (err) => {
            lastRequestTime = Date.now();
            reject(err);
        });
        req.on('timeout', () => {
            lastRequestTime = Date.now();
            req.destroy();
            reject(new Error('超时'));
        });
    });
}

// 提取关键数据
function extractData(data) {
    if (!data.market_data) return null;
    
    const md = data.market_data;
    const result = {
        price: md.current_price?.usd || 0,
        priceChange24h: md.price_change_percentage_24h || 0,
        priceChange7d: md.price_change_percentage_7d || 0,
        marketCap: md.market_cap?.usd || 0,
        totalVolume: md.total_volume?.usd || 0,
        timestamp: Date.now()
    };
    
    // 计算趋势评分
    let score = 5;
    if (result.priceChange24h > 5) score += 2;
    else if (result.priceChange24h > 2) score += 1;
    else if (result.priceChange24h < -5) score -= 2;
    else if (result.priceChange24h < -2) score -= 1;
    
    if (result.priceChange7d > 10) score += 1;
    else if (result.priceChange7d < -10) score -= 1;
    
    result.trendScore = Math.max(1, Math.min(10, Math.round(score)));
    
    return result;
}

// 打印报告
function printCoinGeckoReport(coin, data) {
    if (!data) return;
    console.log(`\n📊 ${coin} CoinGecko:`);
    console.log(`  价格: $${data.price.toFixed(4)} | 24h: ${data.priceChange24h.toFixed(2)}% | 情绪: ${data.trendScore}/10`);
}

module.exports = { getCoinGeckoData, printCoinGeckoReport };
