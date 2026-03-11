// twitter-search.js - 使用Twitter API v2搜索用户
const https = require('https');

// Twitter API凭证
const CONSUMER_KEY = 'XhEPFwb7XAtpTVv6onQn3jAzJ';
const CONSUMER_SECRET = 'UUhWSAOb2nKMMPnwssFPG0tK9YCaftaCEqCaQul6zINpWc0vCl';
const ACCESS_TOKEN = '1110389383218126848-suSS1SWf0ZiSr73I7wJaTJaEW4X7Uq';
const ACCESS_TOKEN_SECRET = 'gmm9tfhuaZHKTdCn07FdOEuRdLruUgIhCuVXHNhSFmG00';

// 获取Bearer Token
function getBearerToken() {
    const credentials = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString('base64');
    
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.twitter.com',
            path: '/oauth2/token',
            method: 'POST',
            headers: {
                'Authorization': `Basic ${credentials}`,
                'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
            }
        };
        
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve(json.access_token);
                } catch (e) {
                    reject(new Error('Failed to parse token response'));
                }
            });
        });
        
        req.on('error', reject);
        req.write('grant_type=client_credentials');
        req.end();
    });
}

// 搜索用户
function searchUser(username, bearerToken) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.twitter.com',
            path: `/2/users/by/username/${username}?user.fields=description,public_metrics,created_at`,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${bearerToken}`
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
                    reject(new Error('Failed to parse user response'));
                }
            });
        });
        
        req.on('error', reject);
        req.end();
    });
}

// 获取用户推文
function getUserTweets(userId, bearerToken) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.twitter.com',
            path: `/2/users/${userId}/tweets?max_results=10&tweet.fields=created_at,public_metrics`,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${bearerToken}`
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
                    reject(new Error('Failed to parse tweets response'));
                }
            });
        });
        
        req.on('error', reject);
        req.end();
    });
}

// 主函数
async function main() {
    try {
        console.log('🔍 正在获取Twitter API访问令牌...');
        const bearerToken = await getBearerToken();
        console.log('✅ 获取成功！\n');
        
        console.log('🔍 正在搜索用户 @puff_2002...');
        const user = await searchUser('puff_2002', bearerToken);
        
        if (user.errors) {
            console.log('❌ 错误:', user.errors[0].detail);
            return;
        }
        
        if (!user.data) {
            console.log('❌ 未找到用户数据');
            console.log('响应:', JSON.stringify(user, null, 2));
            return;
        }
        
        console.log('✅ 找到用户！\n');
        console.log('📊 用户信息:');
        console.log(`  用户名: @${user.data.username}`);
        console.log(`  显示名: ${user.data.name}`);
        console.log(`  简介: ${user.data.description || '无'}`);
        console.log(`  粉丝数: ${user.data.public_metrics?.followers_count || 'N/A'}`);
        console.log(`  关注数: ${user.data.public_metrics?.following_count || 'N/A'}`);
        console.log(`  推文数: ${user.data.public_metrics?.tweet_count || 'N/A'}`);
        console.log(`  创建时间: ${user.data.created_at || 'N/A'}\n`);
        
        console.log('🔍 正在获取最近推文...');
        const tweets = await getUserTweets(user.data.id, bearerToken);
        
        if (tweets.data && tweets.data.length > 0) {
            console.log(`✅ 找到 ${tweets.data.length} 条推文:\n`);
            tweets.data.forEach((tweet, index) => {
                console.log(`${index + 1}. ${tweet.text.substring(0, 100)}${tweet.text.length > 100 ? '...' : ''}`);
                console.log(`   时间: ${tweet.created_at}`);
                console.log(`   点赞: ${tweet.public_metrics?.like_count || 0} | 转发: ${tweet.public_metrics?.retweet_count || 0}\n`);
            });
        } else {
            console.log('⚠️ 未找到推文或推文受保护');
        }
        
    } catch (error) {
        console.error('❌ 错误:', error.message);
    }
}

main();
