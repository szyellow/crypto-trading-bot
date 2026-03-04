const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 }
  });
  
  // 设置Cookie
  const cookies = [
    { name: 'wt2', value: 'DDp6j-2BDzXOgfzp3ymWACDixK36O1Kz9qFFlbQ_JwF537PcbmRVHslQK1d-LtrG-aA4ywS-6oFEvL2kPdY3Asw~~', domain: '.zhipin.com', path: '/' },
    { name: 'wbg', value: '0', domain: '.zhipin.com', path: '/' },
    { name: 'zp_at', value: 'qWS5gA_HUGex3aMZM0OZQYa0sCvxkcwsu4quKSIm04w~', domain: '.zhipin.com', path: '/' },
    { name: 'bst', value: 'V2QtgvFOL53FtgXdJuzR8cLyyx6zvSxA~~|QtgvFOL53FtgXdJuzRQZKSuw7DvSxA~~', domain: '.zhipin.com', path: '/' }
  ];
  await context.addCookies(cookies);
  
  const page = await context.newPage();
  
  // 先访问首页
  console.log('访问Boss直聘首页...');
  await page.goto('https://www.zhipin.com', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);
  
  // 访问搜索页面
  const searchUrl = 'https://www.zhipin.com/web/geek/job?query=AI产品经理&city=101280600';
  console.log('访问搜索页面:', searchUrl);
  await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(5000);
  
  // 截图查看页面状态
  await page.screenshot({ path: '/root/.openclaw/workspace/boss_search.png', fullPage: true });
  console.log('已截图保存到 boss_search.png');
  
  // 获取页面HTML内容
  const html = await page.content();
  fs.writeFileSync('/root/.openclaw/workspace/boss_page.html', html);
  console.log('页面HTML已保存');
  
  // 提取职位数据 - 尝试多种选择器
  const jobs = await page.evaluate(() => {
    const results = [];
    
    // 尝试多种可能的选择器
    const selectors = [
      '.job-card-wrapper',
      '.job-list .job-card',
      '[data-v-] .job-card',
      '.search-job-result .job-card',
      '.job-list-item'
    ];
    
    let jobCards = [];
    for (const selector of selectors) {
      jobCards = document.querySelectorAll(selector);
      if (jobCards.length > 0) {
        console.log('找到选择器:', selector, '数量:', jobCards.length);
        break;
      }
    }
    
    jobCards.forEach((card, index) => {
      try {
        const title = card.querySelector('.job-name, .name, .job-title, h3')?.textContent?.trim() || '';
        const salary = card.querySelector('.salary, .job-salary')?.textContent?.trim() || '';
        const company = card.querySelector('.company-name, .company, .comp-name')?.textContent?.trim() || '';
        const location = card.querySelector('.job-area, .area, .location')?.textContent?.trim() || '';
        const tags = Array.from(card.querySelectorAll('.tag-list li, .tag, .job-tags span')).map(li => li.textContent.trim());
        const link = card.querySelector('a')?.href || '';
        
        if (title) {
          results.push({
            title,
            salary,
            company,
            location,
            tags,
            link,
            index
          });
        }
      } catch (e) {
        console.error('解析职位卡片出错:', e);
      }
    });
    
    return results;
  });
  
  console.log('找到职位数量:', jobs.length);
  
  // 如果找到职位，滚动加载更多
  if (jobs.length > 0) {
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(3000);
    }
    
    // 再次提取所有职位
    const allJobs = await page.evaluate(() => {
      const results = [];
      const jobCards = document.querySelectorAll('.job-card-wrapper, .job-list .job-card, .job-list-item');
      
      jobCards.forEach(card => {
        try {
          const title = card.querySelector('.job-name, .name, .job-title, h3')?.textContent?.trim() || '';
          const salary = card.querySelector('.salary, .job-salary')?.textContent?.trim() || '';
          const company = card.querySelector('.company-name, .company, .comp-name')?.textContent?.trim() || '';
          const location = card.querySelector('.job-area, .area, .location')?.textContent?.trim() || '';
          const experience = card.querySelector('.tag-list li:nth-child(1), .experience')?.textContent?.trim() || '';
          const education = card.querySelector('.tag-list li:nth-child(2), .education')?.textContent?.trim() || '';
          const tags = Array.from(card.querySelectorAll('.tag-list li, .tag, .job-tags span')).map(li => li.textContent.trim());
          const link = card.querySelector('a')?.href || '';
          
          if (title) {
            results.push({
              title,
              salary,
              company,
              location,
              experience,
              education,
              tags,
              link
            });
          }
        } catch (e) {}
      });
      
      return results;
    });
    
    console.log('滚动后职位数量:', allJobs.length);
    
    // 保存结果
    const output = {
      search_time: new Date().toISOString(),
      keyword: 'AI产品经理',
      city: '深圳',
      city_code: '101280600',
      total_count: allJobs.length,
      jobs: allJobs
    };
    
    fs.writeFileSync('/root/.openclaw/workspace/job_search_shenzhen.json', JSON.stringify(output, null, 2));
    console.log('结果已保存到 job_search_shenzhen.json');
  } else {
    console.log('未找到职位数据，请检查页面结构');
    // 保存空结果
    const output = {
      search_time: new Date().toISOString(),
      keyword: 'AI产品经理',
      city: '深圳',
      city_code: '101280600',
      total_count: 0,
      jobs: [],
      error: '未找到职位数据'
    };
    fs.writeFileSync('/root/.openclaw/workspace/job_search_shenzhen.json', JSON.stringify(output, null, 2));
  }
  
  await browser.close();
})();
