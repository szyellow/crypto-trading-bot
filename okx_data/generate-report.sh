#!/bin/bash
# 实时交易报告生成脚本
# 每次运行时直接调用OKX API获取最新数据

cd /root/.openclaw/workspace/okx_data

echo "⏰ 5分钟交易检查 - $(date '+%Y-%m-%d %H:%M')"
echo ""
echo "## 📊 交易结果"
echo ""

# 检查是否暂停
if [ -f "EMERGENCY_STOP.flag" ]; then
    echo "🛑 交易已暂停"
    echo "原因: $(cat EMERGENCY_STOP.flag)"
    echo ""
fi

# 获取实时数据
node -e "
const { request } = require('./okx-api.js');

async function report() {
    // 获取账户数据
    const balance = await request('/api/v5/account/balance');
    const details = balance.data[0].details || [];
    
    // 获取价格
    const bnbTicker = await request('/api/v5/market/ticker?instId=BNB-USDT');
    const trxTicker = await request('/api/v5/market/ticker?instId=TRX-USDT');
    
    const bnbPrice = bnbTicker.data ? parseFloat(bnbTicker.data[0].last) : 0;
    const trxPrice = trxTicker.data ? parseFloat(trxTicker.data[0].last) : 0;
    const bnbTs = bnbTicker.data ? bnbTicker.data[0].ts : 0;
    const trxTs = trxTicker.data ? trxTicker.data[0].ts : 0;
    
    // BNB持仓
    const bnb = details.find(x => x.ccy === 'BNB');
    if (bnb && bnbPrice > 0) {
        const amount = parseFloat(bnb.eq);
        const avgPrice = parseFloat(bnb.openAvgPx) || parseFloat(bnb.accAvgPx) || 0;
        const pnl = avgPrice > 0 ? ((bnbPrice - avgPrice) / avgPrice * 100) : 0;
        
        console.log('### BNB持仓');
        console.log(\`- 持仓数量: \${amount.toFixed(6)} 个\`);
        console.log(\`- 成本价: \${avgPrice.toFixed(2)} USDT\`);
        console.log(\`- 当前价: \${bnbPrice.toFixed(2)} USDT (OKX时间: \${new Date(parseInt(bnbTs)).toLocaleTimeString()})\`);
        console.log(\`- 盈亏: \${pnl.toFixed(2)}%\`);
        console.log('');
    }
    
    // TRX持仓
    const trx = details.find(x => x.ccy === 'TRX');
    if (trx && trxPrice > 0) {
        const amount = parseFloat(trx.eq);
        const avgPrice = parseFloat(trx.openAvgPx) || parseFloat(trx.accAvgPx) || 0;
        const pnl = avgPrice > 0 ? ((trxPrice - avgPrice) / avgPrice * 100) : 0;
        
        console.log('### TRX持仓');
        console.log(\`- 持仓数量: \${amount.toFixed(6)} 个\`);
        console.log(\`- 成本价: \${avgPrice.toFixed(4)} USDT\`);
        console.log(\`- 当前价: \${trxPrice.toFixed(4)} USDT (OKX时间: \${new Date(parseInt(trxTs)).toLocaleTimeString()})\`);
        console.log(\`- 盈亏: \${pnl.toFixed(2)}%\`);
        console.log('');
    }
    
    // 账户概况
    const usdt = details.find(d => d.ccy === 'USDT');
    const totalEq = parseFloat(balance.data[0].totalEq || 0);
    const usdtAvail = usdt ? parseFloat(usdt.availEq || 0) : 0;
    
    console.log('### 账户概况');
    console.log(\`- 总资产: \${totalEq.toFixed(2)} USDT\`);
    console.log(\`- 可用USDT: \${usdtAvail.toFixed(2)}\`);
    console.log('');
    
    console.log('✅ 数据是实时的！');
}

report().catch(e => console.error('错误:', e.message));
" 2>&1
