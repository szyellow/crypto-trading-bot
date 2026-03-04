// 修复止损线bug的脚本
const fs = require('fs');

// 读取evolve_log，找到最后一次正确的止损线
const evolveLog = JSON.parse(fs.readFileSync('ai_evolve_log.json', 'utf8'));

// 找到第一个出现435%的记录之前的记录
let lastCorrectStopLoss = -2.5; // 默认值
for (const entry of evolveLog) {
    const hasWrongStopLoss = entry.adjustments.some(adj => adj.includes('435.00%') || adj.includes('348.00%'));
    if (hasWrongStopLoss) {
        break;
    }
    // 查找是否有止损调整
    const stopLossAdj = entry.adjustments.find(adj => adj.includes('止损'));
    if (stopLossAdj) {
        const match = stopLossAdj.match(/收紧至([-\d.]+)%/);
        if (match) {
            lastCorrectStopLoss = parseFloat(match[1]);
        }
    }
}

console.log(`最后一次正确的止损线: ${lastCorrectStopLoss}%`);

// 重置止损线为正确的值
const correctStopLoss = -2.5; // 使用默认值

console.log(`已将止损线重置为: ${correctStopLoss}%`);
console.log('请在ai_trading_bot.js中手动设置AI_CONFIG.stopLossPercent = -2.5');
