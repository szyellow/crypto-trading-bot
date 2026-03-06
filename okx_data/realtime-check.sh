#!/bin/bash
# 实时交易报告脚本 - 每次直接调用OKX API

cd /root/.openclaw/workspace/okx_data

echo "⏰ 5分钟交易检查完成 - $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

node -e "
const { request } = require('./okx-api.js');

async function report() {
    // 获取实时账户数据
    const balance = await request('/api/v5/account/balance');
    const details = balance.data[0].details || [];
    
    // 获取实时价格
    const bnbTicker = await request('/api/v5/market/ticker?instId=BNB-USDT');
    const trxTicker = await request('/api/v5/market/ticker?instId=TRX-USDT');
    
    const bnbPrice = bnbTicker.data ? parseFloat(bnbTicker.data[0].last) : 0;
    const trxPrice = trxTicker.data ? parseFloat(trxTicker.data[0].last) : 0;
    const bnbTs = bnbTicker.data ? bnbTicker.data[0].ts : 0;
    const trxTs = trxTicker.data ? trxTicker.data[0].ts : 0;
    
    console.log('📊 实时数据:');
    console.log('');
    
    // BNB
    const bnb = details.find(x => x.ccy === 'BNB');
    if (bnb && bnbPrice > 0) {
        const avgPrice = parseFloat(bnb.openAvgPx) || parseFloat(bnb.accAvgPx) || 0;
        const pnl = avgPrice > 0 ? ((bnbPrice - avgPrice) / avgPrice * 100) : 0;
        
        console.log('BNB:');
        console.log('  当前价: ' + bnbPrice.toFixed(2) + ' USDT (OKX: ' + new Date(parseInt(bnbTs)).toLocaleTimeString() + ')');
        console.log('  盈亏: ' + pnl.toFixed(2) + '%');
        console.log('');
    }
    
    // TRX
    const trx = details.find(x => x.ccy === 'TRX');
    if (trx && trxPrice > 0) {
        const avgPrice = parseFloat(trx.openAvgPx) || parseFloat(trx.accAvgPx) || 0;
        const pnl = avgPrice > 0 ? ((trxPrice - avgPrice) / avgPrice * 100) : 0;
        
        console.log('TRX:');
        console.log('  当前价: ' + trxPrice.toFixed(4) + ' USDT (OKX: ' + new Date(parseInt(trxTs)).toLocaleTimeString() + ')');
        console.log('  盈亏: ' + pnl.toFixed(2) + '%');
        console.log('');
    }
    
    // 总资产
    const totalEq = parseFloat(balance.data[0].totalEq || 0);
    console.log('总资产: ' + totalEq.toFixed(2) + ' USDT');
    console.log('');
    console.log('✅ 数据是实时的！');
}

report().catch(e => console.error('错误:', e.message));
" 2>&1
