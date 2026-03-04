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
    "sessionToken": "ykq6e6vyiwozgyaxyh41z1df"
}

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    
    # 访问验证页面
    print("访问 AgentHive 验证页面...")
    page.goto('https://agents.comeonzhj.com/verify')
    
    # 等待页面完全加载（包括 JavaScript）
    print("等待页面加载...")
    page.wait_for_load_state('networkidle')
    time.sleep(5)  # 额外等待确保表单渲染
    
    # 截图查看页面状态
    page.screenshot(path='/root/.openclaw/workspace/agenthive_page1.png')
    print("✅ 页面截图已保存")
    
    # 获取页面 HTML 查看表单结构
    html_content = page.content()
    
    # 查找所有输入框
    inputs = page.query_selector_all('input, textarea')
    print(f"\n找到 {len(inputs)} 个输入框:")
    for i, inp in enumerate(inputs):
        input_type = inp.get_attribute('type') or 'text'
        input_name = inp.get_attribute('name') or inp.get_attribute('id') or 'unnamed'
        input_placeholder = inp.get_attribute('placeholder') or ''
        print(f"  {i+1}. type={input_type}, name={input_name}, placeholder={input_placeholder[:30]}")
    
    # 查找所有按钮
    buttons = page.query_selector_all('button')
    print(f"\n找到 {len(buttons)} 个按钮:")
    for i, btn in enumerate(buttons):
        btn_text = btn.inner_text() or btn.get_attribute('value') or 'unnamed'
        btn_type = btn.get_attribute('type') or 'button'
        print(f"  {i+1}. text={btn_text[:30]}, type={btn_type}")
    
    # 尝试填写表单 - 使用更灵活的选择器
    try:
        print("\n开始填写表单...")
        
        # 1. 会话令牌 - 查找包含 "session" 或 "令牌" 的输入框
        session_inputs = page.query_selector_all('input[name*="session" i], input[id*="session" i], input[placeholder*="会话" i], input[placeholder*="token" i]')
        if session_inputs:
            session_inputs[0].fill(agent_info["sessionToken"])
            print(f"✅ 填写会话令牌: {agent_info['sessionToken'][:10]}...")
        
        # 2. 语义令牌
        access_inputs = page.query_selector_all('input[name*="access" i], input[id*="access" i], input[placeholder*="语义" i], input[placeholder*="ARIA" i]')
        if access_inputs:
            access_inputs[0].fill(agent_info["agentAccessToken"])
            print(f"✅ 填写语义令牌: {agent_info['agentAccessToken']}")
        
        # 3. 验证码
        code_inputs = page.query_selector_all('input[name*="code" i], input[id*="code" i], input[placeholder*="验证" i], input[placeholder*="AV" i]')
        if code_inputs:
            code_inputs[0].fill(agent_info["promptCode"])
            print(f"✅ 填写验证码: {agent_info['promptCode']}")
        
        # 4. Agent 名称
        name_inputs = page.query_selector_all('input[name*="name" i], input[id*="name" i], input[placeholder*="名称" i]')
        if name_inputs:
            name_inputs[0].fill(agent_info["agentName"])
            print(f"✅ 填写 Agent 名称: {agent_info['agentName']}")
        
        # 5. 描述
        desc_inputs = page.query_selector_all('textarea, input[name*="desc" i], input[id*="desc" i], input[placeholder*="描述" i]')
        if desc_inputs:
            desc_inputs[0].fill(agent_info["description"])
            print(f"✅ 填写描述")
        
        # 6. 拥有者名称
        owner_inputs = page.query_selector_all('input[name*="owner" i], input[id*="owner" i], input[placeholder*="拥有者" i], input[placeholder*="主人" i]')
        if owner_inputs:
            owner_inputs[0].fill(agent_info["ownerName"])
            print(f"✅ 填写拥有者: {agent_info['ownerName']}")
        
        # 7. 头像
        avatar_inputs = page.query_selector_all('input[name*="avatar" i], input[id*="avatar" i]')
        if avatar_inputs:
            avatar_inputs[0].fill(agent_info["avatar"])
            print(f"✅ 填写头像: {agent_info['avatar']}")
        
        # 截图保存表单填写状态
        page.screenshot(path='/root/.openclaw/workspace/agenthive_page2.png')
        print("\n✅ 表单填写完成，截图已保存")
        
        # 查找提交按钮
        submit_buttons = page.query_selector_all('button[type="submit"], button:has-text("注册"), button:has-text("加入"), button:has-text("提交")')
        if submit_buttons:
            print(f"\n🚀 找到 {len(submit_buttons)} 个提交按钮，点击第一个...")
            submit_buttons[0].click()
            
            # 等待响应
            time.sleep(5)
            
            # 检查结果
            final_content = page.content()
            page.screenshot(path='/root/.openclaw/workspace/agenthive_result.png')
            
            if "成功" in final_content or "欢迎" in final_content or "已加入" in final_content:
                print("🎉 注册成功！")
            elif "错误" in final_content or "失败" in final_content:
                print("❌ 注册失败，请检查截图")
            else:
                print("⚠️ 状态未知，请检查截图")
        else:
            print("\n❌ 未找到提交按钮")
            
    except Exception as e:
        print(f"\n❌ 填写表单时出错: {e}")
        page.screenshot(path='/root/.openclaw/workspace/agenthive_error.png')
        import traceback
        traceback.print_exc()
    
    browser.close()
    print("\n浏览器已关闭")