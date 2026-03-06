#!/bin/bash
# OKX API 签名脚本
# 用法: ./okx-sign.sh <method> <path> [body]
# 需要设置环境变量: OKX_API_KEY, OKX_SECRET_KEY, OKX_PASSPHRASE

API_KEY="${OKX_API_KEY}"
API_SECRET="${OKX_SECRET_KEY}"
PASSPHRASE="${OKX_PASSPHRASE}"

if [ -z "$API_KEY" ] || [ -z "$API_SECRET" ] || [ -z "$PASSPHRASE" ]; then
    echo "Error: 请设置环境变量 OKX_API_KEY, OKX_SECRET_KEY, OKX_PASSPHRASE"
    exit 1
fi

METHOD=${1:-GET}
PATH=${2:-/api/v5/account/balance}
BODY=${3:-}

TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)

if [ -n "$BODY" ]; then
    MESSAGE="${TIMESTAMP}${METHOD}${PATH}${BODY}"
else
    MESSAGE="${TIMESTAMP}${METHOD}${PATH}"
fi

SIGN=$(echo -n "$MESSAGE" | openssl dgst -sha256 -hmac "$API_SECRET" -binary | base64)

echo "TIMESTAMP: $TIMESTAMP"
echo "SIGN: $SIGN"
echo "PASSPHRASE: $PASSPHRASE"

# 执行请求
curl -s "https://www.okx.com${PATH}" \
  -H "OK-ACCESS-KEY: $API_KEY" \
  -H "OK-ACCESS-SIGN: $SIGN" \
  -H "OK-ACCESS-TIMESTAMP: $TIMESTAMP" \
  -H "OK-ACCESS-PASSPHRASE: $PASSPHRASE" \
  -H "Content-Type: application/json" \
  ${BODY:+-d "$BODY"}
