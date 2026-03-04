#!/usr/bin/env python3
"""
Boss直聘扫码流程深度诊断
模拟扫码过程并监控状态变化
"""

import requests
import json
import time
import sys

def monitor_login_flow():
    """监控完整的登录流程"""
    base_url = "http://129.226.216.173:8002"
    
    print("=" * 70)
    print("Boss直聘扫码登录流程监控")
    print("=" * 70)
    print()
    print("此脚本将持续监控登录状态变化，帮助诊断扫码失败原因")
    print("请在运行此脚本后，立即使用Boss直聘APP扫描二维码")
    print()
    
    # 步骤1: 生成二维码
    print("【步骤1】正在生成二维码...")
    try:
        resp = requests.post(
            f"{base_url}/api/login/start",
            headers={"Content-Type": "application/json"},
            json={},
            timeout=10
        )
        qr_info = resp.json()
        
        if qr_info.get('status') != 'success':
            print(f"   ✗ 二维码生成失败: {qr_info.get('message')}")
            return
            
        qr_id = qr_info.get('qr_id')
        image_url = qr_info.get('image_url')
        print(f"   ✓ 二维码生成成功")
        print(f"   QR ID: {qr_id}")
        print(f"   图片URL: {image_url}")
        print()
        
    except Exception as e:
        print(f"   ✗ 请求失败: {e}")
        return
    
    # 步骤2: 持续监控状态
    print("【步骤2】开始监控登录状态（最多监控90秒）...")
    print(f"   请在60秒内使用Boss直聘APP扫描二维码")
    print(f"   二维码URL: {image_url}")
    print()
    print("-" * 70)
    
    start_time = time.time()
    last_step = None
    scan_detected = False
    
    while time.time() - start_time < 90:
        try:
            resp = requests.get(f"{base_url}/api/login/status", timeout=5)
            status = resp.json()
            
            current_step = status.get('login_step')
            is_logged_in = status.get('is_logged_in')
            error_msg = status.get('error_message')
            
            # 只在状态变化时输出
            if current_step != last_step:
                elapsed = int(time.time() - start_time)
                timestamp = f"[{elapsed}s]"
                
                if current_step == 'qr_generated':
                    print(f"{timestamp} 状态: 二维码已生成，等待扫码...")
                elif current_step == 'scanned':
                    print(f"{timestamp} 状态: ✓ 已检测到扫码！等待手机确认...")
                    scan_detected = True
                elif current_step == 'security_check':
                    print(f"{timestamp} 状态: 正在进行安全验证...")
                elif current_step == 'logged_in':
                    print(f"{timestamp} 状态: ✓✓✓ 登录成功！")
                    print()
                    print("=" * 70)
                    print("【登录成功】")
                    print("=" * 70)
                    if status.get('cookies_detail'):
                        print(f"Cookie信息: {json.dumps(status.get('cookies_detail'), indent=2, ensure_ascii=False)}")
                    return
                elif current_step == 'error':
                    print(f"{timestamp} 状态: ✗ 登录出错")
                    if error_msg:
                        print(f"   错误信息: {error_msg}")
                else:
                    print(f"{timestamp} 状态: {current_step}")
                
                last_step = current_step
            
            # 检查是否已登录
            if is_logged_in:
                print()
                print("=" * 70)
                print("【登录成功】")
                print("=" * 70)
                return
                
        except Exception as e:
            print(f"   [错误] 获取状态失败: {e}")
        
        time.sleep(2)
    
    # 超时
    print()
    print("-" * 70)
    print("【监控结束】90秒超时")
    print("-" * 70)
    
    if not scan_detected:
        print()
        print("=" * 70)
        print("【诊断结论】")
        print("=" * 70)
        print("""
在90秒的监控期间，未检测到任何扫码行为。

可能的原因：

1. **Boss直聘APP无法识别二维码**
   - 二维码内容格式可能不正确
   - APP版本过旧，不支持当前二维码格式
   - 二维码使用了非标准的编码方式

2. **服务器IP被Boss直聘封禁**
   - 该IP可能因频繁请求被标记为异常
   - 建议更换服务器IP或等待24小时后再试

3. **网络通信问题**
   - 服务器无法与Boss直聘API正常通信
   - 可能是DNS解析问题或网络防火墙

4. **二维码内容问题**
   - 二维码中可能包含错误的数据格式
   - 需要检查二维码生成的后端代码

建议的排查步骤：

1. 使用二维码扫描工具（如微信扫一扫）查看二维码内容
   - 正常应该包含类似 "bosszp://..." 的URL
   - 如果内容异常，说明生成逻辑有问题

2. 检查服务器日志
   - 查看是否有来自Boss直聘的请求
   - 检查是否有API调用错误

3. 尝试使用不同的网络环境
   - 如果可能，更换服务器IP地址
   - 检查服务器是否能正常访问Boss直聘官网

4. 联系Boss直聘技术支持
   - 询问是否有IP封禁或API限制
""")
    else:
        print("\n已检测到扫码，但未完成登录流程。")
        print("可能原因：用户在手机上取消了登录确认")

def check_qr_content():
    """检查二维码图片内容"""
    print()
    print("=" * 70)
    print("【附加检查】二维码内容分析")
    print("=" * 70)
    
    base_url = "http://129.226.216.173:8002"
    
    # 获取最新的二维码
    try:
        resp = requests.post(
            f"{base_url}/api/login/start",
            headers={"Content-Type": "application/json"},
            json={},
            timeout=10
        )
        qr_info = resp.json()
        image_url = qr_info.get('image_url')
        
        # 下载二维码图片
        resp = requests.get(image_url, timeout=10)
        
        # 尝试使用pyzbar解码
        try:
            from pyzbar.pyzbar import decode
            from PIL import Image
            import io
            
            image = Image.open(io.BytesIO(resp.content))
            decoded = decode(image)
            
            if decoded:
                for obj in decoded:
                    print(f"二维码类型: {obj.type}")
                    print(f"二维码内容: {obj.data.decode('utf-8')}")
                    
                    # 分析内容
                    content = obj.data.decode('utf-8')
                    if 'boss' in content.lower() or 'zhipin' in content.lower():
                        print("✓ 二维码内容包含Boss直聘相关标识")
                    else:
                        print("⚠ 二维码内容可能不是Boss直聘的登录二维码")
                        print(f"  内容: {content}")
            else:
                print("✗ 无法解码二维码（可能需要安装zbar库）")
                print("  尝试安装: apt-get install libzbar0")
                
        except ImportError:
            print("⚠ 未安装pyzbar库，无法解码二维码")
            print("  安装命令: pip install pyzbar pillow")
            print("  系统依赖: apt-get install libzbar0")
            
    except Exception as e:
        print(f"检查失败: {e}")

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == '--check-qr':
        check_qr_content()
    else:
        monitor_login_flow()
        print()
        print("\n提示: 运行 'python3 boss_monitor.py --check-qr' 可以分析二维码内容")
