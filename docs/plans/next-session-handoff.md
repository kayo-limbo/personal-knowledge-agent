# 2026-09-09 下一会话交接

验收截止日期：**2026-09-13**。

这是一份短期状态快照，用于新对话快速恢复上下文。长期范围、架构与完成记录仍以 `summer-assessment-roadmap.md`、README 和各功能文档为准；开始工作前必须再运行 Git 命令确认真实状态。

## 1. 新对话首先阅读和检查

1. 完整阅读根目录 `AGENTS.md`。
2. 阅读 `docs/plans/summer-assessment-roadmap.md`。
3. 阅读 `README.md` 和 `docs/README.md`。
4. 阅读目标功能相关的 `docs/features/*.md`。
5. 修改 Next.js 代码前，阅读 `node_modules/next/dist/docs/` 中对应的 Next.js 16 本地文档。
6. 运行：

```bash
git status --short --branch
git log -5 --oneline
```

## 2. 必须保护的本地修改

以下两处是用户原有、尚未提交的修改，不得覆盖，也不得混入其他功能提交：

```text
src/app/dashboard/knowledge/types.ts
src/lib/services/knowledge.service.ts
```

任何提交前都要使用 `git diff --cached --name-only` 再检查暂存范围。

## 3. 当前已经完成

- 登录注册、bcrypt、NextAuth JWT Session、ADMIN/USER/GUEST 角色权限与 `userId` 数据隔离。
- Knowledge CRUD、DeepSeek Flash/Pro、普通/深度思考、SSE、停止生成、Markdown 和 PostgreSQL 会话持久化。
- 固定知识检索与引用、`searchKnowledge` Tool Calling、有限 Agent 循环、超时、取消、错误回填。
- DeepSeek 官方受控联网搜索及网页引用。
- PostgreSQL Prisma migration、`adapter-pg`、连接池、幂等 seed 和每日聊天配额。
- Next.js standalone Dockerfile、Docker Compose、健康检查、命名 volume 和 GitHub Actions 基础 CI。
- Render Free Singapore Docker + Neon Free Singapore PostgreSQL 实际公网方案；Vercel 只保留为未通过当前网络可达性验收的历史方案。
- Prompt 用户隔离 CRUD、历史记录搜索/重命名/删除/继续对话、管理员用户角色管理和系统统计。
- Dashboard 固定左侧导航、固定顶部区域、右侧长内容独立滚动。

## 4. 已验证与尚未验证的边界

已验证：

- 本次固定侧栏完成后，27/27 自动测试、ESLint、TypeScript 和 Next.js 16.2.10 生产构建全部通过。
- Prompt、History、用户角色与统计已通过本地 Docker HTTP/Server Action 全链路验证。
- 本地 Docker 环境的 DeepSeek Flash 最小真实流式请求成功，API Key 仅保存在被 Git 忽略的本地环境文件中。
- 当前公网旧版本已验证登录注册、Knowledge 隔离、知识/联网 Agent、SSE、消息与配额持久化以及重新部署后数据保留。

尚未验证：

- 最新管理页面和固定侧栏尚未在真实浏览器完成视觉回归。
- 最新本地提交尚未 push，因此 GitHub Actions 和 Render 公网仍不是这批最新代码。

本机环境提醒：`.env.local` 当前没有 `DATABASE_URL`，`.env` 中仍是迁移前的 SQLite `file:` 地址。直接运行宿主机 `npm run dev` 或不覆盖环境变量的 build 会触发“必须使用 postgresql 协议”。本次生产构建使用与 CI 同类的无敏感 PostgreSQL 占位 URL，只验证编译且没有连接数据库。Docker Compose 使用被 Git 忽略的 `.env.docker`，已经是 PostgreSQL 配置。若以后要直接运行宿主机开发服务器，应自行在 `.env.local` 写入可由宿主机访问的真实 PostgreSQL URL，不要把连接串发送到聊天或提交 Git。

## 5. 当前 Git 与发布关系

交接文件创建前，本地 `main` 比 `origin/main` 领先 2 个提交：

```text
62c6a13 feat(dashboard): 补齐管理与历史功能闭环
69f8555 fix(deploy): 修复本地 Compose 认证并记录公网验收
```

固定侧栏及本交接文档应作为新的独立界面提交；实际提交号以 `git log -5 --oneline` 为准。用户负责 push，助手不要擅自 push。Render 自动部署已关闭，push 后还需要在 Render 控制台按最新 commit 手动部署。

## 6. 下一步只做这些

1. 在真实浏览器登录 ADMIN，检查所有 Dashboard 页面和长内容滚动，尤其确认左侧导航不移动。
2. 只暂存固定侧栏、文档索引、README、roadmap、AGENTS 和本交接文件，排除两处 Knowledge 修改。
3. 创建一个中文界面提交，然后由用户 push。
4. 在 GitHub Actions 确认最新提交绿色。
5. 在 Render 控制台手动部署最新 commit，随后公网回归六个导航页面、Prompt CRUD、历史续聊、角色管理、统计与 AI 流式对话。
6. 准备固定演示账号/数据、5—10 分钟演示脚本、PPT 和备用录屏。
7. 用验收现场同类网络测试 Render 冷启动、Markdown 显示和停止生成按钮。

不要新增 MCP、Multi-Agent、Workflow、Kubernetes、Redis、向量数据库、自动 CD 或多环境。

## 7. 常用网址

- 公网应用：https://personal-knowledge-agent.onrender.com
- Render Web Service：https://dashboard.render.com/web/srv-daeqsdvqj5pc73aj0h80
- Neon 控制台：https://console.neon.tech/
- GitHub Actions：https://github.com/kayo-limbo/personal-knowledge-agent/actions

不要在聊天、截图、Git 提交或日志中暴露 `DATABASE_URL`、`DIRECT_URL`、数据库密码、`AUTH_SECRET` 或 `DEEPSEEK_API_KEY`。
