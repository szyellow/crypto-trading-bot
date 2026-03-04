#!/usr/bin/env python3
"""
Boss直聘 MCP 客户端 - 用于搜索职位
"""
import json
import requests
import sys

def call_mcp_stream(method, params=None, session_id=None):
    """调用MCP服务器并处理SSE流"""
    url = "http://129.226.216.173:8002/mcp"
    headers = {
        "Content-Type": "application/json",
        "Accept": "text/event-stream"
    }
    if session_id:
        headers["Mcp-Session-Id"] = session_id
    
    payload = {
        "jsonrpc": "2.0",
        "method": method,
        "id": 1
    }
    if params:
        payload["params"] = params
    
    try:
        response = requests.post(url, headers=headers, json=payload, stream=True, timeout=30)
        
        # 获取session ID
        new_session_id = response.headers.get('Mcp-Session-Id')
        
        # 手动解析SSE
        buffer = ""
        for chunk in response.iter_content(chunk_size=1024, decode_unicode=True):
            buffer += chunk
            while '\n\n' in buffer:
                event_data, buffer = buffer.split('\n\n', 1)
                lines = event_data.strip().split('\n')
                event_type = None
                data = None
                for line in lines:
                    if line.startswith('event:'):
                        event_type = line[6:].strip()
                    elif line.startswith('data:'):
                        data = line[5:].strip()
                
                if data and event_type == 'message':
                    try:
                        result = json.loads(data)
                        return result, new_session_id
                    except json.JSONDecodeError as e:
                        print(f"JSON解析错误: {e}, data: {data}")
                        continue
        return None, new_session_id
    except Exception as e:
        print(f"Error: {e}")
        return None, None

def main():
    session_id = None
    
    # 1. 初始化
    print("=== 初始化MCP连接 ===")
    result, session_id = call_mcp_stream("initialize", {
        "protocolVersion": "2024-11-05",
        "capabilities": {},
        "clientInfo": {"name": "job-search-client", "version": "1.0.0"}
    })
    print(f"初始化结果: {json.dumps(result, ensure_ascii=False, indent=2) if result else 'None'}")
    print(f"Session ID: {session_id}")
    
    if not session_id:
        print("Failed to get session ID")
        sys.exit(1)
    
    # 2. 获取工具列表
    print("\n=== 获取工具列表 ===")
    result, _ = call_mcp_stream("tools/list", session_id=session_id)
    print(f"工具列表: {json.dumps(result, ensure_ascii=False, indent=2) if result else 'None'}")
    
    if result and "result" in result and "tools" in result["result"]:
        print("\n可用工具:")
        for tool in result["result"]["tools"]:
            print(f"  - {tool.get('name', 'N/A')}: {tool.get('description', 'N/A')}")
    
    # 3. 搜索职位
    print("\n=== 搜索职位 ===")
    search_params = {
        "name": "search_jobs",
        "arguments": {
            "query": "AI产品经理",
            "city": "珠海",
            "salary": "15k以上"
        }
    }
    result, _ = call_mcp_stream("tools/call", search_params, session_id=session_id)
    print(f"搜索结果: {json.dumps(result, ensure_ascii=False, indent=2) if result else 'None'}")
    
    # 保存结果
    if result:
        output_data = result.get("result", result)
        with open("/root/.openclaw/workspace/job_search_result.json", "w", encoding="utf-8") as f:
            json.dump(output_data, f, ensure_ascii=False, indent=2)
        print("\n结果已保存到 job_search_result.json")
    else:
        print("\n没有获取到搜索结果")

if __name__ == "__main__":
    main()
