// data-loader.js - 从交易日志加载实时数据

async function loadTradingData() {
    try {
        // 尝试从本地文件加载数据
        const response = await fetch('ai_trade_log.json');
        if (!response.ok) throw new Error('无法加载数据');
        
        const data = await response.json();
        
        // 更新总资产
        if (data.totalEquity) {
            document.getElementById('total-asset').textContent = `$${data.totalEquity.toFixed(2)}`;
        }
        
        // 更新今日交易统计
        const today = new Date().toISOString().split('T')[0];
        const todayTrades = data.trades.filter(t => t.time.startsWith(today));
        
        // 计算胜率
        const sellTrades = todayTrades.filter(t => t.action === 'sell');
        const winTrades = sellTrades.filter(t => t.reason && t.reason.includes('止盈'));
        const winRate = sellTrades.length > 0 ? (winTrades.length / sellTrades.length * 100).toFixed(0) : 0;
        
        // 更新统计信息
        updateStats(todayTrades, winRate);
        
        // 更新持仓信息
        if (data.positions) {
            updatePositions(data.positions);
        }
        
        // 更新日志
        updateLogs(data.trades.slice(-20));
        
        console.log('✅ 数据加载成功');
        
    } catch (error) {
        console.log('⚠️ 使用默认数据:', error.message);
    }
}

function updateStats(trades, winRate) {
    // 更新胜率显示
    const winRateElements = document.querySelectorAll('.card-value');
    winRateElements.forEach(el => {
        if (el.textContent.includes('%') && el.classList.contains('positive')) {
            el.textContent = `${winRate}%`;
        }
    });
}

function updatePositions(positions) {
    // 更新持仓表格
    const tbody = document.querySelector('#positions tbody');
    if (!tbody) return;
    
    // 清空现有内容
    tbody.innerHTML = '';
    
    // 添加每个持仓
    Object.entries(positions).forEach(([coin, pos]) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${coin}</strong></td>
            <td>${pos.percent?.toFixed(1) || '-'}%</td>
            <td>${pos.amount?.toFixed(4) || '-'}</td>
            <td>$${pos.costPrice?.toFixed(2) || '-'}</td>
            <td>$${pos.currentPrice?.toFixed(2) || '-'}</td>
            <td class="${pos.pnl >= 0 ? 'positive' : 'negative'}">${pos.pnl?.toFixed(2) || '-'}%</td>
            <td><span class="trend-score trend-neutral">- (数据同步中)</span></td>
            <td>- / -</td>
        `;
        tbody.appendChild(row);
    });
}

function updateLogs(trades) {
    const logsContainer = document.getElementById('logs-container');
    if (!logsContainer) return;
    
    logsContainer.innerHTML = '';
    
    trades.reverse().forEach(trade => {
        const time = trade.time.split('T')[1]?.substring(0, 5) || '--:--';
        const type = trade.action.toUpperCase();
        const typeClass = trade.action === 'buy' ? 'log-buy' : 
                         trade.action === 'sell' ? 'log-sell' : 'log-hold';
        
        const entry = document.createElement('div');
        entry.className = 'log-entry';
        entry.innerHTML = `
            <span class="log-time">${time}</span>
            <span class="log-type ${typeClass}">[${type}]</span>
            <span>${trade.coin} - ${trade.reason || '交易执行'}</span>
        `;
        logsContainer.appendChild(entry);
    });
}

// 页面加载时自动获取数据
document.addEventListener('DOMContentLoaded', loadTradingData);

// 每30秒尝试刷新数据
setInterval(loadTradingData, 30000);