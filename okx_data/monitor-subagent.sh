#!/bin/bash
# ============================================
# Sub-agent服务监控脚本
# 自动检查服务状态，如果不可用则重启
# ============================================

SERVICE_HOST="localhost"
SERVICE_PORT=3456
CHECK_INTERVAL=60  # 检查间隔（秒）
LOG_FILE="/root/.openclaw/workspace/okx_data/logs/subagent-monitor.log"
PID_FILE="/tmp/subagent-monitor.pid"

# 创建日志目录
mkdir -p "$(dirname "$LOG_FILE")"

# 记录日志函数
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# 检查服务是否运行
check_service() {
    curl -s -o /dev/null -w "%{http_code}" "http://${SERVICE_HOST}:${SERVICE_PORT}/health" 2>/dev/null
}

# 启动服务
start_service() {
    log "正在启动Sub-agent服务..."
    cd /root/.openclaw/workspace/okx_data
    nohup node market-sentiment-service.js > /dev/null 2>&1 &
    sleep 2
    
    # 验证启动成功
    local status=$(check_service)
    if [ "$status" == "200" ]; then
        log "✅ Sub-agent服务启动成功"
        return 0
    else
        log "❌ Sub-agent服务启动失败 (HTTP $status)"
        return 1
    fi
}

# 停止服务
stop_service() {
    log "正在停止Sub-agent服务..."
    pkill -f "market-sentiment-service.js" 2>/dev/null
    sleep 1
}

# 重启服务
restart_service() {
    log "正在重启Sub-agent服务..."
    stop_service
    sleep 2
    start_service
}

# 主监控循环
monitor() {
    log "========================================"
    log "Sub-agent监控服务启动"
    log "检查间隔: ${CHECK_INTERVAL}秒"
    log "========================================"
    
    while true; do
        local status=$(check_service)
        
        if [ "$status" != "200" ]; then
            log "⚠️ Sub-agent服务不可用 (HTTP $status)，正在重启..."
            restart_service
        fi
        
        sleep $CHECK_INTERVAL
    done
}

# 处理信号
trap 'log "监控服务已停止"; rm -f "$PID_FILE"; exit 0' SIGTERM SIGINT

# 写入PID文件
echo $$ > "$PID_FILE"

# 启动监控
monitor
