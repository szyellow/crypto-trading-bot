// ============================================
// 市场情绪数据服务 - Sub-agent模式
// 独立进程运行，提供HTTP API接口
// ============================================

const http = require('http');
const https = require('https');
const xml2js = require('xml2js');

const PORT = 3456;

// ============================================
// CoinGecko 模块
// ============================================
const COINGECKO_BASE_URL = 'api.coingecko.com';
const CG_CACHE_DURATION = 10 * 60 * 1000; // 10分钟

let cgCache = {};
let cgLastRequestTime = 0;
const CG_MIN_INTERVAL = 3000; // 3秒间隔

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

async function fetchCoinGecko(coin) {
    // 检查缓存
    if (cgCache[coin] && Date.now() - cgCache[coin].timestamp < CG_CACHE_DURATION) {
        return cgCache[coin].data;
    }
    
    try {
        const now = Date.now();
        const timeSinceLastRequest = now - cgLastRequestTime;
        if (timeSinceLastRequest < CG_MIN_INTERVAL) {
            await new Promise(r => setTimeout(r, CG_MIN_INTERVAL - timeSinceLastRequest));
        }
        
        const coinId = coinIdMap[coin] || coin.toLowerCase();
        const path = `/api/v3/coins/${coinId}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false`;
        
        const data = await new Promise((resolve, reject) => {
            const req = https.get({
                hostname: COINGECKO_BASE_URL,
                path: path,
                method: 'GET',
                timeout: 10000,
                headers: { 'User-Agent': 'MarketSentimentService/1.0' }
            }, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    cgLastRequestTime = Date.now();
                    if (res.statusCode === 200) {
                        try {
                            resolve(JSON.parse(data));
                        } catch (e) {
                            reject(e);
                        }
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}`));
                    }
                });
            });
            req.on('error', reject);
            req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
        });
        
        if (!data.market_data) return null;
        
        const md = data.market_data;
        const result = {
            price: md.current_price?.usd || 0,
            priceChange24h: md.price_change_percentage_24h || 0,
            priceChange7d: md.price_change_percentage_7d || 0,
            marketCap: md.market_cap?.usd || 0,
            totalVolume: md.total_volume?.usd || 0
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
        
        cgCache[coin] = { data: result, timestamp: Date.now() };
        return result;
    } catch (e) {
        console.error(`CoinGecko获取${coin}失败:`, e.message);
        return null;
    }
}

// ============================================
// RSS 模块
// ============================================
const RSS_SOURCES = [
    { name: 'CoinDesk', url: 'feeds.feedburner.com/CoinDesk' },
    { name: 'Cointelegraph', url: 'cointelegraph.com/rss' },
    { name: 'Decrypt', url: 'decrypt.co/feed' }
];

const RSS_CACHE_DURATION = 15 * 60 * 1000; // 15分钟
let rssCache = { items: [], timestamp: 0 };

const KEYWORDS = {
    positive: ['bullish', 'surge', 'rally', 'breakout', 'ATH', 'adoption', 'partnership', 'listing', 'institutional', 'ETF', 'upgrade', 'growth'],
    negative: ['bearish', 'crash', 'dump', 'plunge', 'hack', 'exploit', 'scam', 'ban', 'regulation', 'SEC', 'lawsuit', 'risk'],
    coins: {
        'BTC': ['bitcoin', 'btc'], 'ETH': ['ethereum', 'eth'], 'XRP': ['ripple', 'xrp'],
        'SOL': ['solana', 'sol'], 'ADA': ['cardano', 'ada'], 'DOT': ['polkadot', 'dot'],
        'DOGE': ['dogecoin', 'doge'], 'AVAX': ['avalanche', 'avax'], 'LINK': ['chainlink', 'link'],
        'MATIC': ['polygon', 'matic'], 'TRX': ['tron', 'trx'], 'FIL': ['filecoin', 'fil'],
        'NEAR': ['near'], 'ATOM': ['cosmos', 'atom'], 'SUI': ['sui'], 'BNB': ['binance', 'bnb']
    }
};

async function fetchRSS(source) {
    return new Promise((resolve, reject) => {
        const req = https.get({
            hostname: source.url.split('/')[0],
            path: '/' + source.url.split('/').slice(1).join('/'),
            timeout: 10000,
            headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/rss+xml' }
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => res.statusCode === 200 ? resolve(data) : reject(new Error(`HTTP ${res.statusCode}`)));
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    });
}

async function parseRSS(xml) {
    try {
        const parser = new xml2js.Parser();
        const result = await parser.parseStringPromise(xml);
        const items = [];
        const channel = result.rss?.channel?.[0];
        if (channel && channel.item) {
            channel.item.forEach(item => {
                items.push({
                    title: item.title?.[0] || '',
                    description: item.description?.[0] || '',
                    pubDate: item.pubDate?.[0] || '',
                    timestamp: new Date(item.pubDate?.[0] || Date.now()).getTime()
                });
            });
        }
        return items;
    } catch (e) { return []; }
}

function analyzeSentiment(title, description) {
    const text = (title + ' ' + description).toLowerCase();
    let positiveCount = 0, negativeCount = 0;
    KEYWORDS.positive.forEach(w => { if (text.includes(w)) positiveCount++; });
    KEYWORDS.negative.forEach(w => { if (text.includes(w)) negativeCount++; });
    
    const mentionedCoins = [];
    for (const [coin, aliases] of Object.entries(KEYWORDS.coins)) {
        if (aliases.some(a => text.includes(a))) mentionedCoins.push(coin);
    }
    
    let score = 5;
    if (positiveCount > negativeCount) score = Math.min(10, 5 + (positiveCount - negativeCount) * 2);
    else if (negativeCount > positiveCount) score = Math.max(1, 5 - (negativeCount - positiveCount) * 2);
    
    return { score, positiveCount, negativeCount, mentionedCoins: [...new Set(mentionedCoins)] };
}

async function getAllRSSNews() {
    if (rssCache.items.length > 0 && Date.now() - rssCache.timestamp < RSS_CACHE_DURATION) {
        return rssCache.items;
    }
    
    const allNews = [];
    for (const source of RSS_SOURCES) {
        try {
            const xml = await fetchRSS(source);
            const items = await parseRSS(xml);
            items.forEach(item => {
                const sentiment = analyzeSentiment(item.title, item.description);
                allNews.push({ ...item, source: source.name, sentiment });
            });
            await new Promise(r => setTimeout(r, 500));
        } catch (e) {
            console.log(`RSS ${source.name} 失败:`, e.message);
        }
    }
    
    allNews.sort((a, b) => b.timestamp - a.timestamp);
    rssCache = { items: allNews.slice(0, 50), timestamp: Date.now() };
    return rssCache.items;
}

function getCoinNewsSentiment(coin, news) {
    const aliases = KEYWORDS.coins[coin] || [coin.toLowerCase()];
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    
    const relevantNews = news.filter(item => {
        if (item.timestamp < oneDayAgo) return false;
        const text = (item.title + ' ' + item.description).toLowerCase();
        return aliases.some(a => text.includes(a));
    });
    
    if (relevantNews.length === 0) return null;
    
    const avgScore = relevantNews.reduce((sum, item) => sum + item.sentiment.score, 0) / relevantNews.length;
    const bullishCount = relevantNews.filter(item => item.sentiment.score > 5).length;
    const bearishCount = relevantNews.filter(item => item.sentiment.score < 5).length;
    
    return {
        score: Math.round(avgScore),
        newsCount: relevantNews.length,
        bullishCount,
        bearishCount,
        recentNews: relevantNews.slice(0, 3).map(n => ({ title: n.title, source: n.source }))
    };
}

// ============================================
// HTTP API 服务
// ============================================
const server = http.createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    const url = new URL(req.url, `http://localhost:${PORT}`);
    
    try {
        if (url.pathname === '/health') {
            res.writeHead(200);
            res.end(JSON.stringify({ status: 'ok', timestamp: Date.now() }));
        }
        else if (url.pathname === '/coingecko') {
            const coin = url.searchParams.get('coin');
            if (!coin) {
                res.writeHead(400);
                res.end(JSON.stringify({ error: 'Missing coin parameter' }));
                return;
            }
            const data = await fetchCoinGecko(coin);
            res.writeHead(data ? 200 : 404);
            res.end(JSON.stringify({ coin, data, timestamp: Date.now() }));
        }
        else if (url.pathname === '/rss') {
            const coin = url.searchParams.get('coin');
            const news = await getAllRSSNews();
            
            if (coin) {
                const sentiment = getCoinNewsSentiment(coin, news);
                res.writeHead(sentiment ? 200 : 404);
                res.end(JSON.stringify({ coin, sentiment, timestamp: Date.now() }));
            } else {
                res.writeHead(200);
                res.end(JSON.stringify({ newsCount: news.length, timestamp: Date.now() }));
            }
        }
        else if (url.pathname === '/sentiment') {
            const coin = url.searchParams.get('coin');
            if (!coin) {
                res.writeHead(400);
                res.end(JSON.stringify({ error: 'Missing coin parameter' }));
                return;
            }
            
            const [cgData, news] = await Promise.all([
                fetchCoinGecko(coin),
                getAllRSSNews()
            ]);
            
            const rssSentiment = getCoinNewsSentiment(coin, news);
            
            res.writeHead(200);
            res.end(JSON.stringify({
                coin,
                coingecko: cgData,
                rss: rssSentiment,
                timestamp: Date.now()
            }));
        }
        else {
            res.writeHead(404);
            res.end(JSON.stringify({ error: 'Not found' }));
        }
    } catch (e) {
        console.error('API错误:', e.message);
        res.writeHead(500);
        res.end(JSON.stringify({ error: e.message }));
    }
});

server.listen(PORT, () => {
    console.log(`🚀 市场情绪数据服务启动`);
    console.log(`📡 端口: ${PORT}`);
    console.log(`📊 API端点:`);
    console.log(`   GET /health - 健康检查`);
    console.log(`   GET /coingecko?coin=XRP - CoinGecko数据`);
    console.log(`   GET /rss?coin=XRP - RSS新闻情绪`);
    console.log(`   GET /sentiment?coin=XRP - 综合情绪数据`);
    console.log('');
    console.log('💡 主交易程序可以通过HTTP API访问此服务');
});

// 定期预热缓存
setInterval(async () => {
    console.log('🔄 预热RSS缓存...');
    await getAllRSSNews();
}, 10 * 60 * 1000); // 每10分钟
