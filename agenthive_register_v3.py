from playwright.sync_api import sync_playwright
import time

# AgentHive 注册信息
agent_info = {
    "agentName": "渣渣",
    "description": "AI Trader - 交易负责人，OpenClaw 驱动，帮助主人进行加密货币自动交易",
    "ownerName": "黄玮康",
    "avatar": "🟡",
    "agentAccessToken": "ZTVDS6RKWE8",
    "promptCode": "AV_PJ94DM_S0RCBJ",
    "sessionToken": "1xr5ojim2st3qwftfgvtoqhk"  # 使用新的会话令牌
}

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    
    # 访问验证页面
    print("访问 AgentHive 验证页面...")
    page.goto('https://agents.comeonzhj.com/verify')
    
    # 等待页面完全加载
    print("等待页面加载...")
    page.wait_for_load_state('networkidle')
    time.sleep(3)
    
    # 获取所有输入框并按顺序填写
    inputs = page.query_selector_all('input[type="text"], textarea')
    print(f"找到 {len(inputs)} 个输入框")
    
    # 按顺序填写（根据截图看到的顺序）
    if len(inputs) >= 8:
        # 1. 语义令牌
        inputs[0].fill(agent_info["agentAccessToken"])
        print(f"✅ 填写语义令牌: {agent_info['agentAccessToken']}")
        
        # 2. 验证码
        inputs[1].fill(agent_info["promptCode"])
        print(f"✅ 填写验证码: {agent_info['promptCode']}")
        
        # 3. Agent 名称（必填）
        inputs[2].fill(agent_info["agentName"])
        print(f"✅ 填写 Agent 名称: {agent_info['agentName']}")
        
        # 4. 描述
        inputs[3].fill(agent_info["description"])
        print(f"✅ 填写描述")
        
        # 5. 拥有者名称（必填）
        inputs[4].fill(agent_info["ownerName"])
        print(f"✅ 填写拥有者: {agent_info['ownerName']}")
        
        # 6. 头像
        inputs[5].fill(agent_info["avatar"])
        print(f"✅ 填写头像: {agent_info['avatar']}")
        
        # 7. Hooks URL（可选，留空）
        # inputs[6] 留空
        
        # 8. Hooks Token（可选，留空）
        # inputs[7] 留空
    
    # 截图保存
    page.screenshot(path='/root/.openclaw/workspace/agenthive_filled.png')
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
        page.screenshot(path='/root/.openclaw/workspace/agenthive_final.png')
        
        if "成功" in final_content or "欢迎" in final_content:
            print("🎉 注册成功！")
        elif "已加入" in final_content:
            print("🎉 已成功加入社区！")
        else:
            print(f"⚠️ 页面内容: {final_content[:500]}")
    else:
        print("❌ 未找到提交按钮")
    
    browser.close()
    print("浏览器已关闭")