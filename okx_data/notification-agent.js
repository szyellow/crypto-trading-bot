// ============================================
// 通知 Agent - Notification Agent
// 负责实时数据获取、分析和报告生成
// 不执行实际交易，只生成交易建议
// ============================================

const fs = require('fs');
const { request } = require('./okx-api.js');

// ============================================
// 导入市场情绪数据客户端
// ============================================
const {
    isServiceAvailable,
    getCoinGeckoData,
    getCoinNewsSentiment,
    printCoinGeckoReport,
    printNewsReport,
    initSubAgentService
} = require('./sentiment-client.js');

// ============================================
// 导入数据提醒 Sub-Agent
// ============================================
const {
    recordReportTimestamp
} = require('./data-reminder-agent.js');

// ============================================
// 配置文件
// ============================================
const NOTIFICATION_CONFIG_FILE = './notification-agent-config.json';
const TRADING_SIGNALS_FILE = './trading-signals.json';

// 默认配置
const DEFAULT_CONFIG = {
    enabled: true,
    checkInterval: 5 * 60 * 1000, // 5分钟检查一次
    lastCheckTime: null,
    reportCount: 0,
    createdAt: new Date().toISOString()
};

// 加载配置
function loadConfig() {
    try {
        if (fs.existsSync(NOTIFICATION_CONFIG_FILE)) {
            return JSON.parse(fs.readFileSync(NOTIFICATION_CONFIG_FILE, 'utf8'));
        }
    } catch (e) {
        console.error('加载通知Agent配置失败:', e.message);
    }
    return { ...DEFAULT_CONFIG };
}

// 保存配置
function saveConfig(config) {
    try {
        fs.writeFileSync(NOTIFICATION_CONFIG_FILE, JSON.stringify(config, null, 2));
    } catch (e) {
        console.error('保存通知Agent配置失败:', e.message);
    }
}

// ============================================
// 获取账户数据
// ============================================
async function getAccountData() {
    try {
        const balanceRes = await request('/api/v5/account/balance?ccy=USDT');
        const positionsRes = await request('/api/v5/account/positions');
        
        let totalEquity = 0;
        let availableUSDT = 0;
        
        if (balanceRes.code === '0' && balanceRes.data && balanceRes.data[0]) {
            const details = balanceRes.data[0].details;
            const usdtDetail = details.find(d => d.ccy === 'USDT');
            if (usdtDetail) {
                totalEquity = parseFloat(usdtDetail.eq);
                availableUSDT = parseFloat(usdtDetail.availEq);
            }
        }
        
        const positions = {};
        if (positionsRes.code === '0' && positionsRes.data) {
            positionsRes.data.forEach(pos => {
                if (parseFloat(pos.pos) !== 0) {
                    const coin = pos.instId.split('-')[0];
                    positions[coin] = {
                        amount: Math.abs(parseFloat(pos.pos)),
                        side: parseFloat(pos.pos) > 0 ? 'long' : 'short',
                        avgPrice: parseFloat(pos.avgPx),
                        unrealizedPnl: parseFloat(pos.upl),
                        unrealizedPnlPercent: parseFloat(pos.uplRatio) * 100
                    };
                }
            });
        }
        
        return {
            totalEquity,
            availableUSDT,
            positions,
            timestamp: Date.now()
        };
    } catch (e) {
        console.error('获取账户数据失败:', e.message);
        return null;
    }
}

// ============================================
// 扫描市场机会
// ============================================
async function scanMarketOpportunities() {
    // 这里简化处理，实际应该调用完整的趋势分析
    const opportunities = [];
    
    // 示例：扫描20个活跃币种
    const activeCoins = ['BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'DOGE', 'LINK', 'LTC', 'BNB', 'SUI'];
    
    for (const coin of activeCoins) {
        try {
            // 获取价格数据
            const tickerRes = await request(`/api/v5/market/ticker?instId=${coin}-USDT`);
            if (tickerRes.code === '0' && tickerRes.data && tickerRes.data[0]) {
                const ticker = tickerRes.data[0];
                const price = parseFloat(ticker.last);
                const change24h = parseFloat(ticker.change24h);
                const volume = parseFloat(ticker.vol24h);
                
                // 简单评分（实际应该使用完整的趋势分析）
                let score = 5;
                if (change24h > 5) score += 2;
                else if (change24h > 0) score += 1;
                else if (change24h < -5) score -= 2;
                else if (change24h < 0) score -= 1;
                
                if (score >= 7) {
                    opportunities.push({
                        coin,
                        price,
                        change24h,
                        volume,
                        score,
                        recommendation: score >= 8 ? '强烈建议买入' : '建议买入'
                    });
                }
            }
        } catch (e) {
            // 忽略错误
        }
    }
    
    return opportunities.sort((a, b) => b.score - a.score);
}

// ============================================
// 生成通知报告
// ============================================
function generateNotificationReport(accountData, opportunities, tradingSignals) {
    const now = new Date();
    const report = {
        timestamp: now.toISOString(),
        localTime: now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
        account: accountData,
        opportunities: opportunities,
        tradingSignals: tradingSignals,
        recommendations: []
    };
    
    // 生成交易建议
    if (opportunities.length > 0) {
        opportunities.forEach(opp => {
            if (opp.score >= 8) {
                report.recommendations.push({
                    type: 'BUY',
                    coin: opp.coin,
                    price: opp.price,
                    reason: `趋势评分 ${opp.score}/10，24h涨跌 ${opp.change24h.toFixed(2)}%`,
                    urgency: 'high'
                });
            }
        });
    }
    
    // 检查持仓是否需要卖出
    for (const [coin, pos] of Object.entries(accountData.positions)) {
        if (pos.unrealizedPnlPercent >= 15) {
            report.recommendations.push({
                type: 'SELL',
                coin: coin,
                price: pos.avgPrice * (1 + pos.unrealizedPnlPercent / 100),
                reason: `盈利达到 ${pos.unrealizedPnlPercent.toFixed(2)}%，建议止盈`,
                urgency: 'high'
            });
        } else if (pos.unrealizedPnlPercent <= -2) {
            report.recommendations.push({
                type: 'SELL',
                coin: coin,
                price: pos.avgPrice * (1 + pos.unrealizedPnlPercent / 100),
                reason: `亏损达到 ${Math.abs(pos.unrealizedPnlPercent).toFixed(2)}%，建议止损`,
                urgency: 'high'
            });
        }
    }
    
    return report;
}

// ============================================
// 显示通知报告
// ============================================
function displayNotificationReport(report) {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║  📢 通知 Agent - 实时数据报告                              ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log(`║  报告时间: ${report.localTime}          ║`);
    console.log('╠════════════════════════════════════════════════════════════╣');
    
    // 账户概况
    console.log('║  💼 账户概况                                               ║');
    console.log(`║     总资产: $${report.account.totalEquity.toFixed(2)}                              ║`);
    console.log(`║     可用USDT: $${report.account.availableUSDT.toFixed(2)}                            ║`);
    console.log(`║     持仓数量: ${Object.keys(report.account.positions).length} 个                              ║`);
    console.log('╠════════════════════════════════════════════════════════════╣');
    
    // 持仓详情
    if (Object.keys(report.account.positions).length > 0) {
        console.log('║  📈 持仓详情                                               ║');
        for (const [coin, pos] of Object.entries(report.account.positions)) {
            const pnlEmoji = pos.unrealizedPnl >= 0 ? '🟢' : '🔴';
            console.log(`║     ${coin}: ${pos.unrealizedPnlPercent >= 0 ? '+' : ''}${pos.unrealizedPnlPercent.toFixed(2)}% ${pnlEmoji}                    ║`);
        }
        console.log('╠════════════════════════════════════════════════════════════╣');
    }
    
    // 市场机会
    if (report.opportunities.length > 0) {
        console.log('║  🎯 市场机会                                               ║');
        report.opportunities.slice(0, 5).forEach(opp => {
            console.log(`║     ${opp.coin}: 评分 ${opp.score}/10, 24h ${opp.change24h >= 0 ? '+' : ''}${opp.change24h.toFixed(2)}%          ║`);
        });
        console.log('╠════════════════════════════════════════════════════════════╣');
    }
    
    // 交易建议
    if (report.recommendations.length > 0) {
        console.log('║  ⚡ 交易建议                                               ║');
        report.recommendations.forEach(rec => {
            const actionEmoji = rec.type === 'BUY' ? '🟢 买入' : '🔴 卖出';
            const urgencyEmoji = rec.urgency === 'high' ? '‼️' : '!';
            console.log(`║     ${urgencyEmoji} ${actionEmoji} ${rec.coin} @ $${rec.price.toFixed(4)}         ║`);
            console.log(`║        原因: ${rec.reason.substring(0, 30)}...        ║`);
        });
        console.log('╠════════════════════════════════════════════════════════════╣');
    }
    
    console.log('║  💡 提示: 如需执行交易，请调用交易Agent                    ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
}

// ============================================
// 保存交易信号
// ============================================
function saveTradingSignals(signals) {
    try {
        fs.writeFileSync(TRADING_SIGNALS_FILE, JSON.stringify(signals, null, 2));
        return true;
    } catch (e) {
        console.error('保存交易信号失败:', e.message);
        return false;
    }
}

// ============================================
// 主函数
// ============================================
async function runNotificationAgent() {
    const config = loadConfig();
    
    if (!config.enabled) {
        console.log('📢 通知Agent已禁用');
        return null;
    }
    
    console.log('\n=== 通知Agent启动 ===');
    console.log('⏰ 正在获取实时数据...\n');
    
    // 1. 获取账户数据
    const accountData = await getAccountData();
    if (!accountData) {
        console.error('❌ 获取账户数据失败');
        return null;
    }
    
    // 2. 扫描市场机会
    const opportunities = await scanMarketOpportunities();
    
    // 3. 加载已有的交易信号
    let tradingSignals = [];
    if (fs.existsSync(TRADING_SIGNALS_FILE)) {
        try {
            tradingSignals = JSON.parse(fs.readFileSync(TRADING_SIGNALS_FILE, 'utf8'));
        } catch (e) {
            // 忽略错误
        }
    }
    
    // 4. 生成通知报告
    const report = generateNotificationReport(accountData, opportunities, tradingSignals);
    
    // 5. 显示报告
    displayNotificationReport(report);
    
    // 6. 保存交易建议到信号文件
    if (report.recommendations.length > 0) {
        saveTradingSignals(report.recommendations);
        console.log(`✅ 已保存 ${report.recommendations.length} 个交易信号`);
    }
    
    // 7. 记录报告时间戳
    recordReportTimestamp();
    
    // 8. 更新配置
    config.lastCheckTime = Date.now();
    config.reportCount = (config.reportCount || 0) + 1;
    saveConfig(config);
    
    console.log('=== 通知Agent完成 ===\n');
    
    return report;
}

// ============================================
// 获取最新交易信号
// ============================================
function getTradingSignals() {
    try {
        if (fs.existsSync(TRADING_SIGNALS_FILE)) {
            return JSON.parse(fs.readFileSync(TRADING_SIGNALS_FILE, 'utf8'));
        }
    } catch (e) {
        console.error('获取交易信号失败:', e.message);
    }
    return [];
}

// ============================================
// 清除交易信号
// ============================================
function clearTradingSignals() {
    try {
        if (fs.existsSync(TRADING_SIGNALS_FILE)) {
            fs.unlinkSync(TRADING_SIGNALS_FILE);
        }
        console.log('✅ 交易信号已清除');
        return true;
    } catch (e) {
        console.error('清除交易信号失败:', e.message);
        return false;
    }
}

// ============================================
// 导出模块
// ============================================
module.exports = {
    runNotificationAgent,
    getTradingSignals,
    clearTradingSignals,
    getAccountData,
    scanMarketOpportunities
};

// 如果直接运行此文件
if (require.main === module) {
    runNotificationAgent().catch(console.error);
}
