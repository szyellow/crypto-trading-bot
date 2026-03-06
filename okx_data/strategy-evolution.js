// ============================================
// AI交易策略自迭代模块 v1.0
// 自动分析、自动调整、自动优化
// ============================================

const fs = require('fs');

const EVOLUTION_CONFIG = {
    minTradesForReview: 10,      // 10笔交易后复盘
    consecutiveLossThreshold: 3,  // 连续3笔亏损触发调整
    winRateHigh: 0.70,           // 高胜率阈值
    winRateLow: 0.40,            // 低胜率阈值
    pauseAfterLosses: 24 * 60 * 60 * 1000, // 连续亏损后暂停24小时
    adjustmentRange: {
        stopLoss: { min: -5, max: -3 },      // 止损范围
        takeProfit: { min: 7, max: 15 },     // 止盈范围
        maxPositions: { min: 3, max: 7 },    // 持仓数量
        tradeSize: { min: 40, max: 100 },      // 单笔金额（与主配置一致）
        sentimentThreshold: { min: 6, max: 8 } // 舆情阈值
    }
};

// 加载进化日志
function loadEvolutionLog() {
    const logPath = 'strategy_evolution.json';
    if (fs.existsSync(logPath)) {
        return JSON.parse(fs.readFileSync(logPath, 'utf8'));
    }
    return {
        version: '2.1.0',
        iterations: [],
        currentParams: {
            stopLoss: -5,
            takeProfit: 10,
            maxPositions: 3,
            tradeSize: 60,
            sentimentThreshold: 7
        },
        performance: {
            totalTrades: 0,
            wins: 0,
            losses: 0,
            consecutiveLosses: 0,
            lastTradeTime: null,
            paused: false,
            pauseUntil: null
        }
    };
}

// 保存进化日志
function saveEvolutionLog(log) {
    fs.writeFileSync('strategy_evolution.json', JSON.stringify(log, null, 2));
}

// 分析交易表现
function analyzePerformance(trades) {
    if (trades.length === 0) return null;
    
    const wins = trades.filter(t => {
        if (t.action === 'sell' && t.pnl) return t.pnl > 0;
        return false;
    }).length;
    
    const losses = trades.filter(t => {
        if (t.action === 'sell' && t.pnl) return t.pnl < 0;
        return false;
    }).length;
    
    const winRate = (wins + losses) > 0 ? wins / (wins + losses) : 0;
    
    const profits = trades
        .filter(t => t.action === 'sell' && t.pnl > 0)
        .map(t => t.pnl);
    const avgProfit = profits.length > 0 ? profits.reduce((a, b) => a + b, 0) / profits.length : 0;
    
    const lossList = trades
        .filter(t => t.action === 'sell' && t.pnl < 0)
        .map(t => Math.abs(t.pnl));
    const avgLoss = lossList.length > 0 ? lossList.reduce((a, b) => a + b, 0) / lossList.length : 0;
    
    // 计算连续亏损
    let consecutiveLosses = 0;
    for (let i = trades.length - 1; i >= 0; i--) {
        const t = trades[i];
        if (t.action === 'sell' && t.pnl < 0) {
            consecutiveLosses++;
        } else if (t.action === 'sell' && t.pnl > 0) {
            break;
        }
    }
    
    return {
        totalTrades: trades.length,
        wins,
        losses,
        winRate,
        avgProfit,
        avgLoss,
        consecutiveLosses,
        profitFactor: avgLoss > 0 ? avgProfit / avgLoss : 0
    };
}

// 生成策略调整建议
function generateAdjustments(performance, currentParams) {
    const adjustments = [];
    const newParams = { ...currentParams };
    
    // 高胜率情况 - 放宽策略
    if (performance.winRate >= EVOLUTION_CONFIG.winRateHigh) {
        adjustments.push(`胜率优秀(${Math.round(performance.winRate * 100)}%)，放宽止盈`);
        newParams.takeProfit = Math.min(
            EVOLUTION_CONFIG.adjustmentRange.takeProfit.max,
            currentParams.takeProfit + 2
        );
        newParams.maxPositions = Math.min(
            EVOLUTION_CONFIG.adjustmentRange.maxPositions.max,
            currentParams.maxPositions + 1
        );
    }
    
    // 低胜率情况 - 收紧策略
    if (performance.winRate <= EVOLUTION_CONFIG.winRateLow && performance.totalTrades >= 5) {
        adjustments.push(`胜率偏低(${Math.round(performance.winRate * 100)}%)，收紧止损`);
        // 修复：止损值是负数，"收紧"意味着更容易触发止损
        // 正确的收紧：绝对值变小（-2.5 → -2.0），这样更容易触发止损
        newParams.stopLoss = Math.min(
            EVOLUTION_CONFIG.adjustmentRange.stopLoss.max, // -3 (更接近0，更严格)
            currentParams.stopLoss + 0.5 // 向-3靠近，绝对值变小
        );
        newParams.tradeSize = Math.max(
            EVOLUTION_CONFIG.adjustmentRange.tradeSize.min,
            currentParams.tradeSize - 2
        );
        newParams.sentimentThreshold = Math.min(
            EVOLUTION_CONFIG.adjustmentRange.sentimentThreshold.max,
            currentParams.sentimentThreshold + 1
        );
    }
    
    // 连续亏损处理
    if (performance.consecutiveLosses >= EVOLUTION_CONFIG.consecutiveLossThreshold) {
        adjustments.push(`连续亏损${performance.consecutiveLosses}笔，暂停交易并收紧策略`);
        newParams.stopLoss = EVOLUTION_CONFIG.adjustmentRange.stopLoss.max; // -3 (最严格，最接近0)
        newParams.tradeSize = EVOLUTION_CONFIG.adjustmentRange.tradeSize.min; // 40
        newParams.sentimentThreshold = EVOLUTION_CONFIG.adjustmentRange.sentimentThreshold.max; // 8
    }
    
    // 盈亏比优化
    if (performance.profitFactor < 1.5 && performance.totalTrades >= 5) {
        adjustments.push(`盈亏比偏低(${performance.profitFactor.toFixed(2)})，优化止盈止损比`);
        newParams.takeProfit = Math.min(
            EVOLUTION_CONFIG.adjustmentRange.takeProfit.max,
            currentParams.takeProfit + 1
        );
    }
    
    return { adjustments, newParams };
}

// 主迭代函数
async function evolveStrategy(tradeLog) {
    console.log('\n=== 策略自迭代分析 ===');
    
    const evolution = loadEvolutionLog();
    
    // 检查是否处于暂停期
    if (evolution.performance.paused && evolution.performance.pauseUntil) {
        if (Date.now() < evolution.performance.pauseUntil) {
            const remaining = Math.ceil((evolution.performance.pauseUntil - Date.now()) / 1000 / 60);
            console.log(`⏸️ 策略暂停中，还剩 ${remaining} 分钟`);
            return { paused: true, remaining };
        } else {
            console.log('✅ 暂停期结束，恢复交易');
            evolution.performance.paused = false;
            evolution.performance.pauseUntil = null;
        }
    }
    
    // 分析最近交易
    const recentTrades = tradeLog.trades.slice(-20); // 分析最近20笔
    const performance = analyzePerformance(recentTrades);
    
    if (!performance || performance.totalTrades < 3) {
        console.log('📊 交易数据不足，跳过迭代分析');
        return { paused: false, evolution: evolution.currentParams };
    }
    
    console.log(`\n📈 最近${performance.totalTrades}笔交易表现:`);
    console.log(`  胜率: ${Math.round(performance.winRate * 100)}% (${performance.wins}胜/${performance.losses}负)`);
    console.log(`  平均盈利: +${performance.avgProfit.toFixed(2)}%`);
    console.log(`  平均亏损: -${performance.avgLoss.toFixed(2)}%`);
    console.log(`  盈亏比: ${performance.profitFactor.toFixed(2)}`);
    console.log(`  连续亏损: ${performance.consecutiveLosses}笔`);
    
    // 生成调整建议
    const { adjustments, newParams } = generateAdjustments(performance, evolution.currentParams);
    
    // 处理连续亏损暂停
    if (performance.consecutiveLosses >= EVOLUTION_CONFIG.consecutiveLossThreshold) {
        evolution.performance.paused = true;
        evolution.performance.pauseUntil = Date.now() + EVOLUTION_CONFIG.pauseAfterLosses;
        console.log(`\n⏸️ 触发暂停机制：连续${performance.consecutiveLosses}笔亏损`);
        console.log(`   暂停24小时，期间只监控不交易`);
    }
    
    // 如果有调整，记录迭代
    if (adjustments.length > 0) {
        const iteration = {
            version: `2.1.${evolution.iterations.length + 1}`,
            date: new Date().toISOString(),
            trigger: performance.totalTrades >= EVOLUTION_CONFIG.minTradesForReview 
                ? '10笔交易完成复盘' 
                : `${performance.consecutiveLosses}笔连续亏损`,
            changes: adjustments,
            paramsBefore: evolution.currentParams,
            paramsAfter: newParams,
            performance: {
                winRate: performance.winRate,
                avgProfit: performance.avgProfit,
                avgLoss: performance.avgLoss,
                profitFactor: performance.profitFactor
            }
        };
        
        evolution.iterations.push(iteration);
        evolution.currentParams = newParams;
        
        console.log('\n🔄 策略自动调整:');
        adjustments.forEach(a => console.log(`  • ${a}`));
        console.log('\n📋 参数更新:');
        console.log(`  止损: ${evolution.currentParams.stopLoss}% → ${newParams.stopLoss}%`);
        console.log(`  止盈: ${evolution.currentParams.takeProfit}% → ${newParams.takeProfit}%`);
        console.log(`  最大持仓: ${evolution.currentParams.maxPositions} → ${newParams.maxPositions}`);
        console.log(`  单笔金额: $${evolution.currentParams.tradeSize} → $${newParams.tradeSize}`);
        console.log(`  舆情阈值: ${evolution.currentParams.sentimentThreshold} → ${newParams.sentimentThreshold}`);
    } else {
        console.log('\n✅ 当前策略表现良好，无需调整');
    }
    
    // 更新性能统计
    evolution.performance.totalTrades = performance.totalTrades;
    evolution.performance.wins = performance.wins;
    evolution.performance.losses = performance.losses;
    evolution.performance.consecutiveLosses = performance.consecutiveLosses;
    evolution.performance.lastTradeTime = Date.now();
    
    saveEvolutionLog(evolution);
    
    return {
        paused: evolution.performance.paused,
        evolution: evolution.currentParams,
        performance
    };
}

module.exports = { evolveStrategy, loadEvolutionLog };

// 如果直接运行，测试
if (require.main === module) {
    const mockTradeLog = { trades: [] };
    evolveStrategy(mockTradeLog).then(result => {
        console.log('\n迭代结果:', result);
    });
}
