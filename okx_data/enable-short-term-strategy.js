// ============================================
// 策略切换配置文件 - v3.0
// 启用短线高胜率模式
// ============================================

const fs = require('fs');

// 读取当前配置
const configPath = './ai_config.json';
let config = {};

if (fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

// 短线高胜率策略配置
const SHORT_TERM_MODE = {
    // 策略标识
    strategyVersion: '3.0-short-term',
    strategyName: '短线高胜率模式',
    
    // 选股门槛（更严格）
    minTrendScore: 8,           // 趋势评分 >= 8分
    maxTrendScore: 10,          // 趋势评分 <= 10分
    rsiMin: 40,                 // RSI >= 40（避免超卖）
    rsiMax: 60,                 // RSI <= 60（避免超买）
    minVolumeRatio: 1.0,        // 成交量 >= 1.0x
    max24hChange: 5,            // 24h涨跌幅 <= +5%
    min24hChange: -2,           // 24h涨跌幅 >= -2%
    minMarketTrend: 6,          // 大盘趋势 >= 6分
    
    // 仓位管理
    positionSize: 40,           // 单笔金额 $40
    maxPositions: 3,            // 最大持仓3个
    maxPositionPercent: 15,     // 单个币种最大占比15%
    
    // 止盈止损（更严格）
    stopLoss: -1.0,             // 止损 -1%（固定）
    takeProfit1: 2.0,           // 第一止盈 +2%（减仓50%）
    takeProfit2: 5.0,           // 第二止盈 +5%（清仓）
    timeStop: 24,               // 时间止损 24小时
    
    // 交易频率控制
    minTradeInterval: 4,        // 同一币种最小交易间隔4小时
    maxDailyTrades: 3,          // 每日最大交易笔数
    
    // 波动率筛选
    minVolatility: 0.5,         // 最小波动率0.5%
    maxVolatility: 3.0,         // 最大波动率3%（避免剧烈波动）
    
    // 启用标记
    enabled: true,
    startTime: new Date().toISOString()
};

// 保存配置
config.strategyMode = SHORT_TERM_MODE;
fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

console.log('✅ 短线高胜率策略 v3.0 已启用！');
console.log('');
console.log('📋 策略参数：');
console.log(`  选股门槛: 趋势${SHORT_TERM_MODE.minTrendScore}-${SHORT_TERM_MODE.maxTrendScore}分`);
console.log(`  RSI范围: ${SHORT_TERM_MODE.rsiMin}-${SHORT_TERM_MODE.rsiMax}`);
console.log(`  止损: ${SHORT_TERM_MODE.stopLoss}%`);
console.log(`  止盈1: ${SHORT_TERM_MODE.takeProfit1}% (减仓50%)`);
console.log(`  止盈2: ${SHORT_TERM_MODE.takeProfit2}% (清仓)`);
console.log(`  时间止损: ${SHORT_TERM_MODE.timeStop}小时`);
console.log(`  单笔金额: $${SHORT_TERM_MODE.positionSize}`);
console.log(`  最大持仓: ${SHORT_TERM_MODE.maxPositions}个`);
console.log('');
console.log('🚀 下次交易检查时将使用新策略！');
console.log(`⏰ 启用时间: ${SHORT_TERM_MODE.startTime}`);
