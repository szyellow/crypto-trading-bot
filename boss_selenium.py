#!/usr/bin/env python3
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import json
import time

def search_jobs():
    # 设置Chrome选项
    chrome_options = Options()
    chrome_options.add_argument('--headless')
    chrome_options.add_argument('--no-sandbox')
    chrome_options.add_argument('--disable-dev-shm-usage')
    chrome_options.add_argument('--disable-gpu')
    chrome_options.add_argument('--window-size=1920,1080')
    chrome_options.add_argument('--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36')
    
    # 创建driver
    driver = webdriver.Chrome(options=chrome_options)
    
    try:
        # 添加cookie需要先访问网站
        driver.get('https://www.zhipin.com')
        time.sleep(2)
        
        # 添加cookie
        cookies = [
            {'name': 'wt2', 'value': 'DDp6j-2BDzXOgfzp3ymWACDixK36O1Kz9qFFlbQ_JwF537PcbmRVHslQK1d-LtrG-aA4ywS-6oFEvL2kPdY3Asw~~'},
            {'name': 'wbg', 'value': '0'},
            {'name': 'zp_at', 'value': 'qWS5gA_HUGex3aMZM0OZQYa0sCvxkcwsu4quKSIm04w~'},
            {'name': 'bst', 'value': 'V2QtgvFOL53FtgXdJuzR8cLyyx6zvSxA~~|QtgvFOL53FtgXdJuzRQZKSuw7DvSxA~~'}
        ]
        
        for cookie in cookies:
            try:
                driver.add_cookie(cookie)
            except Exception as e:
                print(f"添加cookie失败: {e}")
        
        # 访问搜索页面
        search_url = 'https://www.zhipin.com/web/geek/job?query=AI产品经理&city=101280600'
        print(f"访问: {search_url}")
        driver.get(search_url)
        
        # 等待页面加载
        time.sleep(5)
        
        # 截图
        driver.save_screenshot('/root/.openclaw/workspace/boss_selenium.png')
        print("已截图")
        
        # 等待职位列表加载
        try:
            WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, '.job-card-wrapper'))
            )
        except:
            print("等待职位列表超时")
        
        # 提取职位数据
        jobs = []
        job_cards = driver.find_elements(By.CSS_SELECTOR, '.job-card-wrapper')
        print(f"找到 {len(job_cards)} 个职位卡片")
        
        for card in job_cards:
            try:
                title = card.find_element(By.CSS_SELECTOR, '.job-name').text
                salary = card.find_element(By.CSS_SELECTOR, '.salary').text
                company = card.find_element(By.CSS_SELECTOR, '.company-name').text
                location = card.find_element(By.CSS_SELECTOR, '.job-area').text
                
                # 获取标签
                tags = []
                tag_elements = card.find_elements(By.CSS_SELECTOR, '.tag-list li')
                for tag in tag_elements:
                    tags.append(tag.text)
                
                # 获取链接
                link = card.find_element(By.CSS_SELECTOR, 'a').get_attribute('href')
                
                jobs.append({
                    'title': title,
                    'salary': salary,
                    'company': company,
                    'location': location,
                    'tags': tags,
                    'link': link
                })
            except Exception as e:
                print(f"解析职位卡片出错: {e}")
        
        # 滚动加载更多
        for i in range(3):
            driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            time.sleep(3)
            
            # 再次提取
            job_cards = driver.find_elements(By.CSS_SELECTOR, '.job-card-wrapper')
            print(f"滚动后找到 {len(job_cards)} 个职位卡片")
        
        # 最终提取
        jobs = []
        job_cards = driver.find_elements(By.CSS_SELECTOR, '.job-card-wrapper')
        for card in job_cards:
            try:
                title = card.find_element(By.CSS_SELECTOR, '.job-name').text
                salary = card.find_element(By.CSS_SELECTOR, '.salary').text
                company = card.find_element(By.CSS_SELECTOR, '.company-name').text
                location = card.find_element(By.CSS_SELECTOR, '.job-area').text
                
                tags = []
                tag_elements = card.find_elements(By.CSS_SELECTOR, '.tag-list li')
                for tag in tag_elements:
                    tags.append(tag.text)
                
                link = card.find_element(By.CSS_SELECTOR, 'a').get_attribute('href')
                
                jobs.append({
                    'title': title,
                    'salary': salary,
                    'company': company,
                    'location': location,
                    'tags': tags,
                    'link': link
                })
            except:
                pass
        
        print(f"共获取 {len(jobs)} 条职位")
        
        # 保存结果
        output = {
            'search_time': time.strftime('%Y-%m-%d %H:%M:%S'),
            'keyword': 'AI产品经理',
            'city': '深圳',
            'city_code': '101280600',
            'total_count': len(jobs),
            'jobs': jobs
        }
        
        with open('/root/.openclaw/workspace/job_search_shenzhen.json', 'w', encoding='utf-8') as f:
            json.dump(output, f, ensure_ascii=False, indent=2)
        
        print("结果已保存到 job_search_shenzhen.json")
        
    finally:
        driver.quit()

if __name__ == '__main__':
    search_jobs()
