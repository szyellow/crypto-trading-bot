// ============================================
// RSS新闻监控模块 - v2.3
// 监控加密货币新闻，提取情绪信号
// ============================================

const https = require('https');
const xml2js = require('xml2js');

// RSS源配置
const RSS_SOURCES = [
    {
        name: 'CoinDesk',
        url: 'feeds.feedburner.com/CoinDesk',
        priority: 1
    },
    {
        name: 'Cointelegraph',
        url: 'cointelegraph.com/rss',
        priority: 1
    },
    {
        name: 'Decrypt',
        url: 'decrypt.co/feed',
        priority: 2
    }
];

// 关键词库
const KEYWORDS = {
    positive: [
        'bullish', 'surge', 'rally', 'breakout', 'moon', ' ATH', 'all-time high',
        'adoption', 'partnership', 'listing', 'institutional', ' ETF', 'approve',
        'upgrade', 'mainnet', 'launch', 'growth', 'profit', 'gain', 'pump',
        '突破', '上涨', '利好', '合作', '采用', '升级', '启动', '盈利'
    ],
    negative: [
        'bearish', 'crash', 'dump', 'plunge', 'drop', 'fall', 'decline',
        'hack', 'exploit', 'scam', 'fraud', 'ban', 'regulation', 'SEC',
        'lawsuit', 'investigation', 'delist', 'suspend', 'risk', 'warning',
        '下跌', '暴跌', '黑客', '诈骗', '禁止', '监管', '诉讼', '风险', '警告'
    ],
    coins: {
        'BTC': ['bitcoin', 'btc', '比特币'],
        'ETH': ['ethereum', 'eth', 'ether', '以太坊'],
        'XRP': ['ripple', 'xrp', '瑞波'],
        'SOL': ['solana', 'sol'],
        'ADA': ['cardano', 'ada'],
        'DOT': ['polkadot', 'dot'],
        'DOGE': ['dogecoin', 'doge'],
        'AVAX': ['avalanche', 'avax'],
        'LINK': ['chainlink', 'link'],
        'MATIC': ['polygon', 'matic'],
        'LTC': ['litecoin', 'ltc'],
        'BCH': ['bitcoin cash', 'bch'],
        'XLM': ['stellar', 'xlm'],
        'TRX': ['tron', 'trx', '波场'],
        'FIL': ['filecoin', 'fil'],
        'ETC': ['ethereum classic', 'etc'],
        'XMR': ['monero', 'xmr'],
        'ALGO': ['algorand', 'algo'],
        'VET': ['vechain', 'vet'],
        'ICP': ['internet computer', 'icp'],
        'NEAR': ['near protocol', 'near'],
        'ATOM': ['cosmos', 'atom'],
        'APT': ['aptos', 'apt'],
        'OP': ['optimism', 'op'],
        'ARB': ['arbitrum', 'arb'],
        'SUI': ['sui'],
        'SEI': ['sei'],
        'TON': ['toncoin', 'ton'],
        'BNB': ['binance coin', 'bnb', 'binance'],
        'CC': ['cc', 'carbon credit'],
        'WLFI': ['wlfi', 'world liberty'],
        'BARD': ['bard'],
        'LIT': ['litentry', 'lit'],
        'XPL': ['xpl'],
        'BIO': ['bio', 'bio protocol'],
        'J': ['j'],
        'KITE': ['kite'],
        'HYPE': ['hyperliquid', 'hype']
    }
};

// 缓存
let newsCache = {
    items: [],
    timestamp: 0
};
const CACHE_DURATION = 15 * 60 * 1000; // 15分钟

// 获取RSS新闻
async function fetchRSSFeed(source) {
    return new Promise((resolve, reject) => {
        const req = https.get({
            hostname: source.url.split('/')[0],
            path: '/' + source.url.split('/').slice(1).join('/'),
            method: 'GET',
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (TradingBot/1.0)',
                'Accept': 'application/rss+xml, application/xml, text/xml'
            }
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    resolve(data);
                } else {
                    reject(new Error(`HTTP ${res.statusCode}`));
                }
            });
        });
        
        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('超时'));
        });
    });
}

// 解析RSS XML
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
                    link: item.link?.[0] || '',
                    pubDate: item.pubDate?.[0] || '',
                    timestamp: new Date(item.pubDate?.[0] || Date.now()).getTime()
                });
            });
        }
        
        return items;
    } catch (e) {
        console.error('解析RSS失败:', e.message);
        return [];
    }
}

// 分析新闻情绪
function analyzeSentiment(title, description) {
    const text = (title + ' ' + description).toLowerCase();
    
    let positiveCount = 0;
    let negativeCount = 0;
    
    KEYWORDS.positive.forEach(word => {
        if (text.includes(word.toLowerCase())) positiveCount++;
    });
    
    KEYWORDS.negative.forEach(word => {
        if (text.includes(word.toLowerCase())) negativeCount++;
    });
    
    // 检测提到的币种
    const mentionedCoins = [];
    for (const [coin, aliases] of Object.entries(KEYWORDS.coins)) {
        for (const alias of aliases) {
            if (text.includes(alias.toLowerCase())) {
                mentionedCoins.push(coin);
                break;
            }
        }
    }
    
    // 计算情绪得分
    let score = 5; // 中性
    if (positiveCount > negativeCount) {
        score = Math.min(10, 5 + (positiveCount - negativeCount) * 2);
    } else if (negativeCount > positiveCount) {
        score = Math.max(1, 5 - (negativeCount - positiveCount) * 2);
    }
    
    return {
        score,
        positiveCount,
        negativeCount,
        mentionedCoins: [...new Set(mentionedCoins)],
        isBullish: positiveCount > negativeCount,
        isBearish: negativeCount > positiveCount
    };
}

// 获取所有新闻（带缓存）
async function getAllNews(forceRefresh = false) {
    // 检查缓存
    if (!forceRefresh && newsCache.items.length > 0 && 
        Date.now() - newsCache.timestamp < CACHE_DURATION) {
        console.log('  📰 使用缓存的新闻数据');
        return newsCache.items;
    }
    
    console.log('  📰 获取RSS新闻...');
    const allNews = [];
    
    for (const source of RSS_SOURCES) {
        try {
            const xml = await fetchRSSFeed(source);
            const items = await parseRSS(xml);
            
            items.forEach(item => {
                const sentiment = analyzeSentiment(item.title, item.description);
                allNews.push({
                    ...item,
                    source: source.name,
                    sentiment,
                    relevance: sentiment.mentionedCoins.length > 0 ? 'high' : 'low'
                });
            });
            
            // 延迟避免频率限制
            await new Promise(r => setTimeout(r, 500));
        } catch (e) {
            console.log(`  ⚠️ ${source.name} 获取失败: ${e.message}`);
        }
    }
    
    // 按时间排序
    allNews.sort((a, b) => b.timestamp - a.timestamp);
    
    // 更新缓存
    newsCache = {
        items: allNews.slice(0, 50), // 只保留最新50条
        timestamp: Date.now()
    };
    
    return newsCache.items;
}

// 获取特定币种的新闻情绪
async function getCoinNewsSentiment(coin) {
    const news = await getAllNews();
    const coinAliases = KEYWORDS.coins[coin] || [coin.toLowerCase()];
    
    // 筛选相关新闻（24小时内）
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const relevantNews = news.filter(item => {
        if (item.timestamp < oneDayAgo) return false;
        
        const text = (item.title + ' ' + item.description).toLowerCase();
        return coinAliases.some(alias => text.includes(alias.toLowerCase()));
    });
    
    if (relevantNews.length === 0) {
        return null;
    }
    
    // 计算平均情绪
    const avgScore = relevantNews.reduce((sum, item) => sum + item.sentiment.score, 0) / relevantNews.length;
    const bullishCount = relevantNews.filter(item => item.sentiment.isBullish).length;
    const bearishCount = relevantNews.filter(item => item.sentiment.isBearish).length;
    
    return {
        score: Math.round(avgScore),
        newsCount: relevantNews.length,
        bullishCount,
        bearishCount,
        recentNews: relevantNews.slice(0, 3),
        timestamp: Date.now()
    };
}

// 打印新闻报告
function printNewsReport(coin, sentiment) {
    if (!sentiment) {
        console.log(`  📰 ${coin}: 24小时内无相关新闻`);
        return;
    }
    
    console.log(`\n📰 ${coin} 新闻情绪报告:`);
    console.log(`  相关新闻: ${sentiment.newsCount}条`);
    console.log(`  情绪评分: ${sentiment.score}/10`);
    console.log(`  看涨: ${sentiment.bullishCount}条 | 看跌: ${sentiment.bearishCount}条`);
    
    if (sentiment.recentNews.length > 0) {
        console.log('  最新新闻:');
        sentiment.recentNews.forEach((news, idx) => {
            console.log(`    ${idx + 1}. [${news.source}] ${news.title.substring(0, 60)}...`);
        });
    }
}

// 获取整体市场情绪
async function getOverallMarketSentiment() {
    const news = await getAllNews();
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const recentNews = news.filter(item => item.timestamp >= oneDayAgo);
    
    if (recentNews.length === 0) {
        return { score: 5, newsCount: 0 };
    }
    
    const avgScore = recentNews.reduce((sum, item) => sum + item.sentiment.score, 0) / recentNews.length;
    const bullishCount = recentNews.filter(item => item.sentiment.isBullish).length;
    const bearishCount = recentNews.filter(item => item.sentiment.isBearish).length;
    
    return {
        score: Math.round(avgScore),
        newsCount: recentNews.length,
        bullishCount,
        bearishCount
    };
}

module.exports = {
    getAllNews,
    getCoinNewsSentiment,
    printNewsReport,
    getOverallMarketSentiment
};
