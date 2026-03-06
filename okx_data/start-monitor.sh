#!/bin/bash
# ============================================
# 启动Sub-agent监控服务
# ============================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MONITOR_SCRIPT="${SCRIPT_DIR}/monitor-subagent.sh"
LOG_FILE="${SCRIPT_DIR}/logs/subagent-monitor.log"

# 检查监控脚本是否存在
if [ ! -f "$MONITOR_SCRIPT" ]; then
    echo "❌ 错误: 监控脚本不存在: $MONITOR_SCRIPT"
    exit 1
fi

# 检查是否已在运行
if pgrep -f "monitor-subagent.sh" > /dev/null; then
    echo "⚠️ 监控服务已在运行"
    echo "查看日志: tail -f $LOG_FILE"
    exit 0
fi

# 创建日志目录
mkdir -p "${SCRIPT_DIR}/logs"

# 启动监控服务（后台运行）
echo "🚀 启动Sub-agent监控服务..."
nohup "$MONITOR_SCRIPT" > /dev/null 2>&1 &
echo $! > /tmp/subagent-monitor.pid

sleep 2

# 检查是否启动成功
if pgrep -f "monitor-subagent.sh" > /dev/null; then
    echo "✅ 监控服务启动成功"
    echo ""
    echo "📊 查看状态:"
    echo "  日志: tail -f $LOG_FILE"
    echo "  进程: ps aux | grep monitor-subagent"
    echo "  停止: pkill -f monitor-subagent.sh"
else
    echo "❌ 监控服务启动失败"
    exit 1
fi
