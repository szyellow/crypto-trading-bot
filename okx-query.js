const https = require('https');
const crypto = require('crypto');

const API_KEY = '08c39092-340c-4254-b10d-dbf454472eff';
const API_SECRET = 'C211F2DA7260A48B288490B003011C74';
const PASSPHRASE = '25588433aA.';

function makeRequest(path, method = 'GET', body = '') {
  return new Promise((resolve, reject) => {
    const timestamp = new Date().toISOString();
    const signData = timestamp + method + path + body;
    const signature = crypto.createHmac('sha256', API_SECRET)
      .update(signData)
      .digest('base64');

    const options = {
      hostname: 'www.okx.com',
      port: 443,
      path: path,
      method: method,
      headers: {
        'OK-ACCESS-KEY': API_KEY,
        'OK-ACCESS-SIGN': signature,
        'OK-ACCESS-TIMESTAMP': timestamp,
        'OK-ACCESS-PASSPHRASE': PASSPHRASE,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function main() {
  try {
    // 获取账户余额
    console.log('=== 账户余额 ===');
    const balance = await makeRequest('/api/v5/account/balance');
    console.log(JSON.stringify(balance, null, 2));

    // 获取网格订单
    console.log('\n=== 网格订单 ===');
    const gridOrders = await makeRequest('/api/v5/tradingBot/grid/orders-algo-pending?algoOrdType=grid');
    console.log(JSON.stringify(gridOrders, null, 2));

    // 获取持仓
    console.log('\n=== 持仓信息 ===');
    const positions = await makeRequest('/api/v5/account/positions');
    console.log(JSON.stringify(positions, null, 2));

  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();
