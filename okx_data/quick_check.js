// 快速检查账户状态
const { request } = require('./okx-api.js');

async function quickCheck() {
    try {
        // 获取账户余额
        const balance = await request('/api/v5/account/balance');
        
        if (!balance.data || !balance.data[0]) {
            console.log('❌ 获取账户数据失败');
            return;
        }
        
        const details = balance.data[0].details;
        
        console.log('=== 账户状态检查 ===\n');
        
        // USDT余额
        const usdt = details.find(d => d.ccy === 'USDT');
        const usdtAvailable = usdt ? parseFloat(usdt.availBal || 0) : 0;
        const usdtEquity = usdt ? parseFloat(usdt.eq || 0) : 0;
        
        console.log(`💰 USDT:`);
        console.log(`  可用: $${usdtAvailable.toFixed(2)}`);
        console.log(`  总权益: $${usdtEquity.toFixed(2)}`);
        
        // 持仓币种
        console.log(`\n📊 持仓详情:`);
        let totalPositionValue = 0;
        
        for (const d of details) {
            if (d.ccy !== 'USDT' && parseFloat(d.eq || 0) > 0.01) {
                const equity = parseFloat(d.eq || 0);
                const available = parseFloat(d.availBal || 0);
                const frozen = parseFloat(d.frozenBal || 0);
                
                console.log(`  ${d.ccy}:`);
                console.log(`    权益: $${equity.toFixed(2)}`);
                console.log(`    可用: ${available.toFixed(6)}`);
                console.log(`    冻结: ${frozen.toFixed(6)}`);
                
                totalPositionValue += equity;
            }
        }
        
        const totalEquity = parseFloat(balance.data[0].totalEq || 0);
        
        console.log(`\n📈 总计:`);
        console.log(`  总资产: $${totalEquity.toFixed(2)}`);
        console.log(`  持仓市值: $${totalPositionValue.toFixed(2)}`);
        console.log(`  现金占比: ${((usdtAvailable / totalEquity) * 100).toFixed(1)}%`);
        console.log(`  持仓占比: ${((totalPositionValue / totalEquity) * 100).toFixed(1)}%`);
        
    } catch (e) {
        console.error('检查失败:', e.message);
    }
}

quickCheck();
