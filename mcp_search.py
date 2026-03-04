#!/usr/bin/env python3
"""
Boss直聘 MCP 客户端 - 搜索职位
"""
import json
import requests

def call_mcp(method, params=None, session_id=None):
    """调用MCP服务器"""
    url = "http://129.226.216.173:8002/mcp"
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream"
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
    
    response = requests.post(url, headers=headers, json=payload, stream=True, timeout=120)
    content = response.content.decode('utf-8')
    
    print(f"原始响应:\n{content}\n")
    
    # 解析SSE格式 - 可能有多个事件
    results = []
    for line in content.split('\n'):
        if line.startswith('data:'):
            data = line[5:].strip()
            try:
                parsed = json.loads(data)
                results.append(parsed)
            except:
                pass
    
    # 找到包含result的响应
    for r in results:
        if "result" in r:
            return r, response.headers.get('Mcp-Session-Id')
    
    # 返回最后一个结果
    if results:
        return results[-1], response.headers.get('Mcp-Session-Id')
    
    return None, response.headers.get('Mcp-Session-Id')

def main():
    # 1. 初始化
    print("=== 初始化MCP连接 ===")
    result, session_id = call_mcp("initialize", {
        "protocolVersion": "2024-11-05",
        "capabilities": {},
        "clientInfo": {"name": "job-search-client", "version": "1.0.0"}
    })
    print(f"Session ID: {session_id}")
    
    if not session_id:
        print("Failed to get session ID")
        return
    
    # 2. 获取登录信息
    print("\n=== 获取登录信息 ===")
    result, _ = call_mcp("tools/call", {
        "name": "get_login_info_tool",
        "arguments": {}
    }, session_id=session_id)
    
    # 3. 获取推荐职位 - 使用20-50k薪资范围（对应15k以上）
    print("\n=== 搜索职位 (第1页) ===")
    all_jobs = []
    
    for page in range(1, 6):  # 获取5页
        print(f"\n获取第 {page} 页...")
        result, _ = call_mcp("tools/call", {
            "name": "get_recommend_jobs_tool",
            "arguments": {
                "page": page,
                "experience": "不限",
                "job_type": "全职",
                "salary": "20-50k"
            }
        }, session_id=session_id)
        
        if result and "result" in result:
            content = result["result"]
            
            # 解析text字段
            if isinstance(content, list) and len(content) > 0:
                text_content = content[0].get("text", "")
                
                # 尝试解析JSON
                try:
                    jobs_data = json.loads(text_content)
                    if isinstance(jobs_data, list):
                        all_jobs.extend(jobs_data)
                        print(f"第 {page} 页获取到 {len(jobs_data)} 个职位")
                    else:
                        print(f"第 {page} 页数据格式: {type(jobs_data)}")
                        break
                except json.JSONDecodeError as e:
                    print(f"第 {page} 页解析错误: {e}")
                    print(f"内容: {text_content[:500]}")
                    break
        else:
            print(f"第 {page} 页无结果")
            break
    
    print(f"\n总共获取到 {len(all_jobs)} 个职位")
    
    # 4. 过滤珠海和AI产品经理相关职位
    filtered_jobs = []
    for job in all_jobs:
        job_title = job.get("job_name", "").lower()
        city = job.get("city", "").lower()
        
        # 检查是否是AI产品经理相关职位且在珠海
        is_pm = "产品经理" in job.get("job_name", "")
        is_ai = "ai" in job_title or "人工智能" in job_title or "aigc" in job_title or "大模型" in job_title
        is_zhuhai = "珠海" in city
        
        if is_pm and (is_ai or True) and is_zhuhai:  # 放宽条件，只要是珠海的产品经理
            filtered_jobs.append(job)
    
    print(f"珠海产品经理职位: {len(filtered_jobs)} 个")
    
    # 5. 保存结果
    output = {
        "search_params": {
            "query": "AI产品经理",
            "city": "珠海",
            "salary": "15k以上"
        },
        "search_date": "2026-02-28",
        "total_jobs": len(all_jobs),
        "zhuhai_pm_jobs_count": len(filtered_jobs),
        "all_jobs": all_jobs,
        "zhuhai_pm_jobs": filtered_jobs
    }
    
    with open("/root/.openclaw/workspace/job_search_result.json", "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    
    print(f"\n✓ 结果已保存到 job_search_result.json")
    print(f"  - 总职位数: {len(all_jobs)}")
    print(f"  - 珠海产品经理职位: {len(filtered_jobs)}")

if __name__ == "__main__":
    main()
