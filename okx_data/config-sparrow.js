// 币市麻雀战法策略配置 v4.1
// 时区感知 + 小步快跑 + 严格风控

module.exports = {
    // 版本号
    version: '4.1-sparrow',
    
    // 基础参数 - v4.2 超保守麻雀 + 分层止盈
    baseCapital: 287,           // 本金
    dailyTarget: 9,             // 日目标 $9 (3%) - 超保守设置
    weeklyTarget: 21,           // 周目标 $21 (7%) - 复利目标
    
    // 时区配置 (GMT+8 北京时间)
    timeZones: {
        '00:00-04:00': {        // 亚洲尾盘
            intensity: 1,
            positionSize: { min: 5, max: 8 },
            holdTime: { min: 30, max: 60 },
            dailyQuota: 0.10     // 10% 日目标
        },
        '04:00-08:00': {        // 欧美交接
            intensity: 2,
            positionSize: { min: 8, max: 10 },
            holdTime: { min: 20, max: 40 },
            dailyQuota: 0.15     // 15% 日目标
        },
        '08:00-12:00': {        // 亚洲早盘
            intensity: 5,
            positionSize: { min: 12, max: 15 },
            holdTime: { min: 15, max: 60 },
            dailyQuota: 0.30     // 30% 日目标
        },
        '12:00-16:00': {        // 亚洲午盘 (当前)
            intensity: 3,
            positionSize: { min: 10, max: 12 },
            holdTime: { min: 20, max: 50 },
            dailyQuota: 0.20     // 20% 日目标
        },
        '16:00-20:00': {        // 欧洲早盘
            intensity: 5,
            positionSize: { min: 12, max: 15 },
            holdTime: { min: 15, max: 60 },
            dailyQuota: 0.30     // 30% 日目标
        },
        '20:00-24:00': {        // 美国早盘
            intensity: 5,
            positionSize: { min: 12, max: 15 },
            holdTime: { min: 10, max: 45 },
            dailyQuota: 0.40     // 40% 日目标
        }
    },
    
    // 止盈止损 (麻雀战法核心) - v4.3 优化版：更激进的止盈策略
    takeProfit: {
        // 优化3：更激进的止盈策略（方案D）
        tier1: { profit: 0.005, action: 'reduce30' },   // +0.5% 减仓30%（更快锁定利润）
        tier2: { profit: 0.01, action: 'reduce50' },    // +1% 减仓50%（累计80%）
        tier3: { profit: 0.02, action: 'reduce100' },   // +2% 清仓（麻雀见好就收）
        hard: 0.03,                                     // 3% 硬止盈上限（降低）
        
        // 动态调整（根据趋势评分）- 优化设置
        dynamic: {
            trend8plus: { profit: 0.03, action: 'reduce100' },  // 趋势≥8分：+3%（降低）
            trend6to7: { profit: 0.02, action: 'reduce100' },   // 趋势6-7分：+2%（降低）
            trend5minus: { profit: 0.01, action: 'reduce100' }  // 趋势≤5分：+1%（降低）
        }
    },
    stopLoss: {
        soft: 0.003,            // 0.3% 预警
        hard: 0.005,            // 0.5% 硬止损
        time: 120               // 2小时时间止损
    },
    
    // 选股门槛 (优化1：降低门槛，提高买入频率)
    entryThreshold: {
        trendScore: 5,          // 趋势≥5分（原6分，降低1分）
        resonanceScore: 5,      // 共振≥5分（原6分，降低1分）
        btcTrend: 3,            // BTC≥3分（原4分，降低1分）
        volatility: { min: 0.3, max: 3.0 }  // 波动率0.3%-3%（放宽）
    },
    
    // 仓位管理
    position: {
        maxPositions: 3,        // 最大3个币种
        maxPerCoin: 15,         // 单个币种最大$15
        totalExposure: 0.20     // 总仓位不超过20%
    },
    
    // 日度控制
    dailyControl: {
        profitTarget: 3,        // 盈利$3停止
        lossLimit: 5,           // 亏损$5停止
        consecutiveLosses: 3,   // 连续3笔亏损暂停
        pauseDuration: 30       // 暂停30分钟
    },
    
    // 检查频率 (分钟)
    checkInterval: {
        active: 2,              // 活跃时段2分钟
        quiet: 5                // 清淡时段5分钟
    },
    
    // 共振权重 (简化版)
    resonanceWeights: {
        sentiment: 0.30,        // 舆情30%
        technical: 0.30,        // 技术30%
        capitalFlow: 0.25,      // 资金25%
        marketEnv: 0.15         // 大盘15%
    },
    
    // 黑名单配置 (币市麻雀战法优化)
    blacklist: {
        // 亏损止损黑名单：2小时（原24小时）
        // 超短线交易，快速反弹机会多，缩短限制时间
        stopLossDuration: 2 * 60 * 60 * 1000,  // 2小时
        
        // 强势趋势立即解除（>=8分）
        // 如果趋势大涨，立即解除黑名单限制
        strongTrendUnlock: true,
        strongTrendThreshold: 8,  // 趋势>=8分立即解除
        
        // 中等趋势缩短限制（6-7分）
        mediumTrendDuration: 30 * 60 * 1000,  // 30分钟
        mediumTrendThreshold: 6,  // 趋势6-7分缩短至30分钟
        
        // 保留手动黑名单（用户主动禁止）
        manualBan: true,
        
        // 保留稳定币黑名单（避免误买USDC等）
        stablecoinBan: true,
        stablecoins: ['USDC', 'USDT', 'USDG', 'USDE', 'DAI', 'TUSD', 'PAXG', 'XAUT']
    }
};
