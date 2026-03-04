// 取消USDC止盈单脚本
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

async function cancelUSDCOrder() {
    const timestamp = new Date().toISOString();
    const path = '/api/v5/trade/cancel-order';
    
    // 使用最新的订单ID
    const body = JSON.stringify({
        instId: 'USDC-USDT',
        ordId: '3358877876617977856'
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
        
        console.log('✅ USDC止盈单取消成功!');
        console.log('结果:', response.data);
        return response.data;
    } catch (error) {
        console.error('❌ 取消失败:', error.response?.data || error.message);
        throw error;
    }
}

cancelUSDCOrder();
