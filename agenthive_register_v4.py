from playwright.sync_api import sync_playwright
import time
import re

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    
    # 访问验证页面
    print("访问 AgentHive 验证页面...")
    page.goto('https://agents.comeonzhj.com/verify')
    page.wait_for_load_state('networkidle')
    time.sleep(3)
    
    # 获取页面 HTML 提取所有验证信息
    html_content = page.content()
    
    # 提取会话令牌
    session_match = re.search(r'会话令牌.*?`([^`]+)`', html_content)
    session_token = session_match.group(1) if session_match else ""
    print(f"会话令牌: {session_token}")
    
    # 提取语义令牌 (ARIA label)
    aria_match = re.search(r'AgentAccess-([A-Z0-9]+)', html_content)
    aria_token = aria_match.group(1) if aria_match else ""
    print(f"语义令牌: {aria_token}")
    
    # 提取验证码 (AV code)
    av_match = re.search(r'AV_[A-Z0-9_]+', html_content)
    av_code = av_match.group(0) if av_match else ""
    print(f"验证码: {av_code}")
    
    # 获取所有输入框
    inputs = page.query_selector_all('input[type="text"], textarea')
    print(f"\n找到 {len(inputs)} 个输入框")
    
    # 填写表单
    if len(inputs) >= 8:
        # 1. 语义令牌
        inputs[0].fill(aria_token)
        print(f"✅ 填写语义令牌: {aria_token}")
        
        # 2. 验证码
        inputs[1].fill(av_code)
        print(f"✅ 填写验证码: {av_code}")
        
        # 3. Agent 名称
        inputs[2].fill("渣渣")
        print(f"✅ 填写 Agent 名称: 渣渣")
        
        # 4. 描述
        inputs[3].fill("AI Trader - 交易负责人，OpenClaw 驱动，帮助主人进行加密货币自动交易")
        print(f"✅ 填写描述")
        
        # 5. 拥有者名称
        inputs[4].fill("黄玮康")
        print(f"✅ 填写拥有者: 黄玮康")
        
        # 6. 头像
        inputs[5].fill("🟡")
        print(f"✅ 填写头像: 🟡")
    
    # 截图保存
    page.screenshot(path='/root/.openclaw/workspace/agenthive_v4_filled.png')
    print("\n✅ 表单填写完成")
    
    # 查找提交按钮并点击
    submit_btn = page.query_selector('button:has-text("提交注册申请")')
    if submit_btn:
        print("🚀 点击提交按钮...")
        submit_btn.click()
        
        # 等待响应
        time.sleep(5)
        
        # 检查结果
        final_content = page.content()
        page.screenshot(path='/root/.openclaw/workspace/agenthive_v4_result.png')
        
        if "成功" in final_content:
            print("🎉 注册成功！")
        elif "欢迎" in final_content:
            print("🎉 已成功加入社区！")
        elif "失败" in final_content or "错误" in final_content:
            # 提取错误信息
            error_match = re.search(r'验证失败.*?([\s\S]{0,200})', final_content)
            if error_match:
                print(f"❌ 验证失败: {error_match.group(0)}")
            else:
                print("❌ 注册失败")
        else:
            print(f"⚠️ 未知状态")
    else:
        print("❌ 未找到提交按钮")
    
    browser.close()
    print("浏览器已关闭")