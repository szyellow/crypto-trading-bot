#!/usr/bin/env python3
"""
Boss直聘扫码登录诊断脚本
用于检查二维码生成和扫码流程
"""

import requests
import json
import time
import base64
from urllib.parse import urlparse

def test_server():
    """测试服务器基本连接"""
    print("=" * 60)
    print("Boss直聘 MCP Server 诊断报告")
    print("=" * 60)
    print()
    
    base_url = "http://129.226.216.173:8002"
    
    # 1. 测试静态页面
    print("【1】测试静态页面访问...")
    try:
        resp = requests.get(f"{base_url}/static/", timeout=10)
        print(f"   状态码: {resp.status_code}")
        print(f"   内容长度: {len(resp.text)} 字节")
        print(f"   ✓ 静态页面访问正常")
    except Exception as e:
        print(f"   ✗ 静态页面访问失败: {e}")
    print()
    
    # 2. 测试MCP端点
    print("【2】测试MCP端点...")
    try:
        resp = requests.post(
            f"{base_url}/mcp",
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json, text/event-stream"
            },
            json={
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {},
                    "clientInfo": {"name": "test", "version": "1.0"}
                }
            },
            timeout=10
        )
        print(f"   状态码: {resp.status_code}")
        session_id = resp.headers.get('mcp-session-id', '未获取')
        print(f"   Session ID: {session_id}")
        print(f"   ✓ MCP端点正常")
    except Exception as e:
        print(f"   ✗ MCP端点访问失败: {e}")
        session_id = None
    print()
    
    # 3. 测试登录API - 生成二维码
    print("【3】测试登录API - 生成二维码...")
    qr_info = None
    try:
        resp = requests.post(
            f"{base_url}/api/login/start",
            headers={"Content-Type": "application/json"},
            json={},
            timeout=10
        )
        qr_info = resp.json()
        print(f"   状态: {qr_info.get('status')}")
        print(f"   QR ID: {qr_info.get('qr_id')}")
        print(f"   图片URL: {qr_info.get('image_url')}")
        print(f"   登录步骤: {qr_info.get('login_step')}")
        print(f"   ✓ 二维码生成成功")
    except Exception as e:
        print(f"   ✗ 二维码生成失败: {e}")
    print()
    
    # 4. 测试二维码图片访问
    print("【4】测试二维码图片访问...")
    if qr_info and qr_info.get('image_url'):
        try:
            resp = requests.get(qr_info['image_url'], timeout=10)
            print(f"   状态码: {resp.status_code}")
            print(f"   内容类型: {resp.headers.get('content-type')}")
            print(f"   图片大小: {len(resp.content)} 字节")
            
            # 检查图片内容
            if resp.content[:2] == b'\xff\xd8':
                print(f"   图片格式: JPEG (正确)")
            elif resp.content[:4] == b'\x89PNG':
                print(f"   图片格式: PNG (正确)")
            else:
                print(f"   ⚠ 图片格式异常: {resp.content[:4]}")
            print(f"   ✓ 二维码图片可访问")
        except Exception as e:
            print(f"   ✗ 二维码图片访问失败: {e}")
    print()
    
    # 5. 测试登录状态API
    print("【5】测试登录状态API...")
    try:
        resp = requests.get(f"{base_url}/api/login/status", timeout=10)
        status_info = resp.json()
        print(f"   已登录: {status_info.get('is_logged_in')}")
        print(f"   登录步骤: {status_info.get('login_step')}")
        print(f"   错误信息: {status_info.get('error_message')}")
        print(f"   ✓ 登录状态API正常")
    except Exception as e:
        print(f"   ✗ 登录状态API访问失败: {e}")
    print()
    
    # 6. 分析可能的问题
    print("=" * 60)
    print("【诊断分析】")
    print("=" * 60)
    
    issues = []
    recommendations = []
    
    # 检查二维码内容
    if qr_info and qr_info.get('qr_id'):
        qr_id = qr_info['qr_id']
        # 检查QR ID格式
        if not qr_id.startswith('bosszp-'):
            issues.append("QR ID格式异常，可能不是Boss直聘的二维码")
        
    # 检查图片URL
    if qr_info and qr_info.get('image_url'):
        image_url = qr_info['image_url']
        parsed = urlparse(image_url)
        if parsed.hostname == '129.226.216.173':
            issues.append("二维码图片使用IP地址访问，可能存在跨域或安全限制")
            recommendations.append("建议检查Boss直聘APP是否允许扫描非HTTPS的二维码")
    
    # 输出诊断结果
    if issues:
        print("\n发现的问题:")
        for i, issue in enumerate(issues, 1):
            print(f"  {i}. {issue}")
    else:
        print("\n✓ 未发现明显配置问题")
    
    if recommendations:
        print("\n建议:")
        for i, rec in enumerate(recommendations, 1):
            print(f"  {i}. {rec}")
    
    print("\n" + "=" * 60)
    print("【可能的原因分析】")
    print("=" * 60)
    print("""
1. **Boss直聘风控拦截**
   - 服务器IP可能被Boss直聘标记
   - 频繁请求导致临时封禁
   - 建议：等待一段时间再试，或更换服务器IP

2. **二维码过期**
   - 二维码有效期只有60秒
   - 用户扫描时可能已过期
   - 建议：确保在生成后尽快扫描

3. **APP版本问题**
   - 旧版本APP可能不支持某些二维码格式
   - 建议：更新Boss直聘APP到最新版本

4. **网络问题**
   - 服务器与Boss直聘API通信异常
   - 建议：检查服务器网络连接

5. **扫码方式问题**
   - 必须使用Boss直聘APP内置的扫一扫功能
   - 不能使用微信或其他扫码工具
""")

if __name__ == "__main__":
    test_server()
