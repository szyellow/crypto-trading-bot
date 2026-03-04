#!/usr/bin/env python3
import requests
import json
import time
import re

# Boss直聘API搜索
def search_jobs():
    # 城市代码: 深圳=101280600
    city_code = "101280600"
    keyword = "AI产品经理"
    
    cookies = {
        'wt2': 'DDp6j-2BDzXOgfzp3ymWACDixK36O1Kz9qFFlbQ_JwF537PcbmRVHslQK1d-LtrG-aA4ywS-6oFEvL2kPdY3Asw~~',
        'wbg': '0',
        'zp_at': 'qWS5gA_HUGex3aMZM0OZQYa0sCvxkcwsu4quKSIm04w~',
        'bst': 'V2QtgvFOL53FtgXdJuzR8cLyyx6zvSxA~~|QtgvFOL53FtgXdJuzRQZKSuw7DvSxA~~'
    }
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'X-Requested-With': 'XMLHttpRequest',
        'Origin': 'https://www.zhipin.com'
    }
    
    all_jobs = []
    
    # 尝试获取多页数据
    for page in range(1, 4):
        print(f"正在获取第 {page} 页...")
        
        params = {
            'scene': '1',
            'query': keyword,
            'city': city_code,
            'page': str(page),
            'pageSize': '30'
        }
        
        try:
            response = requests.get(
                'https://www.zhipin.com/wapi/zpgeek/search/joblist.json',
                headers=headers,
                cookies=cookies,
                params=params,
                timeout=30
            )
            
            print(f"状态码: {response.status_code}")
            data = response.json()
            print(f"响应: {json.dumps(data, ensure_ascii=False, indent=2)[:500]}")
            
            if data.get('code') == 0:
                job_list = data.get('zpData', {}).get('jobList', [])
                print(f"第 {page} 页获取到 {len(job_list)} 条职位")
                
                for job in job_list:
                    job_info = {
                        'job_id': job.get('encryptJobId', ''),
                        'title': job.get('jobName', ''),
                        'salary': job.get('salaryDesc', ''),
                        'company': job.get('brandName', ''),
                        'company_id': job.get('encryptBrandId', ''),
                        'location': job.get('cityName', ''),
                        'district': job.get('areaDistrict', ''),
                        'business_district': job.get('businessDistrict', ''),
                        'experience': job.get('jobExperience', ''),
                        'education': job.get('jobDegree', ''),
                        'skills': job.get('skills', []),
                        'welfare': job.get('welfareList', []),
                        'company_size': job.get('brandScaleName', ''),
                        'company_stage': job.get('brandStageName', ''),
                        'company_industry': job.get('brandIndustry', ''),
                        'job_type': job.get('jobType', ''),
                        'link': f"https://www.zhipin.com/job_detail/{job.get('encryptJobId', '')}.html"
                    }
                    all_jobs.append(job_info)
            else:
                print(f"API错误: {data.get('message', '未知错误')}")
                
        except Exception as e:
            print(f"请求出错: {e}")
        
        time.sleep(2)
    
    # 保存结果
    output = {
        'search_time': time.strftime('%Y-%m-%d %H:%M:%S'),
        'keyword': keyword,
        'city': '深圳',
        'city_code': city_code,
        'total_count': len(all_jobs),
        'jobs': all_jobs
    }
    
    with open('/root/.openclaw/workspace/job_search_shenzhen.json', 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    
    print(f"\n共获取 {len(all_jobs)} 条职位信息")
    print("结果已保存到 job_search_shenzhen.json")

if __name__ == '__main__':
    search_jobs()
