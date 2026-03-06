const crypto = require('crypto');
const https = require('https');
const fs = require('fs');
const path = require('path');

// 加载 .env 文件
function loadEnv() {
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        envContent.split('\n').forEach(line => {
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match) {
                const key = match[1].trim();
                const value = match[2].trim();
                if (!process.env[key]) {
                    process.env[key] = value;
                }
            }
        });
    }
}

loadEnv();

const API_KEY = process.env.OKX_API_KEY || '';
const API_SECRET = process.env.OKX_SECRET_KEY || '';
const PASSPHRASE = process.env.OKX_PASSPHRASE || '';

function sign(timestamp, method, path, body = '') {
    const message = timestamp + method + path + body;
    return crypto.createHmac('sha256', API_SECRET).update(message).digest('base64');
}

function request(path, method = 'GET', body = null) {
    return new Promise((resolve, reject) => {
        const timestamp = new Date().toISOString();
        const bodyStr = body ? JSON.stringify(body) : '';
        
        // 添加随机参数绕过缓存
        const cacheBuster = `_cb=${Date.now()}`;
        const pathWithCache = path.includes('?') ? `${path}&${cacheBuster}` : `${path}?${cacheBuster}`;
        
        const options = {
            hostname: 'www.okx.com',
            port: 443,
            path: pathWithCache,
            method: method,
            headers: {
                'OK-ACCESS-KEY': API_KEY,
                'OK-ACCESS-SIGN': sign(timestamp, method, pathWithCache, bodyStr),
                'OK-ACCESS-TIMESTAMP': timestamp,
                'OK-ACCESS-PASSPHRASE': PASSPHRASE,
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
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
