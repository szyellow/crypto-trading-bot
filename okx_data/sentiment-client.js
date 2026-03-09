// ============================================
// 市场情绪数据客户端
// 通过HTTP API访问Sub-agent服务
// ============================================

const http = require('http');
const { spawn } = require('child_process');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const SERVICE_HOST = 'localhost';
const SERVICE_PORT = 3456;
const REQUEST_TIMEOUT = 3000; // 3秒超时（增加）
let restartAttempted = false; // 防止重复重启
let serviceDisabled = false;  // 服务禁用标志（如果多次失败则禁用）
let failureCount = 0;         // 失败计数
const MAX_FAILURES = 5;       // 最大失败次数（增加到5次）

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

// 重启Sub-agent服务
async function restartService() {
    if (serviceDisabled) {
        return false;
    }
    
    if (restartAttempted) {
        console.log('  ⏭️ 已尝试重启，跳过...');
        return false;
    }
    
    restartAttempted = true;
    console.log('  ⚠️ 情绪服务不可用，尝试重启...');
    
    try {
        // 使用spawn启动服务
        const child = spawn('node', ['market-sentiment-service.js'], {
            cwd: '/root/.openclaw/workspace/okx_data',
            detached: true,
            stdio: 'ignore'
        });
        
        child.unref();
        console.log(`  🚀 重启服务PID: ${child.pid}`);
        
        // 等待5秒让服务启动
        await new Promise(r => setTimeout(r, 5000));
        
        // 检查服务是否成功启动
        const isRunning = await isServiceAvailable();
        if (isRunning) {
            console.log('  ✅ 服务重启成功');
            failureCount = 0;
            return true;
        } else {
            throw new Error('服务未响应');
        }
    } catch (e) {
        console.log(`  ❌ 重启失败: ${e.message}`);
        failureCount++;
        if (failureCount >= MAX_FAILURES) {
            serviceDisabled = true;
            console.log(`  🚫 连续${MAX_FAILURES}次失败，情绪服务已禁用`);
        }
        return false;
    }
}

// 初始化Sub-agent服务（在主程序启动时调用）- 使用spawn更可靠
async function initSubAgentService() {
    console.log('🔧 初始化Sub-agent服务...');
    
    // 检查服务是否已在运行（3秒超时）
    const isRunning = await isServiceAvailable();
    if (isRunning) {
        console.log('  ✅ Sub-agent服务已在运行');
        return true;
    }
    
    console.log('  ⏳ Sub-agent服务未运行，尝试启动...');
    
    try {
        // 使用spawn启动服务，更可靠
        const child = spawn('node', ['market-sentiment-service.js'], {
            cwd: '/root/.openclaw/workspace/okx_data',
            detached: true,
            stdio: 'ignore'
        });
        
        child.unref(); // 让子进程独立运行
        
        console.log(`  🚀 服务已启动，PID: ${child.pid}`);
        
        // 等待服务启动（最多等待15秒）
        console.log('  ⏳ 等待服务就绪...');
        let attempts = 0;
        const maxAttempts = 15;
        while (attempts < maxAttempts) {
            await new Promise(r => setTimeout(r, 1000)); // 等待1秒
            const isNowRunning = await isServiceAvailable();
            if (isNowRunning) {
                console.log('  ✅ Sub-agent服务启动成功');
                return true;
            }
            attempts++;
            if (attempts % 5 === 0) {
                console.log(`    ...等待中 (${attempts}/${maxAttempts})`);
            }
        }
        
        console.log('  ⚠️ 服务启动中，继续执行交易检查...');
        return true;
    } catch (e) {
        console.log(`  ⏭️ 启动失败: ${e.message}，继续执行交易检查`);
        return false;
    }
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

// 获取CoinGecko数据（带自动重启）
async function getCoinGeckoData(coin) {
    if (serviceDisabled) {
        return null;
    }
    
    try {
        const response = await httpGet(`/coingecko?coin=${coin}`);
        failureCount = 0; // 成功则重置
        return response.data || null;
    } catch (e) {
        console.log(`  ⚠️ CoinGecko服务不可用`);
        // 只尝试重启一次，不重试获取数据
        await restartService();
        return null;
    }
}

// 获取RSS新闻情绪（带自动重启）
async function getCoinNewsSentiment(coin) {
    if (serviceDisabled) {
        return null;
    }
    
    try {
        const response = await httpGet(`/rss?coin=${coin}`);
        failureCount = 0;
        return response.sentiment || null;
    } catch (e) {
        console.log(`  ⚠️ RSS服务不可用`);
        await restartService();
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

// 重置重启标志（在每次交易检查开始时调用）
function resetRestartFlag() {
    restartAttempted = false;
    // 注意：不清除serviceDisabled，需要手动重置或重启程序
}

module.exports = {
    isServiceAvailable,
    getCoinGeckoData,
    getCoinNewsSentiment,
    getCombinedSentiment,
    printCoinGeckoReport,
    printNewsReport,
    resetRestartFlag,
    initSubAgentService
};
