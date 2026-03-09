// ============================================
// 交易 Agent - Trading Agent
// 专门负责执行买卖交易操作
// 接收来自通知Agent的交易信号并执行
// ============================================

const fs = require('fs');
const { request } = require('./okx-api.js');

// ============================================
// 配置文件
// ============================================
const TRADING_CONFIG_FILE = './trading-agent-config.json';
const TRADING_SIGNALS_FILE = './trading-signals.json';
const TRADE_LOG_FILE = './ai_trade_log.json';
const PENDING_ORDERS_FILE = './pending-orders.json';

// 默认配置
const DEFAULT_CONFIG = {
    enabled: true,
    autoExecute: false, // 是否自动执行交易（默认手动确认）
    maxTradeAmount: 25, // 最大单笔交易金额
    maxDailyTrades: 10, // 每日最大交易次数
    todayTradeCount: 0,
    lastTradeDate: null,
    createdAt: new Date().toISOString()
};

// 加载配置
function loadConfig() {
    try {
        if (fs.existsSync(TRADING_CONFIG_FILE)) {
            return JSON.parse(fs.readFileSync(TRADING_CONFIG_FILE, 'utf8'));
        }
    } catch (e) {
        console.error('加载交易Agent配置失败:', e.message);
    }
    return { ...DEFAULT_CONFIG };
}

// 保存配置
function saveConfig(config) {
    try {
        fs.writeFileSync(TRADING_CONFIG_FILE, JSON.stringify(config, null, 2));
    } catch (e) {
        console.error('保存交易Agent配置失败:', e.message);
    }
}

// ============================================
// 加载交易信号
// ============================================
function loadTradingSignals() {
    try {
        if (fs.existsSync(TRADING_SIGNALS_FILE)) {
            return JSON.parse(fs.readFileSync(TRADING_SIGNALS_FILE, 'utf8'));
        }
    } catch (e) {
        console.error('加载交易信号失败:', e.message);
    }
    return [];
}

// ============================================
// 加载交易日志
// ============================================
function loadTradeLog() {
    try {
        if (fs.existsSync(TRADE_LOG_FILE)) {
            return JSON.parse(fs.readFileSync(TRADE_LOG_FILE, 'utf8'));
        }
    } catch (e) {
        console.error('加载交易日志失败:', e.message);
    }
    return { trades: [] };
}

// ============================================
// 保存交易日志
// ============================================
function saveTradeLog(tradeLog) {
    try {
        fs.writeFileSync(TRADE_LOG_FILE, JSON.stringify(tradeLog, null, 2));
    } catch (e) {
        console.error('保存交易日志失败:', e.message);
    }
}

// ============================================
// 获取账户余额
// ============================================
async function getAccountBalance() {
    try {
        const response = await request('/api/v5/account/balance?ccy=USDT');
        if (response.code === '0' && response.data && response.data[0]) {
            const details = response.data[0].details;
            const usdtDetail = details.find(d => d.ccy === 'USDT');
            if (usdtDetail) {
                return {
                    total: parseFloat(usdtDetail.eq),
                    available: parseFloat(usdtDetail.availEq)
                };
            }
        }
    } catch (e) {
        console.error('获取账户余额失败:', e.message);
    }
    return null;
}

// ============================================
// 获取当前持仓
// ============================================
async function getCurrentPositions() {
    try {
        const response = await request('/api/v5/account/positions');
        if (response.code === '0' && response.data) {
            const positions = {};
            response.data.forEach(pos => {
                if (parseFloat(pos.pos) !== 0) {
                    const coin = pos.instId.split('-')[0];
                    positions[coin] = {
                        amount: Math.abs(parseFloat(pos.pos)),
                        side: parseFloat(pos.pos) > 0 ? 'long' : 'short',
                        avgPrice: parseFloat(pos.avgPx)
                    };
                }
            });
            return positions;
        }
    } catch (e) {
        console.error('获取当前持仓失败:', e.message);
    }
    return {};
}

// ============================================
// 获取实时价格
// ============================================
async function getCurrentPrice(coin) {
    try {
        const response = await request(`/api/v5/market/ticker?instId=${coin}-USDT`);
        if (response.code === '0' && response.data && response.data[0]) {
            return parseFloat(response.data[0].last);
        }
    } catch (e) {
        console.error(`获取${coin}价格失败:`, e.message);
    }
    return null;
}

// ============================================
// 执行买入
// ============================================
async function executeBuy(coin, amount, reason) {
    console.log(`\n🟢 执行买入: ${coin}`);
    console.log(`   金额: $${amount}`);
    console.log(`   原因: ${reason}`);
    
    try {
        // 获取当前价格
        const price = await getCurrentPrice(coin);
        if (!price) {
            console.error('❌ 无法获取当前价格');
            return { success: false, error: '无法获取价格' };
        }
        
        // 计算数量
        const quantity = amount / price;
        
        // 检查账户余额
        const balance = await getAccountBalance();
        if (!balance || balance.available < amount) {
            console.error('❌ 账户余额不足');
            return { success: false, error: '余额不足' };
        }
        
        // 执行买入订单
        const orderData = {
            instId: `${coin}-USDT`,
            tdMode: 'cash',
            side: 'buy',
            ordType: 'market',
            sz: quantity.toFixed(6)
        };
        
        console.log('   下单参数:', JSON.stringify(orderData));
        
        // 这里调用实际的API（暂时注释掉，避免误操作）
        // const response = await request('/api/v5/trade/order', 'POST', orderData);
        
        console.log('   ⚠️  模拟模式：未实际执行交易');
        console.log(`   模拟买入: ${quantity.toFixed(6)} ${coin} @ $${price}`);
        
        // 记录交易
        const tradeLog = loadTradeLog();
        tradeLog.trades.push({
            time: new Date().toISOString(),
            coin: coin,
            action: 'buy',
            price: price,
            amount: amount,
            quantity: quantity,
            reason: reason,
            status: 'simulated'
        });
        saveTradeLog(tradeLog);
        
        return {
            success: true,
            coin,
            price,
            quantity,
            amount,
            orderId: 'SIMULATED_' + Date.now()
        };
        
    } catch (e) {
        console.error('❌ 买入失败:', e.message);
        return { success: false, error: e.message };
    }
}

// ============================================
// 执行卖出
// ============================================
async function executeSell(coin, reason) {
    console.log(`\n🔴 执行卖出: ${coin}`);
    console.log(`   原因: ${reason}`);
    
    try {
        // 获取当前持仓
        const positions = await getCurrentPositions();
        if (!positions[coin]) {
            console.error('❌ 没有持仓');
            return { success: false, error: '没有持仓' };
        }
        
        const position = positions[coin];
        const price = await getCurrentPrice(coin);
        if (!price) {
            console.error('❌ 无法获取当前价格');
            return { success: false, error: '无法获取价格' };
        }
        
        // 执行卖出订单
        const orderData = {
            instId: `${coin}-USDT`,
            tdMode: 'cash',
            side: 'sell',
            ordType: 'market',
            sz: position.amount.toFixed(6)
        };
        
        console.log('   下单参数:', JSON.stringify(orderData));
        
        // 这里调用实际的API（暂时注释掉，避免误操作）
        // const response = await request('/api/v5/trade/order', 'POST', orderData);
        
        console.log('   ⚠️  模拟模式：未实际执行交易');
        console.log(`   模拟卖出: ${position.amount.toFixed(6)} ${coin} @ $${price}`);
        
        // 记录交易
        const tradeLog = loadTradeLog();
        tradeLog.trades.push({
            time: new Date().toISOString(),
            coin: coin,
            action: 'sell',
            price: price,
            quantity: position.amount,
            amount: position.amount * price,
            reason: reason,
            status: 'simulated'
        });
        saveTradeLog(tradeLog);
        
        return {
            success: true,
            coin,
            price,
            quantity: position.amount,
            amount: position.amount * price,
            orderId: 'SIMULATED_' + Date.now()
        };
        
    } catch (e) {
        console.error('❌ 卖出失败:', e.message);
        return { success: false, error: e.message };
    }
}

// ============================================
// 显示待处理的交易信号
// ============================================
function displayPendingSignals(signals) {
    if (signals.length === 0) {
        console.log('\n📭 没有待处理的交易信号');
        return;
    }
    
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║  📋 待处理的交易信号                                       ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    
    signals.forEach((signal, index) => {
        const actionEmoji = signal.type === 'BUY' ? '🟢 买入' : '🔴 卖出';
        const urgencyEmoji = signal.urgency === 'high' ? '‼️' : '!';
        console.log(`║  ${index + 1}. ${urgencyEmoji} ${actionEmoji} ${signal.coin}                      ║`);
        console.log(`║     价格: $${signal.price.toFixed(4)}                              ║`);
        console.log(`║     原因: ${signal.reason.substring(0, 35)}...        ║`);
        console.log('╠════════════════════════════════════════════════════════════╣');
    });
    
    console.log('║  💡 使用以下命令执行交易:                                  ║');
    console.log('║     node trading-agent.js --execute-all                    ║');
    console.log('║     node trading-agent.js --execute 1                      ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
}

// ============================================
// 主函数
// ============================================
async function runTradingAgent(options = {}) {
    const config = loadConfig();
    
    if (!config.enabled) {
        console.log('🔴 交易Agent已禁用');
        return;
    }
    
    // 检查是否需要重置每日计数
    const today = new Date().toISOString().split('T')[0];
    if (config.lastTradeDate !== today) {
        config.todayTradeCount = 0;
        config.lastTradeDate = today;
        saveConfig(config);
    }
    
    console.log('\n=== 交易Agent启动 ===');
    console.log(`📊 今日已执行: ${config.todayTradeCount}/${config.maxDailyTrades} 笔交易`);
    console.log(`🤖 自动执行模式: ${config.autoExecute ? '开启' : '关闭'}\n`);
    
    // 加载交易信号
    const signals = loadTradingSignals();
    
    if (signals.length === 0) {
        console.log('📭 没有待处理的交易信号');
        console.log('💡 请先运行通知Agent生成交易信号');
        console.log('   命令: node notification-agent.js\n');
        return;
    }
    
    // 显示待处理信号
    displayPendingSignals(signals);
    
    // 如果不是自动执行模式，等待用户确认
    if (!config.autoExecute && !options.execute) {
        console.log('⏸️  手动模式：等待用户确认');
        console.log('💡 请使用 --execute 参数执行交易\n');
        return;
    }
    
    // 执行交易
    const results = [];
    for (const signal of signals) {
        if (config.todayTradeCount >= config.maxDailyTrades) {
            console.log('⚠️  已达到每日最大交易次数限制');
            break;
        }
        
        let result;
        if (signal.type === 'BUY') {
            result = await executeBuy(signal.coin, config.maxTradeAmount, signal.reason);
        } else if (signal.type === 'SELL') {
            result = await executeSell(signal.coin, signal.reason);
        }
        
        if (result) {
            results.push(result);
            if (result.success) {
                config.todayTradeCount++;
            }
        }
    }
    
    // 保存配置
    saveConfig(config);
    
    // 清除已处理的信号
    if (results.length > 0 && results.every(r => r.success)) {
        try {
            if (fs.existsSync(TRADING_SIGNALS_FILE)) {
                fs.unlinkSync(TRADING_SIGNALS_FILE);
                console.log('✅ 已清除已处理的信号');
            }
        } catch (e) {
            console.error('清除信号失败:', e.message);
        }
    }
    
    // 显示执行结果
    console.log('\n=== 交易执行结果 ===');
    console.log(`✅ 成功: ${results.filter(r => r.success).length}`);
    console.log(`❌ 失败: ${results.filter(r => !r.success).length}`);
    console.log(`📊 今日累计: ${config.todayTradeCount}/${config.maxDailyTrades} 笔\n`);
    
    console.log('=== 交易Agent完成 ===\n');
}

// ============================================
// 设置自动执行模式
// ============================================
function setAutoExecute(enabled) {
    const config = loadConfig();
    config.autoExecute = enabled;
    saveConfig(config);
    console.log(`🤖 自动执行模式已${enabled ? '开启' : '关闭'}`);
}

// ============================================
// 导出模块
// ============================================
module.exports = {
    runTradingAgent,
    executeBuy,
    executeSell,
    loadTradingSignals,
    setAutoExecute
};

// 如果直接运行此文件
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.includes('--auto-on')) {
        setAutoExecute(true);
    } else if (args.includes('--auto-off')) {
        setAutoExecute(false);
    } else if (args.includes('--execute') || args.includes('--execute-all')) {
        runTradingAgent({ execute: true }).catch(console.error);
    } else {
        runTradingAgent().catch(console.error);
    }
}
