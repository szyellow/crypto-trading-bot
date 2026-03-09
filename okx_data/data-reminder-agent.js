// ============================================
// 数据提醒 Sub-Agent
// 用于提醒主程序每次报告都需要获取最新数据
// ============================================

const fs = require('fs');
const path = require('path');

// 配置文件路径
const REMINDER_CONFIG_FILE = './data-reminder-config.json';
const LAST_REPORT_FILE = './last-report-timestamp.json';

// 默认配置
const DEFAULT_CONFIG = {
    enabled: true,
    reminderInterval: 5 * 60 * 1000, // 5分钟提醒一次
    lastReminderTime: null,
    reminderCount: 0,
    createdAt: new Date().toISOString(),
    forceCheckThreshold: 10 * 60 * 1000 // 10分钟强制提醒
};

// 加载配置
function loadConfig() {
    try {
        if (fs.existsSync(REMINDER_CONFIG_FILE)) {
            return JSON.parse(fs.readFileSync(REMINDER_CONFIG_FILE, 'utf8'));
        }
    } catch (e) {
        console.error('加载提醒配置失败:', e.message);
    }
    return { ...DEFAULT_CONFIG };
}

// 保存配置
function saveConfig(config) {
    try {
        fs.writeFileSync(REMINDER_CONFIG_FILE, JSON.stringify(config, null, 2));
    } catch (e) {
        console.error('保存提醒配置失败:', e.message);
    }
}

// 记录报告时间戳
function recordReportTimestamp() {
    try {
        const data = {
            timestamp: Date.now(),
            isoTime: new Date().toISOString(),
            localTime: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
        };
        fs.writeFileSync(LAST_REPORT_FILE, JSON.stringify(data, null, 2));
        return data;
    } catch (e) {
        console.error('记录报告时间戳失败:', e.message);
        return null;
    }
}

// 获取上次报告时间
function getLastReportTime() {
    try {
        if (fs.existsSync(LAST_REPORT_FILE)) {
            return JSON.parse(fs.readFileSync(LAST_REPORT_FILE, 'utf8'));
        }
    } catch (e) {
        console.error('获取上次报告时间失败:', e.message);
    }
    return null;
}

// 生成提醒消息
function generateReminderMessage() {
    const now = new Date();
    const lastReport = getLastReportTime();
    const config = loadConfig();
    
    let message = '\n';
    message += '╔════════════════════════════════════════════════════════════╗\n';
    message += '║  📢 数据提醒 Sub-Agent 报告                                  ║\n';
    message += '╠════════════════════════════════════════════════════════════╣\n';
    message += `║  当前时间: ${now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}          ║\n`;
    
    let diffMinutes = 0;
    if (lastReport) {
        const lastTime = new Date(lastReport.timestamp);
        diffMinutes = Math.floor((now - lastTime) / 60000);
        message += `║  上次报告: ${lastReport.localTime}          ║\n`;
        message += `║  时间间隔: ${diffMinutes} 分钟                                      ║\n`;
    } else {
        message += '║  上次报告: 无记录                                              ║\n';
    }
    
    // 添加强制检查警告
    const forceThreshold = config.forceCheckThreshold || (10 * 60 * 1000);
    if (lastReport && (now - lastReport.timestamp) > forceThreshold) {
        message += '╠════════════════════════════════════════════════════════════╣\n';
        message += '║  🚨🚨🚨 强制检查警告 🚨🚨🚨                                   ║\n';
        message += `║  距离上次报告已超过 ${Math.floor((now - lastReport.timestamp) / 60000)} 分钟！        ║\n`;
        message += '║  请立即执行新的交易检查，不要重复显示旧数据！                 ║\n';
        message += '║  执行命令: cd /root/.openclaw/workspace/okx_data \&\& node ai_trading_bot.js  ║\n';
    }
    
    message += '╠════════════════════════════════════════════════════════════╣\n';
    message += '║  ⚠️  重要提醒:                                                ║\n';
    message += '║                                                              ║\n';
    message += '║  1. 每次生成报告前，请确保获取最新数据                         ║\n';
    message += '║  2. 调用 OKX API 获取实时账户数据                              ║\n';
    message += '║  3. 调用 CoinGecko API 获取最新市场情绪                        ║\n';
    message += '║  4. 检查所有止盈单状态                                         ║\n';
    message += '║  5. 更新持仓盈亏数据                                           ║\n';
    message += '║                                                              ║\n';
    message += '║  ✅ 数据获取检查清单:                                          ║\n';
    message += '║     [ ] 账户余额 (OKX API)                                     ║\n';
    message += '║     [ ] 持仓数据 (OKX API)                                     ║\n';
    message += '║     [ ] 市场价格 (OKX API)                                     ║\n';
    message += '║     [ ] 情绪数据 (CoinGecko API)                               ║\n';
    message += '║     [ ] 新闻情绪 (News API)                                    ║\n';
    message += '║     [ ] 止盈单状态 (OKX API)                                   ║\n';
    message += '╚════════════════════════════════════════════════════════════╝\n';
    
    return { message, diffMinutes, needsForceCheck: lastReport && (now - lastReport.timestamp) > forceThreshold };
}

// 主函数
function runReminder() {
    const config = loadConfig();
    
    if (!config.enabled) {
        console.log('📢 数据提醒 Sub-Agent 已禁用');
        return;
    }
    
    const now = Date.now();
    
    // 检查是否需要提醒
    if (config.lastReminderTime) {
        const timeSinceLastReminder = now - config.lastReminderTime;
        if (timeSinceLastReminder < config.reminderInterval) {
            // 还没到提醒时间
            return;
        }
    }
    
    // 生成并显示提醒
    const reminderResult = generateReminderMessage();
    console.log(reminderResult.message);
    
    // 更新配置
    config.lastReminderTime = now;
    config.reminderCount = (config.reminderCount || 0) + 1;
    saveConfig(config);
    
    return {
        reminded: true,
        timestamp: now,
        message: reminderResult.message,
        diffMinutes: reminderResult.diffMinutes,
        needsForceCheck: reminderResult.needsForceCheck
    };
}

// 启用/禁用提醒
function setEnabled(enabled) {
    const config = loadConfig();
    config.enabled = enabled;
    saveConfig(config);
    console.log(`📢 数据提醒 Sub-Agent 已${enabled ? '启用' : '禁用'}`);
}

// 重置提醒计数
function resetCounter() {
    const config = loadConfig();
    config.reminderCount = 0;
    config.lastReminderTime = null;
    saveConfig(config);
    console.log('📢 数据提醒计数器已重置');
}

// 获取统计信息
function getStats() {
    const config = loadConfig();
    const lastReport = getLastReportTime();
    
    return {
        enabled: config.enabled,
        reminderCount: config.reminderCount || 0,
        createdAt: config.createdAt,
        lastReminderTime: config.lastReminderTime ? new Date(config.lastReminderTime).toISOString() : null,
        lastReportTime: lastReport ? lastReport.isoTime : null
    };
}

// 导出模块
module.exports = {
    runReminder,
    setEnabled,
    resetCounter,
    getStats,
    recordReportTimestamp,
    getLastReportTime
};

// 如果直接运行此文件
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.includes('--enable')) {
        setEnabled(true);
    } else if (args.includes('--disable')) {
        setEnabled(false);
    } else if (args.includes('--reset')) {
        resetCounter();
    } else if (args.includes('--stats')) {
        console.log('📊 统计信息:', JSON.stringify(getStats(), null, 2));
    } else if (args.includes('--record')) {
        const result = recordReportTimestamp();
        console.log('✅ 已记录报告时间戳:', result);
    } else {
        // 默认运行提醒
        runReminder();
    }
}
