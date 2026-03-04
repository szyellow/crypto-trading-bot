const { request } = require('./okx-api.js');

async function checkStatus() {
    console.log('=== ' + new Date().toLocaleTimeString('zh-CN', {hour:'2-digit', minute:'2-digit'}) + ' 状态检查 ===\n');
    
    const account = await request('/api/v5/account/balance', 'GET');
    if (account.code === '0') {
        const totalEq = parseFloat(account.data[0].totalEq);
        const usdt = account.data[0].details.find(d => d.ccy === 'USDT');
        const usdtAvail = usdt ? parseFloat(usdt.availBal) : 0;
        
        console.log('💰 总资产: $' + totalEq.toFixed(2));
        console.log('   USDT: $' + usdtAvail.toFixed(2));
        
        // 显示主要持仓（使用eqUsd）
        const positions = account.data[0].details
            .filter(d => parseFloat(d.eqUsd) > 5 && d.ccy !== 'USDT')
            .sort((a, b) => parseFloat(b.eqUsd) - parseFloat(a.eqUsd));
        
        if (positions.length > 0) {
            console.log('\n📈 主要持仓:');
            positions.forEach(p => {
                const value = parseFloat(p.eqUsd);  // 使用eqUsd（美元价值）
                console.log('   ' + p.ccy + ': $' + value.toFixed(2));
            });
        }
        
        console.log('\n✅ 系统正常');
    } else {
        console.log('❌ 获取账户数据失败');
    }
}

checkStatus();
