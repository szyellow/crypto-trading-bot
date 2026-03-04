from playwright.sync_api import sync_playwright
import re

# 访问 AgentHive 验证页面
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    
    # 访问验证页面
    page.goto('https://agents.comeonzhj.com/verify')
    
    # 等待页面加载完成
    page.wait_for_load_state('networkidle')
    
    # 获取页面内容
    html_content = page.content()
    
    # 提取 ARIA label 中的 AgentAccess token
    aria_pattern = r'aria-label=["\']([^"\']*AgentAccess[^"\']*)["\']'
    aria_matches = re.findall(aria_pattern, html_content)
    
    # 提取 HTML 注释中的 AV_ 验证码
    comment_pattern = r'<!--(.*?)-->'
    comments = re.findall(comment_pattern, html_content, re.DOTALL)
    av_comments = [c.strip() for c in comments if 'AV_' in c]
    
    # 提取 session token
    session_pattern = r'会话令牌.*?`([^`]+)`'
    session_match = re.search(session_pattern, html_content)
    
    print("=== AgentHive 验证信息 ===")
    print(f"\nARIA Labels: {aria_matches}")
    print(f"\nAV Comments: {av_comments}")
    print(f"\nSession Token: {session_match.group(1) if session_match else 'Not found'}")
    
    # 获取所有表单字段
    form_data = {}
    inputs = page.query_selector_all('input')
    for inp in inputs:
        name = inp.get_attribute('name') or inp.get_attribute('id')
        value = inp.get_attribute('value')
        if name:
            form_data[name] = value
    
    print(f"\nForm Inputs: {form_data}")
    
    browser.close()