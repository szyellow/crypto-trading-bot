// 测试脚本：查看OKX API返回的持仓数据
const { request } = require('./okx-api.js');

async function testAccountData() {
    try {
        console.log('=== 测试OKX API持仓数据 ===\n');
        
        const balance = await request('/api/v5/account/balance');
        const details = balance.data[0].details;
        
        console.log('总资产:', balance.data[0].totalEq);
        console.log('\n详细持仓数据:');
        console.log('========================================');
        
        details.forEach(d => {
            if (d.ccy !== 'USDT') {
                console.log(`\n币种: ${d.ccy}`);
                console.log(`  - eqUsd (美元价值): ${d.eqUsd}`);
                console.log(`  - spotBal (现货余额): ${d.spotBal}`);
                console.log(`  - eq (总权益): ${d.eq}`);
                console.log(`  - availBal (可用余额): ${d.availBal}`);
                console.log(`  - openAvgPx (开仓均价): ${d.openAvgPx}`);
                console.log(`  - accAvgPx (累计均价): ${d.accAvgPx}`);
                console.log(`  - 是否被识别为持仓: ${parseFloat(d.eqUsd) > 0.5 ? '是' : '否'}`);
            }
        });
        
        console.log('\n========================================');
        console.log('USDT数据:');
        const usdt = details.find(d => d.ccy === 'USDT');
        if (usdt) {
            console.log(`  - availBal (可用): ${usdt.availBal}`);
            console.log(`  - eqUsd (美元价值): ${usdt.eqUsd}`);
        }
        
    } catch(e) {
        console.error('获取账户数据失败:', e.message);
    }
}

testAccountData();
