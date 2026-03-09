// ============================================
// Agent 协调器 - Agent Coordinator
// 协调通知Agent和交易Agent的工作
// 可以分别调用两个Agent，也可以组合调用
// ============================================

const { runNotificationAgent, getTradingSignals } = require('./notification-agent.js');
const { runTradingAgent } = require('./trading-agent.js');

// ============================================
// 运行完整流程（通知 + 交易）
// ============================================
async function runFullWorkflow() {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║  🤖 Agent 协调器 - 完整流程                                ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    
    // 步骤1: 运行通知Agent获取实时数据
    console.log('📢 步骤1: 运行通知Agent获取实时数据...\n');
    const report = await runNotificationAgent();
    
    if (!report) {
        console.error('❌ 通知Agent运行失败，终止流程');
        return;
    }
    
    // 步骤2: 检查是否有交易信号
    const signals = report.recommendations || [];
    
    if (signals.length === 0) {
        console.log('📭 没有交易信号，流程结束\n');
        return;
    }
    
    // 步骤3: 运行交易Agent执行交易
    console.log('🔴 步骤2: 运行交易Agent执行交易...\n');
    await runTradingAgent();
    
    console.log('✅ 完整流程执行完毕\n');
}

// ============================================
// 仅运行通知（获取数据，不交易）
// ============================================
async function runNotificationOnly() {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║  📢 仅运行通知Agent（获取实时数据）                        ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    
    await runNotificationAgent();
    
    console.log('💡 如需执行交易，请运行:');
    console.log('   node trading-agent.js --execute\n');
}

// ============================================
// 仅运行交易（执行已有信号）
// ============================================
async function runTradingOnly() {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║  🔴 仅运行交易Agent（执行已有信号）                        ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    
    await runTradingAgent({ execute: true });
}

// ============================================
// 显示帮助信息
// ============================================
function showHelp() {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║  🤖 Agent 协调器 - 使用说明                                ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log('║                                                            ║');
    console.log('║  命令格式: node coordinator.js [选项]                      ║');
    console.log('║                                                            ║');
    console.log('║  选项:                                                     ║');
    console.log('║    --full          运行完整流程（通知 + 交易）            ║');
    console.log('║    --notify        仅运行通知Agent（获取数据）            ║');
    console.log('║    --trade         仅运行交易Agent（执行信号）            ║');
    console.log('║    --help          显示此帮助信息                         ║');
    console.log('║                                                            ║');
    console.log('║  示例:                                                     ║');
    console.log('║    node coordinator.js --full                             ║');
    console.log('║    node coordinator.js --notify                           ║');
    console.log('║    node coordinator.js --trade                            ║');
    console.log('║                                                            ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log('║  Agent架构:                                                ║');
    console.log('║    1. 通知Agent (notification-agent.js)                    ║');
    console.log('║       - 获取实时数据                                       ║');
    console.log('║       - 分析市场机会                                       ║');
    console.log('║       - 生成交易信号                                       ║');
    console.log('║                                                            ║');
    console.log('║    2. 交易Agent (trading-agent.js)                         ║');
    console.log('║       - 读取交易信号                                       ║');
    console.log('║       - 执行买卖操作                                       ║');
    console.log('║       - 记录交易日志                                       ║');
    console.log('║                                                            ║');
    console.log('║    3. 数据提醒Agent (data-reminder-agent.js)               ║');
    console.log('║       - 提醒获取最新数据                                   ║');
    console.log('║       - 记录报告时间戳                                     ║');
    console.log('║                                                            ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
}

// ============================================
// 主函数
// ============================================
async function main() {
    const args = process.argv.slice(2);
    
    if (args.includes('--help') || args.includes('-h')) {
        showHelp();
    } else if (args.includes('--full') || args.includes('-f')) {
        await runFullWorkflow();
    } else if (args.includes('--notify') || args.includes('-n')) {
        await runNotificationOnly();
    } else if (args.includes('--trade') || args.includes('-t')) {
        await runTradingOnly();
    } else {
        // 默认运行完整流程
        await runFullWorkflow();
    }
}

// 运行主函数
main().catch(console.error);
