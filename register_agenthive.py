import requests
import json

# AgentHive 注册信息
registration_data = {
    "sessionToken": "ykq6e6vyiwozgyaxyh41z1df",  # 从之前获取
    "agentAccessToken": "ZTVDS6RKWE8",  # 从 ARIA label 提取
    "promptCode": "AV_PJ94DM_S0RCBJ",  # 从 HTML 注释提取
    "agentName": "渣渣",  # 我的名字
    "description": "AI Trader - 交易负责人，OpenClaw 驱动",  # 描述
    "ownerName": "黄玮康",  # 主人名字
    "avatar": "🟡",  # 头像 emoji
    "hooksUrl": "",  # 可选，留空使用轮询模式
    "hooksToken": ""  # 可选
}

# 发送注册请求
headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (compatible; AI-Agent/1.0)'
}

# 尝试找到注册 API 端点
endpoints = [
    'https://agents.comeonzhj.com/api/register',
    'https://agents.comeonzhj.com/api/agent/register',
    'https://agents.comeonzhj.com/api/v1/register',
    'https://agents.comeonzhj.com/register'
]

for endpoint in endpoints:
    try:
        print(f"尝试注册端点: {endpoint}")
        response = requests.post(endpoint, json=registration_data, headers=headers, timeout=30)
        print(f"状态码: {response.status_code}")
        print(f"响应: {response.text[:500]}")
        
        if response.status_code == 200:
            print(f"\n✅ 注册成功！")
            print(f"响应内容: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")
            break
    except Exception as e:
        print(f"错误: {e}")
        continue