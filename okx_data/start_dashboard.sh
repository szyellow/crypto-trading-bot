#!/bin/bash
# 启动Web监控面板服务器

cd /root/.openclaw/workspace/okx_data

# 杀掉旧进程
pkill -f "http.server" 2>/dev/null

sleep 1

# 启动服务器，绑定到所有接口
python3 -m http.server 8080 --bind 0.0.0.0 &

echo "✅ Web监控面板已启动"
echo "📍 访问地址: http://129.226.216.173:8080/dashboard.html"
echo "⏰ 启动时间: $(date)"