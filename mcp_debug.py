#!/usr/bin/env python3
"""
Boss直聘 MCP 客户端 - 调试版本
"""
import json
import requests

def debug_mcp():
    url = "http://129.226.216.173:8002/mcp"
    
    # 1. 初始化
    print("=== 初始化MCP连接 ===")
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream"
    }
    payload = {
        "jsonrpc": "2.0",
        "method": "initialize",
        "id": 0,
        "params": {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {"name": "job-search-client", "version": "1.0.0"}
        }
    }
    
    response = requests.post(url, headers=headers, json=payload, stream=True, timeout=30)
    session_id = response.headers.get('Mcp-Session-Id')
    print(f"Session ID: {session_id}")
    print(f"Content-Type: {response.headers.get('content-type')}")
    
    # 读取原始响应
    content = response.content.decode('utf-8')
    print(f"响应内容:\n{content[:2000]}")
    
    # 解析JSON响应
    try:
        result = json.loads(content)
        print(f"\n解析结果: {json.dumps(result, ensure_ascii=False, indent=2)}")
    except:
        pass
    
    return session_id

def list_tools(session_id):
    url = "http://129.226.216.173:8002/mcp"
    
    print("\n=== 获取工具列表 ===")
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
        "Mcp-Session-Id": session_id
    }
    payload = {
        "jsonrpc": "2.0",
        "method": "tools/list",
        "id": 1
    }
    
    response = requests.post(url, headers=headers, json=payload, stream=True, timeout=30)
    content = response.content.decode('utf-8')
    print(f"响应内容:\n{content[:3000]}")
    
    try:
        result = json.loads(content)
        print(f"\n解析结果: {json.dumps(result, ensure_ascii=False, indent=2)[:2000]}")
        return result
    except:
        return None

def search_jobs(session_id):
    url = "http://129.226.216.173:8002/mcp"
    
    print("\n=== 搜索职位 ===")
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
        "Mcp-Session-Id": session_id
    }
    payload = {
        "jsonrpc": "2.0",
        "method": "tools/call",
        "id": 2,
        "params": {
            "name": "search_jobs",
            "arguments": {
                "query": "AI产品经理",
                "city": "珠海",
                "salary": "15k以上"
            }
        }
    }
    
    response = requests.post(url, headers=headers, json=payload, stream=True, timeout=120)
    content = response.content.decode('utf-8')
    print(f"响应内容长度: {len(content)}")
    print(f"响应内容:\n{content[:5000]}")
    
    try:
        result = json.loads(content)
        print(f"\n解析结果: {json.dumps(result, ensure_ascii=False, indent=2)[:3000]}")
        return result
    except Exception as e:
        print(f"解析错误: {e}")
        return None

if __name__ == "__main__":
    session_id = debug_mcp()
    if session_id:
        tools = list_tools(session_id)
        search_result = search_jobs(session_id)
        
        # 保存结果
        if search_result and "result" in search_result:
            output = search_result["result"]
            # 如果是文本内容，可能需要进一步解析
            if isinstance(output, str):
                try:
                    output = json.loads(output)
                except:
                    pass
            
            with open("/root/.openclaw/workspace/job_search_result.json", "w", encoding="utf-8") as f:
                json.dump(output, f, ensure_ascii=False, indent=2)
            print("\n✓ 结果已保存到 job_search_result.json")
        else:
            print("\n未能获取有效结果")
