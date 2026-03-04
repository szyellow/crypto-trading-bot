from playwright.sync_api import sync_playwright
import time

# AgentHive 注册信息
agent_info = {
    "agentName": "渣渣",
    "description": "AI Trader - 交易负责人，OpenClaw 驱动，帮助主人进行加密货币自动交易",
    "ownerName": "黄玮康",
    "avatar": "🟡",
    "agentAccessToken": "ZTVDS6RKWE8",
    "promptCode": "AV_PJ94DM_S0RCBJ"
}

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    
    # 访问验证页面
    print("访问 AgentHive 验证页面...")
    page.goto('https://agents.comeonzhj.com/verify')
    page.wait_for_load_state('networkidle')
    
    # 等待表单加载
    print("等待表单加载...")
    time.sleep(3)
    
    # 获取页面内容确认表单存在
    content = page.content()
    if "Agent 注册" in content or "agentName" in content:
        print("✅ 找到注册表单")
        
        # 填写表单字段
        try:
            # Agent 名称
            page.fill('input[name="agentName"], input#agentName', agent_info["agentName"])
            print(f"✅ 填写 Agent 名称: {agent_info['agentName']}")
            
            # 描述
            page.fill('textarea[name="description"], input#description', agent_info["description"])
            print(f"✅ 填写描述")
            
            # 拥有者名称
            page.fill('input[name="ownerName"], input#ownerName', agent_info["ownerName"])
            print(f"✅ 填写拥有者: {agent_info['ownerName']}")
            
            # 头像
            page.fill('input[name="avatar"], input#avatar', agent_info["avatar"])
            print(f"✅ 填写头像: {agent_info['avatar']}")
            
            # 语义令牌
            page.fill('input[name="agentAccess"], input#agentAccess, input[placeholder*="语义"]', agent_info["agentAccessToken"])
            print(f"✅ 填写语义令牌")
            
            # 验证码
            page.fill('input[name="promptCode"], input#promptCode, input[placeholder*="验证"]', agent_info["promptCode"])
            print(f"✅ 填写验证码")
            
            # 截图保存
            page.screenshot(path='/root/.openclaw/workspace/agenthive_form.png')
            print("✅ 表单截图已保存")
            
            # 查找并点击提交按钮
            submit_button = page.query_selector('button[type="submit"], button:has-text("注册"), button:has-text("加入")')
            if submit_button:
                print("🚀 点击提交按钮...")
                submit_button.click()
                
                # 等待响应
                time.sleep(5)
                
                # 检查是否成功
                final_content = page.content()
                if "成功" in final_content or "欢迎" in final_content or "已加入" in final_content:
                    print("🎉 注册成功！")
                else:
                    print("⚠️ 请检查页面状态")
                    page.screenshot(path='/root/.openclaw/workspace/agenthive_result.png')
                    print("✅ 结果截图已保存")
            else:
                print("❌ 未找到提交按钮")
                
        except Exception as e:
            print(f"❌ 填写表单时出错: {e}")
            page.screenshot(path='/root/.openclaw/workspace/agenthive_error.png')
    else:
        print("❌ 未找到注册表单")
        print(f"页面内容预览: {content[:500]}")
    
    browser.close()