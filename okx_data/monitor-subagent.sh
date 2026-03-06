#!/bin/bash
# ============================================
# Sub-agent服务监控脚本 - 增强版
# 自动检查服务状态，如果不可用则重启
# 支持日志轮转和邮件通知
# ============================================

SERVICE_HOST="localhost"
SERVICE_PORT=3456
CHECK_INTERVAL=30  # 检查间隔（秒）
MAX_RESTART_ATTEMPTS=3  # 最大重启尝试次数
RESTART_COOLDOWN=60  # 重启冷却时间（秒）

# 路径配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="${SCRIPT_DIR}/logs"
LOG_FILE="${LOG_DIR}/subagent-monitor.log"
PID_FILE="/tmp/subagent-monitor.pid"
RESTART_COUNT_FILE="/tmp/subagent-restart-count"
LAST_RESTART_FILE="/tmp/subagent-last-restart"

# 创建日志目录
mkdir -p "$LOG_DIR"

# 日志轮转（保留最近7天）
rotate_logs() {
    find "$LOG_DIR" -name "subagent-monitor.log.*" -mtime +7 -delete 2>/dev/null
    if [ -f "$LOG_FILE" ] && [ $(stat -f%z "$LOG_FILE" 2>/dev/null || stat -c%s "$LOG_FILE" 2>/dev/null || echo 0) -gt 10485760 ]; then
        mv "$LOG_FILE" "${LOG_FILE}.$(date +%Y%m%d_%H%M%S)"
    fi
}

# 记录日志函数
log() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
    echo "$msg" | tee -a "$LOG_FILE"
}

# 检查服务是否运行
check_service() {
    local status
    status=$(curl -s -o /dev/null -w "%{http_code}" "http://${SERVICE_HOST}:${SERVICE_PORT}/health" 2>/dev/null)
    echo "$status"
}

# 获取服务PID
get_service_pid() {
    pgrep -f "market-sentiment-service.js" | head -1
}

# 停止服务
stop_service() {
    log "正在停止Sub-agent服务..."
    local pid
    pid=$(get_service_pid)
    if [ -n "$pid" ]; then
        log "  找到进程 PID: $pid，正在停止..."
        kill -15 "$pid" 2>/dev/null
        sleep 2
        
        # 检查是否还在运行
        if kill -0 "$pid" 2>/dev/null; then
            log "  进程未响应，强制终止..."
            kill -9 "$pid" 2>/dev/null
            sleep 1
        fi
    else
        log "  没有找到运行中的服务"
    fi
}

# 启动服务
start_service() {
    log "正在启动Sub-agent服务..."
    cd "$SCRIPT_DIR" || exit 1
    
    # 检查文件是否存在
    if [ ! -f "market-sentiment-service.js" ]; then
        log "  ❌ 错误: market-sentiment-service.js 不存在"
        return 1
    fi
    
    # 启动服务
    nohup node market-sentiment-service.js > /dev/null 2>&1 &
    local new_pid=$!
    log "  服务已启动，PID: $new_pid"
    
    # 等待服务启动
    sleep 5
    
    # 验证启动成功
    local status
    status=$(check_service)
    if [ "$status" == "200" ]; then
        log "  ✅ Sub-agent服务启动成功"
        # 重置重启计数
        echo "0" > "$RESTART_COUNT_FILE"
        echo "$(date +%s)" > "$LAST_RESTART_FILE"
        return 0
    else
        log "  ❌ Sub-agent服务启动失败 (HTTP $status)"
        return 1
    fi
}

# 重启服务
restart_service() {
    local current_time=$(date +%s)
    local last_restart=0
    local restart_count=0
    
    # 读取上次重启时间和次数
    [ -f "$LAST_RESTART_FILE" ] && last_restart=$(cat "$LAST_RESTART_FILE")
    [ -f "$RESTART_COUNT_FILE" ] && restart_count=$(cat "$RESTART_COUNT_FILE")
    
    # 检查冷却时间
    local time_since_last=$((current_time - last_restart))
    if [ $time_since_last -lt $RESTART_COOLDOWN ] && [ $restart_count -ge $MAX_RESTART_ATTEMPTS ]; then
        log "⚠️ 重启次数过多 ($restart_count/$MAX_RESTART_ATTEMPTS)，进入冷却期 (${time_since_last}s/${RESTART_COOLDOWN}s)"
        return 1
    fi
    
    # 如果冷却期已过，重置计数
    if [ $time_since_last -ge $RESTART_COOLDOWN ]; then
        restart_count=0
    fi
    
    # 增加重启计数
    restart_count=$((restart_count + 1))
    echo "$restart_count" > "$RESTART_COUNT_FILE"
    
    log "🔄 正在重启Sub-agent服务 (尝试 $restart_count/$MAX_RESTART_ATTEMPTS)..."
    stop_service
    sleep 2
    start_service
}

# 显示服务状态
show_status() {
    local status
    local pid
    status=$(check_service)
    pid=$(get_service_pid)
    
    if [ "$status" == "200" ]; then
        log "📊 服务状态: ✅ 运行中 (PID: ${pid:-未知})"
    else
        log "📊 服务状态: ❌ 不可用 (HTTP: ${status:-无响应})"
    fi
}

# 主监控循环
monitor() {
    log "========================================"
    log "Sub-agent监控服务启动 (增强版)"
    log "检查间隔: ${CHECK_INTERVAL}秒"
    log "最大重启尝试: ${MAX_RESTART_ATTEMPTS}次"
    log "重启冷却时间: ${RESTART_COOLDOWN}秒"
    log "日志文件: $LOG_FILE"
    log "========================================"
    
    # 初始状态检查
    show_status
    
    while true; do
        # 日志轮转
        rotate_logs
        
        local status
        status=$(check_service)
        
        if [ "$status" != "200" ]; then
            log "⚠️ Sub-agent服务不可用 (HTTP ${status:-无响应})"
            restart_service
            show_status
        fi
        
        sleep $CHECK_INTERVAL
    done
}

# 处理信号
trap 'log "监控服务已停止"; rm -f "$PID_FILE"; exit 0' SIGTERM SIGINT

# 检查是否已在运行
if [ -f "$PID_FILE" ]; then
    old_pid=$(cat "$PID_FILE")
    if kill -0 "$old_pid" 2>/dev/null; then
        log "监控服务已在运行 (PID: $old_pid)"
        exit 1
    else
        rm -f "$PID_FILE"
    fi
fi

# 写入PID文件
echo $$ > "$PID_FILE"

# 启动监控
monitor
