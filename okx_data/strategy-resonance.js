// ============================================
// 多维度共振策略模块 - v1.0
// 核心：舆情 + 技术面 + 资金流向 + 大盘环境
// ============================================

const { request } = require('./okx-api.js');

// 缓存数据
const marketDataCache = {};
const CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存

// ============================================
// 1. 大盘环境检测
// ============================================
async function checkMarketEnvironment() {
    try {
        // 获取BTC和ETH数据
        const [btcTicker, ethTicker, btcFunding] = await Promise.all([
            request('/api/v5/market/ticker?instId=BTC-USDT'),
            request('/api/v5/market/ticker?instId=ETH-USDT'),
            request('/api/v5/public/funding-rate?instId=BTC-USDT-SWAP')
        ]);

        const btcData = btcTicker.data?.[0];
        const ethData = ethTicker.data?.[0];
        const fundingData = btcFunding.data?.[0];

        if (!btcData || !ethData) {
            return { canTrade: true, score: 5, reason: '数据获取失败，默认允许交易' };
        }

        // 计算BTC趋势评分
        const btcChange24h = ((parseFloat(btcData.last) - parseFloat(btcData.open24h)) / parseFloat(btcData.open24h)) * 100;
        let btcScore = 5;
        if (btcChange24h > 5) btcScore = 9;
        else if (btcChange24h > 2) btcScore = 8;
        else if (btcChange24h > 0) btcScore = 6;
        else if (btcChange24h > -2) btcScore = 4;
        else if (btcChange24h > -5) btcScore = 3;
        else btcScore = 2;

        // 计算ETH趋势评分
        const ethChange24h = ((parseFloat(ethData.last) - parseFloat(ethData.open24h)) / parseFloat(ethData.open24h)) * 100;
        let ethScore = 5;
        if (ethChange24h > 5) ethScore = 9;
        else if (ethChange24h > 2) ethScore = 8;
        else if (ethChange24h > 0) ethScore = 6;
        else if (ethChange24h > -2) ethScore = 4;
        else if (ethChange24h > -5) ethScore = 3;
        else ethScore = 2;

        // 资金费率分析（负费率表示多头付费，市场看涨；正费率表示空头付费，市场看跌）
        let fundingScore = 5;
        if (fundingData) {
            const fundingRate = parseFloat(fundingData.fundingRate);
            if (fundingRate < -0.0001) fundingScore = 8; // 多头付费，强烈看涨
            else if (fundingRate < 0) fundingScore = 7; // 多头付费，看涨
            else if (fundingRate < 0.0001) fundingScore = 5; // 平衡
            else fundingScore = 3; // 空头付费，看跌
        }

        // 综合大盘评分
        const marketScore = Math.round((btcScore + ethScore + fundingScore) / 3);
        
        // 大盘环境判断
        const canTrade = marketScore >= 4; // 大盘评分≥4才允许交易

        return {
            canTrade,
            score: marketScore,
            btcScore,
            ethScore,
            fundingScore,
            btcChange24h,
            ethChange24h,
            reason: canTrade 
                ? `大盘环境良好(${marketScore}/10): BTC${btcScore}分, ETH${ethScore}分, 资金${fundingScore}分`
                : `大盘环境差(${marketScore}/10): BTC${btcScore}分, ETH${ethScore}分, 建议空仓`
        };
    } catch (e) {
        console.error('大盘环境检测失败:', e.message);
        return { canTrade: true, score: 5, reason: '检测失败，默认允许' };
    }
}

// ============================================
// 2. 资金流向检测
// ============================================
async function checkCapitalFlow(coin) {
    try {
        const instId = `${coin}-USDT`;
        const swapInstId = `${coin}-USDT-SWAP`;
        
        // 获取现货和合约数据
        const [spotTicker, swapTicker, openInterest] = await Promise.all([
            request(`/api/v5/market/ticker?instId=${instId}`),
            request(`/api/v5/market/ticker?instId=${swapInstId}`).catch(() => ({ data: null })),
            request(`/api/v5/public/open-interest?instId=${swapInstId}`).catch(() => ({ data: null }))
        ]);

        const spotData = spotTicker.data?.[0];
        const swapData = swapTicker.data?.[0];
        const oiData = openInterest.data?.[0];

        if (!spotData) {
            return { hasInflow: false, score: 5, reason: '数据获取失败' };
        }

        // 计算成交量异动（与24h平均比较）
        const vol24h = parseFloat(spotData.vol24h);
        const volCcy24h = parseFloat(spotData.volCcy24h);
        const avgVol = vol24h / 24; // 每小时平均成交量
        const currentVol = parseFloat(spotData.lastSz);
        const volumeRatio = currentVol / (avgVol || 1);

        // 价格变化
        const change24h = ((parseFloat(spotData.last) - parseFloat(spotData.open24h)) / parseFloat(spotData.open24h)) * 100;

        // 持仓量变化（如果有数据）
        let oiScore = 5;
        if (oiData) {
            const oiUsd = parseFloat(oiData.oiUsd);
            // 持仓量大于1亿美元认为有机构参与
            if (oiUsd > 500000000) oiScore = 8;
            else if (oiUsd > 100000000) oiScore = 7;
            else if (oiUsd > 50000000) oiScore = 6;
            else oiScore = 4;
        }

        // 量价配合评分
        let volumeScore = 5;
        if (volumeRatio > 3) volumeScore = 9;
        else if (volumeRatio > 2) volumeScore = 8;
        else if (volumeRatio > 1.5) volumeScore = 7;
        else if (volumeRatio > 1.2) volumeScore = 6;
        else if (volumeRatio > 0.8) volumeScore = 5;
        else volumeScore = 3;

        // 综合资金流向评分
        const flowScore = Math.round((volumeScore + oiScore) / 2);
        
        // 判断资金流向
        const hasInflow = flowScore >= 6 && change24h > -5; // 分数高且不是暴跌

        return {
            hasInflow,
            score: flowScore,
            volumeRatio,
            volumeScore,
            oiScore,
            change24h,
            reason: hasInflow
                ? `资金流入良好(${flowScore}/10): 成交量${volumeRatio.toFixed(2)}x, 持仓${oiScore}分`
                : `资金流入不足(${flowScore}/10): 成交量${volumeRatio.toFixed(2)}x, 需观察`
        };
    } catch (e) {
        console.error(`${coin}资金流向检测失败:`, e.message);
        return { hasInflow: false, score: 5, reason: '检测失败' };
    }
}

// ============================================
// 3. 技术面综合验证 - 优化1：放宽条件
// ============================================
function validateTechnicalIndicators(sentiment, currentPrice) {
    const checks = {
        trendScore: sentiment.score >= 5,        // 原6分，降低至5分
        rsiValid: sentiment.rsi >= 30 && sentiment.rsi <= 80,  // 原35-75，放宽至30-80
        volumeValid: sentiment.volume > 0.8,     // 原1.0，降低至0.8
        priceAboveMA5: currentPrice > (sentiment.ma5 || 0) * 0.98,  // 允许低于MA5 2%
        volatilityValid: (sentiment.volatility || 0) >= 0.2  // 原0.3，降低至0.2
    };

    const passCount = Object.values(checks).filter(v => v).length;
    const technicalScore = Math.round((passCount / 5) * 10);

    return {
        passed: passCount >= 2,  // 原3项，降低至2项
        score: technicalScore,
        passCount,
        totalChecks: 5,
        checks,
        reason: `技术面${passCount}/5项通过，评分${technicalScore}/10`
    };
}

// ============================================
// 4. 多维度共振评分
// ============================================
async function calculateResonanceScore(coin, sentiment, currentPrice) {
    console.log(`\n🔍 多维度共振分析 ${coin}...`);

    // 维度1: 舆情 (权重30%)
    const sentimentScore = sentiment.score;
    console.log(`  📢 舆情评分: ${sentimentScore}/10 (权重30%)`);

    // 维度2: 技术面 (权重25%)
    const technical = validateTechnicalIndicators(sentiment, currentPrice);
    console.log(`  📊 ${technical.reason} (权重25%)`);

    // 维度3: 资金流向 (权重25%)
    const capitalFlow = await checkCapitalFlow(coin);
    console.log(`  💰 ${capitalFlow.reason} (权重25%)`);

    // 维度4: 大盘环境 (权重20%)
    const marketEnv = await checkMarketEnvironment();
    console.log(`  🌍 ${marketEnv.reason} (权重20%)`);

    // 计算综合评分
    const totalScore = Math.round(
        sentimentScore * 0.30 +
        technical.score * 0.25 +
        capitalFlow.score * 0.25 +
        marketEnv.score * 0.20
    );

    // 判断是否可以买入 - 优化1：降低门槛
    const canBuy = totalScore >= 6.0 &&   // 原7.0，降低至6.0
                   marketEnv.canTrade && 
                   (technical.passed || technical.score >= 5) &&  // 放宽技术面要求
                   (capitalFlow.hasInflow || capitalFlow.score >= 4);  // 放宽资金流要求

    const result = {
        totalScore,
        canBuy,
        dimensions: {
            sentiment: { score: sentimentScore, weight: 30 },
            technical: { score: technical.score, weight: 25, passed: technical.passed },
            capitalFlow: { score: capitalFlow.score, weight: 25, hasInflow: capitalFlow.hasInflow },
            marketEnv: { score: marketEnv.score, weight: 20, canTrade: marketEnv.canTrade }
        },
        reason: canBuy
            ? `✅ 共振通过(${totalScore}/10): 舆情${sentimentScore}+技术${technical.score}+资金${capitalFlow.score}+大盘${marketEnv.score}`
            : `❌ 共振不足(${totalScore}/10): 需舆情≥7,技术≥6,资金流入,大盘良好`
    };

    console.log(`  ${result.reason}`);
    return result;
}

// ============================================
// 5. 动态仓位计算 - 优化1：降低门槛，提高频率
// ============================================
function calculatePositionSize(resonanceScore, baseSize = 25) {
    // 根据共振分数调整仓位 - 优化：降低门槛
    if (resonanceScore >= 9) {
        return { size: 40, reason: '共振极强(9-10分)，重仓$40' };
    } else if (resonanceScore >= 8) {
        return { size: 32, reason: '共振强(8-9分)，标准仓$32' };
    } else if (resonanceScore >= 7) {
        return { size: 25, reason: '共振良好(7-8分)，基础仓$25' };
    } else if (resonanceScore >= 6) {  // 新增：6-7分也建仓
        return { size: 20, reason: '共振一般(6-7分)，轻仓$20' };
    } else if (resonanceScore >= 5) {  // 新增：5-6分也建仓（小仓位）
        return { size: 15, reason: '共振较弱(5-6分)，试探仓$15' };
    } else {
        return { size: 0, reason: '共振不足(<5分)，不建仓' };
    }
}

// ============================================
// 导出函数
// ============================================
module.exports = {
    checkMarketEnvironment,
    checkCapitalFlow,
    validateTechnicalIndicators,
    calculateResonanceScore,
    calculatePositionSize
};

// 测试
if (require.main === module) {
    console.log('测试多维度共振策略...\n');
    
    // 模拟数据测试
    const mockSentiment = {
        score: 8,
        rsi: 55,
        volume: 1.5,
        ma5: 100,
        volatility: 1.2
    };
    
    calculateResonanceScore('BTC', mockSentiment, 105)
        .then(result => {
            console.log('\n测试结果:', result);
            const position = calculatePositionSize(result.totalScore);
            console.log('建议仓位:', position);
        })
        .catch(console.error);
}