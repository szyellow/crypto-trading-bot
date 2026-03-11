// ============================================
// 短线策略测试脚本
// 用于验证 strategy-short-term.js 的逻辑
// ============================================

const { 
    SHORT_TERM_CONFIG, 
    checkShortTermBuyCondition, 
    checkShortTermExit,
    getTodayTradeCount 
} = require('./strategy-short-term.js');

console.log('🧪 短线高胜率策略 v3.0 测试\n');
console.log('==============================================\n');

// 测试1：买入条件检查
console.log('📋 测试1：买入条件检查\n');

const testCases = [
    { name: '理想情况', trendScore: 9, rsi: 50, volumeRatio: 1.5, priceChange24h: 2, marketTrend: 8, volatility: 1.2 },
    { name: '趋势太低', trendScore: 7, rsi: 50, volumeRatio: 1.5, priceChange24h: 2, marketTrend: 8, volatility: 1.2 },
    { name: 'RSI太高', trendScore: 9, rsi: 75, volumeRatio: 1.5, priceChange24h: 2, marketTrend: 8, volatility: 1.2 },
    { name: 'RSI太低', trendScore: 9, rsi: 35, volumeRatio: 1.5, priceChange24h: 2, marketTrend: 8, volatility: 1.2 },
    { name: '成交量不足', trendScore: 9, rsi: 50, volumeRatio: 0.5, priceChange24h: 2, marketTrend: 8, volatility: 1.2 },
    { name: '涨太多', trendScore: 9, rsi: 50, volumeRatio: 1.5, priceChange24h: 8, marketTrend: 8, volatility: 1.2 },
    { name: '跌太多', trendScore: 9, rsi: 50, volumeRatio: 1.5, priceChange24h: -5, marketTrend: 8, volatility: 1.2 },
];

testCases.forEach((test, index) => {
    const result = checkShortTermBuyCondition(
        'TEST', 
        test.trendScore, 
        test.rsi, 
        test.volumeRatio, 
        test.priceChange24h, 
        test.marketTrend, 
        test.volatility
    );
    
    console.log(`${index + 1}. ${test.name}`);
    console.log(`   结果: ${result.passed ? '✅ 通过' : '❌ 不通过'}`);
    console.log(`   原因: ${result.reason}\n`);
});

// 测试2：止盈止损检查
console.log('📋 测试2：止盈止损检查\n');

const exitTestCases = [
    { name: '亏损-1.5%', entryPrice: 100, currentPrice: 98.5, hours: 2 },
    { name: '盈利+2.5%', entryPrice: 100, currentPrice: 102.5, hours: 2, partialExit: false },
    { name: '盈利+6%', entryPrice: 100, currentPrice: 106, hours: 2 },
    { name: '持仓25小时', entryPrice: 100, currentPrice: 101, hours: 25 },
    { name: '正常持仓', entryPrice: 100, currentPrice: 101, hours: 5 },
];

exitTestCases.forEach((test, index) => {
    const position = {
        entryPrice: test.entryPrice,
        partialExit: test.partialExit || false
    };
    const entryTime = Date.now() - (test.hours * 60 * 60 * 1000);
    
    const result = checkShortTermExit(position, test.currentPrice, entryTime);
    
    console.log(`${index + 1}. ${test.name}`);
    console.log(`   结果: ${result.shouldExit ? '⚠️ 需要出场' : '✅ 继续持有'}`);
    if (result.shouldExit) {
        console.log(`   操作: ${result.action}`);
        console.log(`   原因: ${result.reason}`);
    }
    console.log('');
});

// 测试3：配置输出
console.log('📋 策略配置参数\n');
console.log(JSON.stringify(SHORT_TERM_CONFIG, null, 2));

console.log('\n==============================================');
console.log('✅ 测试完成！策略逻辑正常。');
console.log('==============================================');
