// 币市麻雀战法策略配置 v4.1
// 时区感知 + 小步快跑 + 严格风控

module.exports = {
    // 版本号
    version: '4.1-sparrow',
    
    // 基础参数
    baseCapital: 287,           // 本金
    dailyTarget: 3,             // 日目标 $3 (1%)
    weeklyTarget: 7.18,         // 周目标 $7.18 (2.5%)
    
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
    
    // 止盈止损 (麻雀战法核心)
    takeProfit: {
        step1: 0.015,           // 1.5% 减仓50%
        step2: 0.02,            // 2% 清仓
        hard: 0.02              // 2% 硬止盈
    },
    stopLoss: {
        soft: 0.003,            // 0.3% 预警
        hard: 0.005,            // 0.5% 硬止损
        time: 120               // 2小时时间止损
    },
    
    // 选股门槛 (降低门槛，提高频率)
    entryThreshold: {
        trendScore: 6,          // 趋势≥6分
        resonanceScore: 6,      // 共振≥6分
        btcTrend: 4,            // BTC≥4分
        volatility: { min: 0.5, max: 2.0 }  // 波动率0.5%-2%
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
    }
};
