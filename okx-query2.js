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
    // 获取历史成交记录
    console.log('=== 历史成交记录 ===');
    const fills = await makeRequest('/api/v5/trade/fills?limit=10');
    console.log(JSON.stringify(fills, null, 2));

    // 获取网格历史订单
    console.log('\n=== 网格历史订单 ===');
    const gridHistory = await makeRequest('/api/v5/tradingBot/grid/orders-algo-history?algoOrdType=grid&limit=10');
    console.log(JSON.stringify(gridHistory, null, 2));

    // 获取当前标记价格
    console.log('\n=== 当前标记价格 ===');
    const tickers = await makeRequest('/api/v5/market/tickers?instType=SPOT');
    console.log(JSON.stringify(tickers, null, 2));

  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();
