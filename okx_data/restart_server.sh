#!/bin/bash
# 稳定的HTTP服务器启动脚本

# 杀掉旧进程
pkill -9 -f "http.server" 2>/dev/null
sleep 2

# 进入目录
cd /root/.openclaw/workspace/okx_data

# 使用nohup和disown确保进程在后台稳定运行
nohup python3 -m http.server 8080 --bind 0.0.0.0 >> /tmp/http_server.log 2>&1 &
disown

echo "HTTP服务器已启动在8080端口"
echo "访问地址: http://129.226.216.173:8080/dashboard.html"