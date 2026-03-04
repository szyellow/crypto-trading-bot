// ============================================
// 交易数据统计模块 - trade-stats.js
// 用于分析交易表现、生成报告
// ============================================

const fs = require('fs');

class TradeStats {
    constructor() {
        this.tradeLogFile = './ai_trade_log.json';
        this.statsFile = './trade_stats.json';
        this.historyFile = './trade_history.json';
    }

    // 加载交易日志
    loadTradeLog() {
        try {
            if (fs.existsSync(this.tradeLogFile)) {
                return JSON.parse(fs.readFileSync(this.tradeLogFile, 'utf8'));
            }
        } catch (e) {
            console.error('加载交易日志失败:', e.message);
        }
        return { trades: [], dailyVolume: 0, dailyTradeCount: 0, lastBuyTime: {} };
    }

    // 计算交易统计
    calculateStats() {
        const tradeLog = this.loadTradeLog();
        const trades = tradeLog.trades || [];
        
        if (trades.length === 0) {
            return null;
        }

        // 1. 基础统计
        const totalTrades = trades.length;
        const buyTrades = trades.filter(t => t.action === 'buy');
        const sellTrades = trades.filter(t => t.action === 'sell');
        
        // 2. 计算盈亏 - 区分止盈卖出和止损卖出
        let totalProfit = 0;
        let totalLoss = 0;
        let profitCount = 0;
        let lossCount = 0;
        let takeProfitSells = 0;  // 止盈卖出次数
        let stopLossSells = 0;    // 止损卖出次数
        
        sellTrades.forEach(t => {
            // 从 reason 中解析盈亏
            if (t.reason) {
                if (t.reason.includes('止盈') || t.reason.includes('盈利')) {
                    const profitMatch = t.reason.match(/盈利([\d.]+)%/);
                    if (profitMatch) {
                        const profit = parseFloat(profitMatch[1]);
                        totalProfit += profit;
                        profitCount++;
                    } else {
                        totalProfit += 2; // 默认2%
                        profitCount++;
                    }
                    takeProfitSells++;  // 计数止盈卖出
                } else if (t.reason.includes('止损') || t.reason.includes('亏损')) {
                    const lossMatch = t.reason.match(/亏损([\d.]+)%/);
                    if (lossMatch) {
                        const loss = parseFloat(lossMatch[1]);
                        totalLoss += Math.abs(loss);
                        lossCount++;
                    } else {
                        totalLoss += 1.5; // 默认1.5%
                        lossCount++;
                    }
                    stopLossSells++;    // 计数止损卖出
                }
            }
        });

        // 3. 计算胜率
        const winRate = sellTrades.length > 0 ? (profitCount / sellTrades.length * 100) : 0;
        
        // 4. 计算平均盈亏
        const avgProfit = profitCount > 0 ? (totalProfit / profitCount) : 0;
        const avgLoss = lossCount > 0 ? (totalLoss / lossCount) : 0;
        const profitLossRatio = avgLoss > 0 ? (avgProfit / avgLoss) : 0;

        // 5. 按币种统计
        const coinStats = {};
        trades.forEach(t => {
            if (!coinStats[t.coin]) {
                coinStats[t.coin] = { buys: 0, sells: 0, profit: 0, loss: 0 };
            }
            if (t.action === 'buy') {
                coinStats[t.coin].buys++;
            } else {
                coinStats[t.coin].sells++;
                if (t.reason && (t.reason.includes('止盈') || t.reason.includes('盈利'))) {
                    coinStats[t.coin].profit++;
                } else if (t.reason && (t.reason.includes('止损') || t.reason.includes('亏损'))) {
                    coinStats[t.coin].loss++;
                }
            }
        });

        // 6. 计算今日数据
        const today = new Date().toISOString().split('T')[0];
        const todayTrades = trades.filter(t => t.time.startsWith(today));
        const todayBuy = todayTrades.filter(t => t.action === 'buy').length;
        const todaySell = todayTrades.filter(t => t.action === 'sell').length;
        const todayVolume = todayTrades
            .filter(t => t.action === 'buy')
            .reduce((sum, t) => sum + (t.price * t.amount), 0);

        return {
            summary: {
                totalTrades,
                buyCount: buyTrades.length,
                sellCount: sellTrades.length,
                takeProfitSells,    // 止盈卖出次数
                stopLossSells,      // 止损卖出次数
                winRate: winRate.toFixed(2),
                avgProfit: avgProfit.toFixed(2),
                avgLoss: avgLoss.toFixed(2),
                profitLossRatio: profitLossRatio.toFixed(2),
                totalProfit: totalProfit.toFixed(2),
                totalLoss: totalLoss.toFixed(2),
                netProfit: (totalProfit - totalLoss).toFixed(2)
            },
            coinStats,
            today: {
                date: today,
                trades: todayTrades.length,
                buys: todayBuy,
                sells: todaySell,
                volume: todayVolume.toFixed(2)
            },
            lastUpdated: new Date().toISOString()
        };
    }

    // 生成统计报告
    generateReport() {
        const stats = this.calculateStats();
        if (!stats) {
            return '暂无交易数据';
        }

        const { summary, coinStats, today } = stats;

        let report = '\n📊 交易统计报告\n';
        report += '==================\n\n';

        // 总体统计
        report += '📈 总体表现\n';
        report += `  总交易次数: ${summary.totalTrades}\n`;
        report += `  买入次数: ${summary.buyCount}\n`;
        report += `  卖出次数: ${summary.sellCount} (止盈${summary.takeProfitSells}/止损${summary.stopLossSells})\n`;
        report += `  胜率: ${summary.winRate}%\n`;
        report += `  平均盈利: +${summary.avgProfit}%\n`;
        report += `  平均亏损: -${summary.avgLoss}%\n`;
        report += `  盈亏比: ${summary.profitLossRatio}\n`;
        report += `  总盈利: +${summary.totalProfit}%\n`;
        report += `  总亏损: -${summary.totalLoss}%\n`;
        report += `  净盈亏: ${summary.netProfit > 0 ? '+' : ''}${summary.netProfit}%\n\n`;

        // 今日统计
        report += '📅 今日交易\n';
        report += `  日期: ${today.date}\n`;
        report += `  交易次数: ${today.trades}\n`;
        report += `  买入: ${today.buys} 次\n`;
        report += `  卖出: ${today.sells} 次\n`;
        report += `  买入金额: $${today.volume}\n\n`;

        // 币种统计
        report += '💰 币种表现\n';
        Object.entries(coinStats).forEach(([coin, stat]) => {
            const coinWinRate = stat.sells > 0 ? (stat.profit / stat.sells * 100).toFixed(1) : 0;
            report += `  ${coin}: 买${stat.buys}/卖${stat.sells}, 胜${stat.profit}/负${stat.loss} (${coinWinRate}%)\n`;
        });

        report += '\n==================\n';

        // 保存统计结果
        this.saveStats(stats);

        return report;
    }

    // 保存统计数据
    saveStats(stats) {
        try {
            fs.writeFileSync(this.statsFile, JSON.stringify(stats, null, 2));
        } catch (e) {
            console.error('保存统计数据失败:', e.message);
        }
    }

    // 获取历史统计
    getHistory() {
        try {
            if (fs.existsSync(this.historyFile)) {
                return JSON.parse(fs.readFileSync(this.historyFile, 'utf8'));
            }
        } catch (e) {
            console.error('加载历史统计失败:', e.message);
        }
        return [];
    }
}

// 导出模块
module.exports = TradeStats;

// 如果直接运行，生成报告
if (require.main === module) {
    const stats = new TradeStats();
    console.log(stats.generateReport());
}