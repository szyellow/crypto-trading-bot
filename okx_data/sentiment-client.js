// ============================================
// 市场情绪数据客户端
// 通过HTTP API访问Sub-agent服务
// ============================================

const http = require('http');

const SERVICE_HOST = 'localhost';
const SERVICE_PORT = 3456;
const REQUEST_TIMEOUT = 5000; // 5秒超时

// HTTP GET请求
function httpGet(path) {
    return new Promise((resolve, reject) => {
        const req = http.get({
            hostname: SERVICE_HOST,
            port: SERVICE_PORT,
            path: path,
            timeout: REQUEST_TIMEOUT
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve(json);
                } catch (e) {
                    reject(new Error('解析JSON失败'));
                }
            });
        });
        
        req.on('error', (err) => reject(err));
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('请求超时'));
        });
    });
}

// 检查服务是否可用
async function isServiceAvailable() {
    try {
        await httpGet('/health');
        return true;
    } catch (e) {
        return false;
    }
}

// 获取CoinGecko数据
async function getCoinGeckoData(coin) {
    try {
        const response = await httpGet(`/coingecko?coin=${coin}`);
        return response.data || null;
    } catch (e) {
        console.log(`  ⚠️ CoinGecko服务不可用: ${e.message}`);
        return null;
    }
}

// 获取RSS新闻情绪
async function getCoinNewsSentiment(coin) {
    try {
        const response = await httpGet(`/rss?coin=${coin}`);
        return response.sentiment || null;
    } catch (e) {
        console.log(`  ⚠️ RSS服务不可用: ${e.message}`);
        return null;
    }
}

// 获取综合情绪数据
async function getCombinedSentiment(coin) {
    try {
        const response = await httpGet(`/sentiment?coin=${coin}`);
        return {
            coingecko: response.coingecko,
            rss: response.rss
        };
    } catch (e) {
        console.log(`  ⚠️ 情绪服务不可用: ${e.message}`);
        return { coingecko: null, rss: null };
    }
}

// 打印CoinGecko报告
function printCoinGeckoReport(coin, data) {
    if (!data) return;
    console.log(`\n📊 ${coin} CoinGecko:`);
    console.log(`  价格: $${data.price.toFixed(4)} | 24h: ${data.priceChange24h.toFixed(2)}% | 情绪: ${data.trendScore}/10`);
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
    
    if (sentiment.recentNews && sentiment.recentNews.length > 0) {
        console.log('  最新新闻:');
        sentiment.recentNews.forEach((news, idx) => {
            console.log(`    ${idx + 1}. [${news.source}] ${news.title.substring(0, 60)}...`);
        });
    }
}

module.exports = {
    isServiceAvailable,
    getCoinGeckoData,
    getCoinNewsSentiment,
    getCombinedSentiment,
    printCoinGeckoReport,
    printNewsReport
};
