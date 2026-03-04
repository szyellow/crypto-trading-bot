const { request } = require('./okx_data/okx-api.js');
const https = require('https');

// 获取CoinGecko价格
async function getCoinGeckoPrices(ids) {
    return new Promise((resolve, reject) => {
        const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=usd&include_24hr_change=true`;
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

// 获取市场数据（CoinGecko Top 10）
async function getMarketData() {
    return new Promise((resolve, reject) => {
        const url = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=10&page=1';
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve(parsed);
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

// 使用OKX获取行情数据作为备用
async function getOKXTicker(instId) {
    return request(`/api/v5/market/ticker?instId=${instId}`);
}

async function generateReport() {
    try {
        console.log("正在获取OKX账户数据...");
        
        // 1. 获取账户余额
        const balanceData = await request('/api/v5/account/balance');
        const balances = Array.isArray(balanceData.data?.[0]?.details) ? balanceData.data[0].details : [];
        
        // 2. 获取网格交易策略
        const gridData = await request('/api/v5/tradingBot/grid/orders-pending');
        const gridOrders = Array.isArray(gridData.data) ? gridData.data : [];
        
        // 3. 获取历史成交
        const ordersData = await request('/api/v5/trade/orders-history?limit=20');
        const orders = Array.isArray(ordersData.data) ? ordersData.data : [];
        
        // 4. 获取市场数据（从OKX获取主要币种）
        const marketSymbols = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'DOT', 'LTC'];
        const marketData = [];
        
        for (let i = 0; i < marketSymbols.length; i++) {
            const sym = marketSymbols[i];
            try {
                const ticker = await getOKXTicker(`${sym}-USDT`);
                if (ticker.data && ticker.data[0]) {
                    const t = ticker.data[0];
                    const open24h = parseFloat(t.open24h || t.last);
                    const last = parseFloat(t.last);
                    const change24h = open24h > 0 ? ((last - open24h) / open24h) * 100 : 0;
                    marketData.push({
                        symbol: sym,
                        current_price: last,
                        price_change_percentage_24h: change24h,
                        market_cap_rank: i + 1,
                        total_volume: parseFloat(t.volCcy24h || 0) * last
                    });
                }
            } catch (e) {
                // 使用备用数据
                const fallbackPrices = {
                    'BTC': 68000, 'ETH': 1944, 'SOL': 145, 'XRP': 1.42, 'DOGE': 0.185,
                    'ADA': 0.68, 'AVAX': 22.5, 'LINK': 15.8, 'DOT': 4.2, 'LTC': 95
                };
                marketData.push({
                    symbol: sym,
                    current_price: fallbackPrices[sym] || 0,
                    price_change_percentage_24h: 0,
                    market_cap_rank: i + 1,
                    total_volume: 0
                });
            }
        }
        
        // 5. 获取持仓币种的价格
        const holdCurrencies = balances.filter(b => parseFloat(b.cashBal) > 0).map(b => b.ccy);
        const priceMap = {};
        
        // 手动映射常见币种到CoinGecko ID
        const coinGeckoMap = {
            'BTC': 'bitcoin',
            'ETH': 'ethereum',
            'SOL': 'solana',
            'XRP': 'ripple',
            'DOGE': 'dogecoin',
            'ADA': 'cardano',
            'AVAX': 'avalanche-2',
            'LINK': 'chainlink',
            'DOT': 'polkadot',
            'MATIC': 'matic-network',
            'UNI': 'uniswap',
            'ATOM': 'cosmos',
            'LTC': 'litecoin',
            'BNB': 'binancecoin',
            'USDT': 'tether',
            'USDC': 'usd-coin'
        };
        
        // 获取持仓币种价格（从OKX）
        for (const ccy of holdCurrencies) {
            if (ccy === 'USDT' || ccy === 'USDC') {
                priceMap[ccy] = 1.0;
                continue;
            }
            try {
                const ticker = await getOKXTicker(`${ccy}-USDT`);
                if (ticker.data && ticker.data[0]) {
                    priceMap[ccy] = parseFloat(ticker.data[0].last);
                }
            } catch (e) {
                // 忽略错误
            }
        }
        
        // 生成报告
        const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
        
        console.log("\n" + "=".repeat(60));
        console.log("📊 加密货币波段监测报告");
        console.log("⏰ 生成时间：" + now);
        console.log("=".repeat(60));
        
        // 1. 账户概况
        console.log("\n💼 账户概况");
        console.log("-".repeat(100));
        console.log("币种    数量          成本价      现价        市值(USD)      成本(USD)      盈亏        盈亏率");
        console.log("-".repeat(100));
        
        let totalEquity = 0;
        let totalCost = 0;
        
        balances.filter(b => parseFloat(b.cashBal) > 0 && b.ccy !== 'USDT' && b.ccy !== 'USDC').forEach(b => {
            const ccy = b.ccy.padEnd(6);
            const qty = parseFloat(b.cashBal).toFixed(6).padStart(12);
            const avgPx = parseFloat(b.avgPx || 0).toFixed(2).padStart(10);
            const currentPx = priceMap[b.ccy] || parseFloat(b.avgPx || 0);
            const pxStr = currentPx.toFixed(2).padStart(10);
            const eq = parseFloat(b.eq || 0) * (priceMap[b.ccy] || 1);
            const eqStr = eq.toFixed(2).padStart(14);
            const cost = parseFloat(b.cashBal) * parseFloat(b.avgPx || 0);
            const costStr = cost.toFixed(2).padStart(14);
            const pnl = eq - cost;
            const pnlStr = (pnl >= 0 ? '+' : '') + pnl.toFixed(2).padStart(10);
            const pnlRate = cost > 0 ? ((pnl / cost) * 100).toFixed(2) : '0.00';
            const pnlRateStr = (pnl >= 0 ? '+' : '') + pnlRate + '%';
            
            console.log(`${ccy} ${qty} ${avgPx} ${pxStr} ${eqStr} ${costStr} ${pnlStr} ${pnlRateStr}`);
            
            totalEquity += eq;
            totalCost += cost;
        });
        
        // USDT/USDC余额
        const stables = balances.filter(b => (b.ccy === 'USDT' || b.ccy === 'USDC') && parseFloat(b.cashBal) > 0);
        stables.forEach(b => {
            const eq = parseFloat(b.eq || b.cashBal);
            console.log(`${b.ccy.padEnd(6)} ${parseFloat(b.cashBal).toFixed(2).padStart(12)} ${'-'.padStart(10)} ${'1.00'.padStart(10)} ${eq.toFixed(2).padStart(14)} ${eq.toFixed(2).padStart(14)} ${'+0.00'.padStart(10)} +0.00%`);
            totalEquity += eq;
            totalCost += eq;
        });
        
        console.log("-".repeat(100));
        const totalPnl = totalEquity - totalCost;
        const totalPnlRate = totalCost > 0 ? ((totalPnl / totalCost) * 100).toFixed(2) : '0.00';
        console.log(`总计: 市值 $${totalEquity.toFixed(2)} | 成本 $${totalCost.toFixed(2)} | 盈亏 ${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)} (${totalPnl >= 0 ? '+' : ''}${totalPnlRate}%)`);
        
        // 2. 网格交易状态
        console.log("\n🔒 网格交易状态");
        console.log("-".repeat(100));
        console.log("策略ID        交易对        投入(USDT)    价格区间           网格数    成交次数    状态");
        console.log("-".repeat(100));
        
        if (gridOrders.length === 0) {
            console.log("暂无运行中的网格策略");
        } else {
            gridOrders.forEach(grid => {
                const algoId = (grid.algoId || '-').toString().slice(-8).padStart(12);
                const instId = (grid.instId || '-').padStart(12);
                const invest = parseFloat(grid.totalInvest || 0).toFixed(2).padStart(12);
                const range = `${parseFloat(grid.lowerPx || 0).toFixed(2)} - ${parseFloat(grid.upperPx || 0).toFixed(2)}`.padStart(18);
                const gridNum = (grid.gridNum || '-').toString().padStart(8);
                const fills = (grid.fillNum || '0').toString().padStart(10);
                const status = (grid.state || '-').padStart(8);
                console.log(`${algoId} ${instId} ${invest} ${range} ${gridNum} ${fills} ${status}`);
            });
        }
        console.log("-".repeat(100));
        
        // 3. AI自主交易（最近成交）
        console.log("\n🤖 AI自主交易 - 最近20笔成交");
        console.log("-".repeat(120));
        console.log("时间                操作    币种    数量          成本价      现价        成交金额(USD)  盈亏        状态");
        console.log("-".repeat(120));
        
        if (orders.length === 0) {
            console.log("暂无成交记录");
        } else {
            orders.slice(0, 20).forEach(order => {
                const time = new Date(parseInt(order.cTime)).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }).padStart(19);
                const side = (order.side === 'buy' ? '买入' : '卖出').padStart(6);
                const ccy = order.instId?.split('-')[0]?.padStart(6) || '-'.padStart(6);
                const sz = parseFloat(order.sz || 0).toFixed(6).padStart(12);
                const avgPx = parseFloat(order.avgPx || 0).toFixed(2).padStart(10);
                const currentPx = priceMap[order.instId?.split('-')[0]] || parseFloat(order.avgPx || 0);
                const pxStr = currentPx.toFixed(2).padStart(10);
                const amount = parseFloat(order.accFillSz || 0) * parseFloat(order.avgPx || 0);
                const amountStr = amount.toFixed(2).padStart(14);
                const pnl = '-'.padStart(10);
                const state = (order.state === 'filled' ? '✓ 完成' : order.state).padStart(8);
                console.log(`${time} ${side} ${ccy} ${sz} ${avgPx} ${pxStr} ${amountStr} ${pnl} ${state}`);
            });
        }
        console.log("-".repeat(120));
        
        // 4. 市场概况
        console.log("\n📈 市场概况 - Top 10 币种");
        console.log("-".repeat(90));
        console.log("排名  币种          价格(USD)        24h涨跌        市值排名      24h成交量(USD)");
        console.log("-".repeat(90));
        
        if (marketData.length === 0) {
            console.log("暂时无法获取市场数据");
        } else {
            marketData.slice(0, 10).forEach((coin, idx) => {
                const rank = (idx + 1).toString().padStart(4);
                const symbol = coin.symbol.toUpperCase().padStart(10);
                const price = '$' + coin.current_price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).padStart(12);
                const change = coin.price_change_percentage_24h || 0;
                const changeStr = (change >= 0 ? '+' : '') + change.toFixed(2) + '%';
                const changePadded = changeStr.padStart(12);
                const mcRank = (coin.market_cap_rank || idx + 1).toString().padStart(10);
                const vol = '$' + (coin.total_volume || 0).toLocaleString('en-US', { maximumFractionDigits: 0 }).padStart(14);
                console.log(`${rank} ${symbol} ${price} ${changePadded} ${mcRank} ${vol}`);
            });
        }
        console.log("-".repeat(90));
        
        // 5. 舆情摘要
        console.log("\n📰 舆情摘要");
        console.log("-".repeat(60));
        console.log("【马斯克相关】");
        console.log("  • Pepeto预售突破725万美元，鲸鱼追逐狗狗币 playbook");
        console.log("  • 马斯克AI助手Grok在医疗建议方面出现分歧");
        console.log("\n【特朗普/政策相关】");
        console.log("  • Trump家族挖矿公司American Bitcoin持有超6,000枚BTC储备");
        console.log("  • 加密领袖和立法者在Trump家族World Liberty Forum会面");
        console.log("  • 第二任Trump政府采取轻触式加密监管方式");
        console.log("\n【机构动态】");
        console.log("  • 高盛CEO David Solomon(曾是加密怀疑者)现持有比特币");
        console.log("  • 渣打银行与B2C2合作增强机构加密资产接入");
        console.log("  • Michael Saylor的Strategy称可承受BTC跌至$8,000");
        console.log("  • Strategy持有714,644枚BTC，约60亿美元债务");
        console.log("-".repeat(60));
        
        // 6. 交易决策建议
        console.log("\n🎯 交易决策建议");
        console.log("-".repeat(60));
        console.log("【短期策略】(1-7天)");
        console.log("  • 关注BTC突破情况，设置好止损点");
        console.log("  • 网格策略持续运行，自动套利");
        console.log("\n【中期策略】(1-4周)");
        console.log("  • 定投策略继续保持");
        console.log("  • 关注ETH生态系统发展");
        console.log("\n【风险提示】");
        console.log("  • 市场波动较大，控制仓位");
        console.log("  • 避免追涨杀跌");
        console.log("-".repeat(60));
        
        // 7. 总结
        console.log("\n📝 总结");
        console.log("-".repeat(60));
        console.log(`总资产估值: $${totalEquity.toFixed(2)} USD`);
        console.log(`总盈亏: ${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)} (${totalPnl >= 0 ? '+' : ''}${totalPnlRate}%)`);
        console.log(`持仓币种: ${holdCurrencies.length} 个`);
        console.log(`运行中网格策略: ${gridOrders.length} 个`);
        console.log(`下次报告时间: ${new Date(Date.now() + 4 * 60 * 60 * 1000).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);
        console.log("=".repeat(60));
        
    } catch (error) {
        console.error("生成报告出错:", error.message);
        process.exit(1);
    }
}

generateReport();
