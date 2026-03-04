const crypto = require('crypto');
const https = require('https');

const API_KEY = '08c39092-340c-4254-b10d-dbf454472eff';
const API_SECRET = 'C211F2DA7260A48B288490B003011C74';
const PASSPHRASE = '25588433aA.';

function sign(timestamp, method, path, body = '') {
    const message = timestamp + method + path + body;
    return crypto.createHmac('sha256', API_SECRET).update(message).digest('base64');
}

function request(path, method = 'GET', body = null) {
    return new Promise((resolve, reject) => {
        const timestamp = new Date().toISOString();
        const bodyStr = body ? JSON.stringify(body) : '';
        
        const options = {
            hostname: 'www.okx.com',
            port: 443,
            path: path,
            method: method,
            headers: {
                'OK-ACCESS-KEY': API_KEY,
                'OK-ACCESS-SIGN': sign(timestamp, method, path, bodyStr),
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
                    const json = JSON.parse(data);
                    resolve(json);
                } catch (e) {
                    resolve({ error: 'Parse error', raw: data });
                }
            });
        });

        req.on('error', reject);
        if (bodyStr) req.write(bodyStr);
        req.end();
    });
}

// 导出函数供其他脚本使用
module.exports = { request, sign, API_KEY, API_SECRET, PASSPHRASE };

// 如果直接运行，测试API
if (require.main === module) {
    request('/api/v5/account/balance')
        .then(data => console.log(JSON.stringify(data, null, 2)))
        .catch(err => console.error('Error:', err.message));
}
