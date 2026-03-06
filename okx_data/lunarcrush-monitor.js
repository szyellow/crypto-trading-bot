// ============================================
// LunarCrush 社交媒体情绪监控模块
// ============================================

const https = require('https');

const LUNARCRUSH_API_KEY = process.env.LUNARCRUSH_API_KEY || '';
const LUNARCRUSH_BASE_URL = 'api.lunarcrush.com';

// 缓存情绪数据（5分钟）
let sentimentCache = {};
const CACHE_DURATION = 5 * 60 * 1000; // 5分钟

// 获取币种社交媒体情绪
async function getSocialSentiment(coin) {
    try {
        // 检查缓存
        if (sentimentCache[coin] && Date.now() - sentimentCache[coin].timestamp < CACHE_DURATION) {
            console.log(`  📊 ${coin} 使用缓存的情绪数据`);
            return sentimentCache[coin].data;
        }
        
        const path = `/v2?data=assets&key=${LUNARCRUSH_API_KEY}&symbol=${coin}`;
        
        const data = await new Promise((resolve, reject) => {
            const req = https.get({
                hostname: LUNARCRUSH_BASE_URL,
                path: path,
                method: 'GET',
                timeout: 10000
            }, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(new Error('解析JSON失败'));
                    }
                });
            });
            
            req.on('error', reject);
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('请求超时'));
            });
        });
        
        if (!data.data || data.data.length === 0) {
            console.log(`  ⚠️ ${coin} 无LunarCrush数据`);
            return null;
        }
        
        const asset = data.data[0];
        
        // 提取关键指标
        const sentiment = {
            score: asset.average_sentiment || 0,           // 1-5分
            bullishPercent: asset.bullish_sentiment || 0,  // 看涨比例
            bearishPercent: asset.bearish_sentiment || 0,  // 看跌比例
            socialVolume: asset.social_volume || 0,        // 社交量
            socialScore: asset.social_score || 0,          // 社交得分
            galaxyScore: asset.galaxy_score || 0,          // 综合得分
            price: asset.price || 0,
            percentChange24h: asset.percent_change_24h || 0,
            timestamp: Date.now()
        };
        
        // 转换为我们的趋势评分（1-10分）
        const trendScore = convertToTrendScore(sentiment);
        
        const result = {
            ...sentiment,
            trendScore
        };
        
        // 缓存数据
        sentimentCache[coin] = {
            data: result,
            timestamp: Date.now()
        };
        
        return result;
    } catch (e) {
        console.error(`获取${coin}社交媒体情绪失败:`, e.message);
        return null;
    }
}

// 将LunarCrush情绪转换为我们的趋势评分
function convertToTrendScore(sentiment) {
    let score = 5; // 基础分
    
    // 情绪分数 (1-5分) 映射到 (1-10分)
    if (sentiment.score > 0) {
        score = sentiment.score * 2;
    }
    
    // 看涨/看跌比例调整
    if (sentiment.bullishPercent > sentiment.bearishPercent * 1.5) {
        score += 1;
    } else if (sentiment.bearishPercent > sentiment.bullishPercent * 1.5) {
        score -= 1;
    }
    
    // 社交量调整（高社交量增加信心）
    if (sentiment.socialVolume > 1000) {
        score += 0.5;
    }
    
    // Galaxy Score调整
    if (sentiment.galaxyScore > 80) {
        score += 1;
    } else if (sentiment.galaxyScore < 40) {
        score -= 1;
    }
    
    return Math.max(1, Math.min(10, Math.round(score)));
}

// 批量获取多个币种的情绪
async function getBatchSentiment(coins) {
    const symbols = coins.join(',');
    try {
        const url = `${LUNARCRUSH_BASE_URL}?data=assets&key=${LUNARCRUSH_API_KEY}&symbol=${symbols}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`API请求失败: ${response.status}`);
        }
        
        const data = await response.json();
        
        const results = {};
        if (data.data) {
            data.data.forEach(asset => {
                const coin = asset.symbol;
                const sentiment = {
                    score: asset.average_sentiment || 0,
                    bullishPercent: asset.bullish_sentiment || 0,
                    bearishPercent: asset.bearish_sentiment || 0,
                    socialVolume: asset.social_volume || 0,
                    socialScore: asset.social_score || 0,
                    galaxyScore: asset.galaxy_score || 0,
                    trendScore: convertToTrendScore({
                        score: asset.average_sentiment || 0,
                        bullishPercent: asset.bullish_sentiment || 0,
                        bearishPercent: asset.bearish_sentiment || 0,
                        socialVolume: asset.social_volume || 0,
                        galaxyScore: asset.galaxy_score || 0
                    })
                };
                results[coin] = sentiment;
                
                // 更新缓存
                sentimentCache[coin] = {
                    data: sentiment,
                    timestamp: Date.now()
                };
            });
        }
        
        return results;
    } catch (e) {
        console.error('批量获取情绪数据失败:', e.message);
        return {};
    }
}

// 打印情绪报告
function printSentimentReport(coin, sentiment) {
    if (!sentiment) return;
    
    console.log(`\n📱 ${coin} 社交媒体情绪报告:`);
    console.log(`  情绪评分: ${sentiment.score.toFixed(2)}/5 → 趋势${sentiment.trendScore}/10`);
    console.log(`  看涨比例: ${sentiment.bullishPercent.toFixed(1)}%`);
    console.log(`  看跌比例: ${sentiment.bearishPercent.toFixed(1)}%`);
    console.log(`  社交量: ${sentiment.socialVolume.toLocaleString()}`);
    console.log(`  Galaxy Score: ${sentiment.galaxyScore.toFixed(0)}`);
    
    // 情绪判断
    if (sentiment.trendScore >= 8) {
        console.log(`  🟢 情绪: 极度看涨`);
    } else if (sentiment.trendScore >= 6) {
        console.log(`  🟡 情绪: 温和看涨`);
    } else if (sentiment.trendScore <= 3) {
        console.log(`  🔴 情绪: 极度看跌`);
    } else {
        console.log(`  ⚪ 情绪: 中性`);
    }
}

module.exports = {
    getSocialSentiment,
    getBatchSentiment,
    printSentimentReport
};
