# Contributing to Crypto Trading Bot

感谢您对 Crypto Trading Bot 项目的关注！我们欢迎所有形式的贡献。

## 如何贡献

### 报告问题

如果您发现了 bug 或有功能建议，请通过 GitHub Issues 提交：

1. 检查是否已有类似 issue
2. 创建新 issue，详细描述问题或建议
3. 如果是 bug，请提供复现步骤和环境信息

### 提交代码

1. Fork 本仓库
2. 创建您的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交您的更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开一个 Pull Request

### 代码规范

- 使用 ESLint 进行代码检查
- 提交信息使用英文，遵循 [Conventional Commits](https://www.conventionalcommits.org/)
- 添加必要的注释和文档

## 开发环境设置

```bash
# 克隆仓库
git clone https://github.com/szyellow/crypto-trading-bot.git
cd crypto-trading-bot

# 安装依赖
npm install

# 配置环境变量
cp okx_data/.env.example okx_data/.env
# 编辑 .env 文件添加您的 API 密钥

# 运行测试
npm test
```

## 行为准则

- 尊重所有参与者
- 接受建设性的批评
- 关注对社区最有利的事情

## 许可证

通过贡献代码，您同意您的贡献将在 MIT 许可证下发布。
