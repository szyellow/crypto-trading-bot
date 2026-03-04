// 手动卖出USDC脚本
const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

const API_KEY = process.env.OKX_API_KEY;
const API_SECRET = process.env.OKX_API_SECRET;
const PASSPHRASE = process.env.OKX_PASSPHRASE;

function getSignature(timestamp, method, path, body = '') {
    const message = timestamp + method + path + body;
    const hmac = crypto.createHmac('sha256', API_SECRET);
    hmac.update(message);
    return hmac.digest('base64');
}

async function sellUSDC() {
    const timestamp = new Date().toISOString();
    const path = '/api/v5/trade/order';
    
    const body = JSON.stringify({
        instId: 'USDC-USDT',
        tdMode: 'cash',
        side: 'sell',
        ordType: 'market',
        sz: '40'  // 卖出40 USDC
    });
    
    const signature = getSignature(timestamp, 'POST', path, body);
    
    try {
        const response = await axios.post(`https://www.okx.com${path}`, body, {
            headers: {
                'OK-ACCESS-KEY': API_KEY,
                'OK-ACCESS-SIGN': signature,
                'OK-ACCESS-TIMESTAMP': timestamp,
                'OK-ACCESS-PASSPHRASE': PASSPHRASE,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('✅ USDC卖出成功!');
        console.log('订单ID:', response.data.data[0].ordId);
        console.log('释放资金: ~$40 USDT');
        return response.data;
    } catch (error) {
        console.error('❌ 卖出失败:', error.response?.data || error.message);
        throw error;
    }
}

sellUSDC();
