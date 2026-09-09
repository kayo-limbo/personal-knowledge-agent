Personal Knowledge Agent

[![Continuous Integration](https://github.com/kayo-limbo/personal-knowledge-agent/actions/workflows/ci.yml/badge.svg)](https://github.com/kayo-limbo/personal-knowledge-agent/actions/workflows/ci.yml)

一个基于 Next.js + TypeScript 构建的个人知识库 Agent，已经支持模型自主调用 `searchKnowledge`、受控联网搜索、有限工具循环、流式回答和引用来源。

技术栈：Next.js 16 + React 19 + TypeScript + TailwindCSS + Zustand + Prisma + PostgreSQL + NextAuth

V1 目标:登录/RBAC + Chat(SSE流式+Markdown) + Prompt管理 + Knowledge CRUD + History + Tool Calling(调用自己的 Knowledge Search)
V2:文件上传解析与混合检索（已完成）；MCP 与更多工具延期
V3:Multi-Agent + Workflow（后期）

## 当前进度

已经可以使用或已经打通：

- Credentials 登录、JWT Session 和角色导航
- 紧凑型登录页、注册页、注册输入校验和 bcrypt 密码哈希
- Dashboard 数据概览
- DeepSeek V4 Flash/Pro 多模型选择、普通/深度思考模式、SSE 流式输出和会话历史持久化
- Knowledge 页面、Server Action、Service 和 REST API 的 CRUD
- PDF/TXT/MD 文件导入、服务端纯文本提取、可控分块和文件来源元数据
- 固定 `searchKnowledge` 中英文关键词 + PostgreSQL 英文全文混合检索、知识上下文注入和可持久化引用来源（不是向量检索）
- DeepSeek `tool_use/tool_result`、最多 4 轮/3 次工具调用的 Agent 循环与实时工具状态
- DeepSeek 官方 Web Search，支持自动/强制/禁止三档、跨轮工具控制和网页来源链接（上游内部搜索次数不是硬保证）
- Prisma PostgreSQL 数据模型、`adapter-pg`、初始 migration、常用索引和幂等种子数据
- Next.js standalone 多阶段镜像、Docker Compose、真实 PostgreSQL migration/seed、健康检查和命名 volume 持久化
- GitHub Actions 基础 CI 配置：Prisma Client 生成、测试、Lint、TypeScript 和生产构建
- 生产默认只执行 migration，demo seed 需要显式运行且不会重置已有账号密码
- Vercel Hobby + Neon Free 部署所需的区域配置、数据库连接分层和 Serverless 连接池适配
- Prompt 用户隔离 CRUD、收藏与公开标记
- 历史记录搜索、重命名、删除和继续指定会话
- 管理员用户角色管理与 PostgreSQL 系统统计
- Dashboard 固定侧栏、固定顶部栏和右侧长内容独立滚动

验收收尾：

- 2026-09-09 本地新增收尾：旧 JWT 的最新角色同步、中文输入法保护、SSE 完成确认与离页取消、顶部搜索、个人 Prompt 选用与会话关联；已通过本地浏览器集成，待本轮提交发布
- 已准备本地独立 ADMIN/USER 演示账号、四条知识和一条 Prompt，见 [`人工演示步骤`](docs/acceptance/manual-demo.md)；按用户要求不制作 PPT 或录屏
- 已准备可直接人工上传的 [`Polaris 灾备运行手册`](docs/acceptance/demo-import-source.md)，用于展示“文件导入—Agent 检索—引用来源”闭环

- Prompt、History、用户管理和系统统计已通过本地 Docker HTTP/Server Action 验证；固定侧栏已通过六页真实 Chrome 滚动检查。本轮新增修复的验证边界见 [`验证记录`](docs/acceptance/verification-2026-09-09.md)
- Neon migration 和 Render Free 公网部署已完成；登录、Knowledge 隔离、知识检索、Flash SSE、消息保存与请求取消已实测
- 强制联网修复已在 Render 公网通过：持续 SSE、网页引用、`done` 和最终回答落库均正常；Pro + 深度思考也已实测
- PostgreSQL 用户/全站两级每日聊天配额已上线；默认用户上限的 200→429、`Retry-After` 及重新部署后计数保留均已实测
- 保存账号、Knowledge 和 Conversation 后重新部署同一 SHA，Session 与全部记录仍可读取，证明数据不依赖容器文件系统
- `bcbf877` 的 GitHub Actions 已成功，Render 已 live；本轮未提交的新增修复仍需单独发布

## 当前公网演示：Render Free + Neon Free

访问 [Personal Knowledge Agent](https://personal-knowledge-agent.onrender.com)。实际架构为 **Render Singapore Docker Web Service + Neon AWS Singapore PostgreSQL**；免费额度内托管费用为 0，DeepSeek 调用仍收费。

Vercel 部署虽已 Ready，但当前测试网络访问失败，因此启用了原定 Render 备用方案。不能把当前线上架构写成 Vercel Serverless 或香港 VPS Compose。Render 免费实例空闲会休眠，演示前需要暖机，并保留本地 Compose 作为人工展示备用环境；按用户要求不录制备用视频。

部署配置、控制台网址、真实验证记录和剩余清单见 [`docs/features/render-neon-free-deployment.md`](docs/features/render-neon-free-deployment.md)。

## 使用 Vercel Hobby + Neon Free

以下保留最初的 Vercel 方案与复现说明，不代表它已通过公网验收；实际运行方案见上面的 Render 章节。Docker Compose 保留为本地生产模拟和自托管备用。

数据库连接分为两条：

```text
DATABASE_URL  Neon pooled 地址（主机名包含 -pooler），供 Vercel 应用运行时使用
DIRECT_URL    Neon direct 地址（主机名不包含 -pooler），只供本地 Prisma migration 使用
```

在 Neon 创建 AWS Singapore Free 项目后，把 direct 地址只写入本机被 Git 忽略的 `.env`，执行已提交 migration：

```bash
npm run db:deploy
```

不要用 `prisma db push` 代替生产 migration，也不要自动执行 demo seed。然后在 Vercel 导入 GitHub 仓库，并只在控制台配置 `DATABASE_URL`、`AUTH_SECRET`、`DEEPSEEK_API_KEY` 和 `DEEPSEEK_MODEL`；不要把密码或密钥发送到聊天或提交到 Git。

仓库通过 `vercel.json` 把 Node.js Functions 固定在香港 `hkg1`，聊天路由保留 `maxDuration = 60`，Agent 自身 50 秒超时。部署 Ready 不等于验收完成，还必须实测 `/api/health`、登录注册、用户隔离、Knowledge CRUD、会话持久化、Tool Calling、SSE 首字/持续输出、停止生成、联网搜索、重新部署后的数据持久性，以及中国大陆网络访问 `vercel.app` 和 Vercel 香港访问 DeepSeek 的稳定性。

完整步骤、设计解释和验收清单见 [`docs/features/vercel-neon-free-deployment.md`](docs/features/vercel-neon-free-deployment.md)。

## 配置 PostgreSQL

项目已经切换为 PostgreSQL，不再使用 SQLite 作为运行数据库。先复制 `.env.example` 为 `.env`，再把 `DATABASE_URL` 改成可访问的 PostgreSQL 地址。本地和 Docker 使用直连地址；Neon/Vercel runtime 使用 pooled 地址：

```env
DATABASE_URL="postgresql://postgres:你的密码@localhost:5432/personal_knowledge_agent"
```

首次连接本地空数据库时执行：

```bash
npm run db:generate
npm run db:deploy
npm run db:seed
```

开发模型变更使用 `npm run db:migrate -- --name <迁移名>`；生产和验收环境只运行已提交的 `npm run db:deploy`。旧的 `dev.db` 只作为本地 SQLite 备份保留，不会自动导入 PostgreSQL，也不再提交到 Git。

如果直接运行 `npm run dev` 后看到“`DATABASE_URL` 必须使用 `postgresql://` 或 `postgres://` 协议”，说明被 Git 忽略的本机 `.env` 仍保存着迁移前的 `file:./dev.db`。Next.js 开发环境按 `.env.local`、`.env` 的顺序取值：可以在 `.env.local` 配置一条仅本机可访问的 PostgreSQL 地址；也可以停止 `npm run dev`，启动 Docker Desktop 后按下一节运行完整 Compose。不要把 Neon 密码或连接串发到聊天、截图或提交到 Git；Compose 内的 PostgreSQL 不映射宿主机端口，因此不能直接供宿主机上的 `npm run dev` 使用。

## 使用 Docker Compose

本地可复现部署包含 Next.js App、PostgreSQL 和一次性迁移服务。先复制环境模板并替换密码与密钥：

```bash
cp .env.docker.example .env.docker
docker compose --env-file .env.docker up --build -d
docker compose --env-file .env.docker ps -a
```

启动顺序是 PostgreSQL 健康检查通过，migrate 只执行 `prisma migrate deploy` 并以 0 退出，最后启动 App。Compose 会为自托管的 Auth.js 显式设置 `AUTH_URL=http://localhost:<APP_PORT>` 和 `AUTH_TRUST_HOST=true`；访问 `http://localhost:3000/api/health` 应看到数据库可达，并从 `http://localhost:3000` 登录。PostgreSQL 端口只存在于 Compose 内网，不映射到宿主机。

生产启动默认不导入演示数据，避免公开创建 `admin@example.com / demo` 弱密码账号。只有本地学习或受控验收环境确实需要固定演示数据时，才显式执行一次：

```bash
docker compose --env-file .env.docker run --rm migrate npm run db:seed
```

重复 seed 不会重置已存在账号的密码，但公开部署仍不应保留默认演示密码。

查看日志和停机：

```bash
docker compose --env-file .env.docker logs -f app migrate postgres
docker compose --env-file .env.docker down
```

普通 `down` 会保留命名 volume。不要在未备份时添加 `-v`，否则会删除 PostgreSQL 数据。若受控环境显式执行过 seed，公开访问前仍必须修改或删除 `admin@example.com / demo` 演示账号。

## 持续集成

`.github/workflows/ci.yml` 会在推送到 `main`、面向 `main` 的 Pull Request 和手动触发时使用 Node.js 22 执行：

```text
npm ci
npm run db:generate
npm test
npm run lint
npm run typecheck
npm run build
```

CI 使用非秘密构建占位变量，不连接 PostgreSQL 或 DeepSeek，不执行自动部署。`f3abb8a` 的远程运行已确认绿色；每次新提交仍需独立检查。

## 配置 DeepSeek API

本项目默认使用低成本、低延迟的 `deepseek-v4-flash`，聊天输入区也允许用户按每次请求切换 `deepseek-v4-pro`，并选择普通或深度思考模式。为了复用现有流式聊天代码，服务端通过 Anthropic SDK 调用 DeepSeek 官方提供的 Anthropic 兼容接口；SDK 只是协议客户端，实际请求仍直接发送到 `https://api.deepseek.com/anthropic`。

聊天输入区还提供自动联网、强制联网和禁止联网三种模式。联网搜索使用 DeepSeek 官方服务端 Web Search，不需要额外的搜索 API Key；应用请求 `max_uses: 1` 并在搜索完成后的普通轮次移除工具，但实测供应商内部仍可能执行多次搜索，不能把该字段当作硬费用上限。网页来源链接只接受 `http/https`。

1. 复制 `.env.example` 为 `.env`。
2. 在 [DeepSeek 开放平台](https://platform.deepseek.com/) 创建 API Key。
3. 将 Key 填入 `DEEPSEEK_API_KEY`，不要使用 `NEXT_PUBLIC_` 前缀。
4. 重启 `npm run dev`，让 Next.js 重新读取环境变量。

```env
DEEPSEEK_API_KEY="sk-..."
DEEPSEEK_MODEL="deepseek-v4-flash"
```

API Key 只会由 `src/lib/deepseek.ts` 在服务端读取，不会发送给浏览器。当前每次请求最多携带最近 30 条、合计约 24,000 字符的历史消息；单次知识检索最多返回 5 条、约 6,000 字符的片段和元数据；Agent 最多运行 4 个模型轮次、执行 3 次工具调用，总时长 50 秒，单次知识检索等待 5 秒；普通模式每轮最多生成 1024 tokens，深度思考模式每轮最多生成 4096 tokens。

公开演示默认还按 UTC 自然日限制每账号 20 次、全站 60 次聊天请求，达到上限会在调用 DeepSeek 前返回 429。可通过服务端 `CHAT_DAILY_USER_LIMIT`、`CHAT_DAILY_GLOBAL_LIMIT` 调整；无效值回退到默认值，不能用 0 关闭。它是请求数保护，不是精确 Token 计费，完整设计见 [`docs/features/postgresql-chat-daily-quota.md`](docs/features/postgresql-chat-daily-quota.md)。

`DEEPSEEK_MODEL` 决定页面首次打开时的默认模型，用户之后可以在聊天输入区切换。官方接口和当前支持的模型可能更新，请以 [DeepSeek API 文档](https://api-docs.deepseek.com/) 为准。

> 学习文档统一从 [`docs/README.md`](docs/README.md) 开始阅读；完整聊天面试指南见 [`docs/chat-deepseek-interview-guide.md`](docs/chat-deepseek-interview-guide.md)。

> 项目用于 2026-09-13 暑期考核，当前范围、排期、部署取舍和面试准备见 [`docs/plans/summer-assessment-roadmap.md`](docs/plans/summer-assessment-roadmap.md)。

## 第一次阅读本项目

推荐按照一次请求经过的顺序阅读：

1. `prisma/schema.prisma`：先看系统保存哪些数据。
2. `src/auth.ts`：理解登录后如何把用户 id 和 role 放入 Session。
3. `src/app/dashboard/knowledge/page.tsx`：页面如何取得当前用户并读取数据。
4. `src/app/dashboard/knowledge/actions/knowledge.ts`：浏览器表单如何调用服务端代码。
5. `src/lib/validators/knowledge.ts`：为什么服务端仍然需要校验输入。
6. `src/lib/services/knowledge.service.ts`：业务逻辑如何通过 Prisma 读写数据库。
7. `src/app/api/knowledge/route.ts`：同一套业务逻辑如何暴露为 REST API。
8. `src/app/api/knowledge/import/route.ts` 与 `src/lib/knowledge-import.ts`：理解文件认证、校验、解析和分块。
9. `src/lib/knowledge-search.ts`：理解关键词、全文排名、排序、片段预算与引用 Prompt。
10. `src/lib/services/knowledge-search.service.ts`：理解两路召回如何合并并按 Session 用户隔离。
11. `src/lib/knowledge-agent.ts`：理解 Tool Schema、参数校验、工具结果回填与有限循环。
12. `src/app/api/chat/route.ts`：理解 Agent 循环、DeepSeek、SSE 与消息持久化如何串联。

Knowledge 新建流程可以简化为：

```text
KnowledgeForm（浏览器）
  -> createKnowledgeAction（认证 + 校验）
  -> createKnowledge（业务逻辑）
  -> Prisma
  -> PostgreSQL
  -> revalidatePath 刷新页面
```

常用检查命令：

```bash
npm run dev
npm run lint
npm test
npm run typecheck
npm run build
npm run db:status
```

## 项目目录结构

> 下方包含 V1 的目标结构；“当前进度”中标记为正在开发的目录可能尚未创建。

```
personal-knowledge-agent/
├── prisma/
│   ├── schema.prisma                    # 数据库模型定义（User, Conversation, Knowledge, Prompt）
│   ├── seed.ts                          # 数据库种子脚本
│   └── migrations/                      # 数据库迁移文件
├── public/                              # 静态资源
│   ├── file.svg
│   ├── globe.svg
│   ├── next.svg
│   ├── vercel.svg
│   └── window.svg
├── src/
│   ├── app/                             # Next.js App Router 路由层（文件系统路由）
│   │   ├── layout.tsx                   # 根布局
│   │   ├── page.tsx                     # 根页面（重定向）
│   │   ├── globals.css                  # 全局样式
│   │   ├── providers.tsx                # 客户端 Provider 包装（SessionProvider 等）
│   │   ├── favicon.ico                  # 网站图标
│   │   ├── login/
│   │   │   └── page.tsx                 # 登录页面
│   │   ├── auth/
│   │   │   ├── login/
│   │   │   │   └── page.tsx             # 认证-登录页面（客户端表单）
│   │   │   └── register/
│   │   │       └── page.tsx             # 认证-注册页面（客户端表单）
│   │   ├── dashboard/
│   │   │   ├── layout.tsx               # Dashboard 共享布局（Sidebar + Header + 认证守卫 + RBAC）
│   │   │   ├── page.tsx                 # Dashboard 主页（欢迎卡 + 快速操作 + 最近对话 + 知识库统计）
│   │   │   ├── chat/
│   │   │   │   └── page.tsx             # AI 对话页面（SSE 流式 + Markdown 渲染）
│   │   │   ├── knowledge/
│   │   │   │   ├── page.tsx             # 知识库管理页面（CRUD）
│   │   │   │   ├── loading.tsx          # 加载骨架屏
│   │   │   │   ├── error.tsx            # 错误边界
│   │   │   │   ├── constants.ts         # 知识库页面常量
│   │   │   │   ├── types.ts             # 知识库页面类型定义
│   │   │   │   ├── actions/
│   │   │   │   │   └── knowledge.ts     # Server Actions（创建/更新/删除知识条目）
│   │   │   │   └── components/
│   │   │   │       ├── KnowledgeTable.tsx       # 知识条目表格展示
│   │   │   │       ├── KnowledgeToolbar.tsx     # 搜索/筛选工具栏
│   │   │   │       ├── KnowledgeForm.tsx        # 新建/编辑知识条目表单
│   │   │   │       ├── DeleteKnowledgeDialog.tsx # 删除确认弹窗
│   │   │   │       └── EmptyKnowledge.tsx       # 空状态占位
│   │   │   ├── prompts/
│   │   │   │   └── page.tsx             # Prompt 管理页面
│   │   │   ├── history/
│   │   │   │   └── page.tsx             # 对话历史页面
│   │   │   ├── admin/
│   │   │   │   ├── users/
│   │   │   │   │   └── page.tsx         # 用户管理页面（仅 ADMIN）
│   │   │   │   └── stats/
│   │   │   │       └── page.tsx         # 系统统计页面（仅 ADMIN）
│   │   │   └── analytics/
│   │   │       └── page.tsx             # 数据分析页面
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   ├── [...nextauth]/
│   │   │   │   │   └── route.ts         # NextAuth API 路由处理器
│   │   │   │   └── register/
│   │   │   │       └── route.ts         # 注册 API
│   │   │   └── knowledge/
│   │   │       ├── route.ts             # 知识库 API（GET 列表, POST 创建）
│   │   │       └── [id]/
│   │   │           └── route.ts         # 知识库 API（GET 详情, PUT 更新, DELETE 删除）
│   │   ├── components/
│   │   │   ├── ui/                      # 通用 UI 基础组件（shadcn/ui）
│   │   │   │   ├── avatar.tsx
│   │   │   │   ├── button.tsx
│   │   │   │   ├── card.tsx
│   │   │   │   ├── dropdown-menu.tsx
│   │   │   │   ├── input.tsx
│   │   │   │   ├── separator.tsx
│   │   │   │   └── skeleton.tsx
│   │   │   └── dashboard/              # Dashboard 业务组件
│   │   │       ├── Header.tsx           # 顶部导航栏
│   │   │       ├── Sidebar.tsx          # 侧边导航栏（动态图标 + RBAC 菜单）
│   │   │       ├── SidebarItem.tsx      # 侧边栏单项
│   │   │       ├── UserDropdown.tsx     # 用户头像下拉菜单
│   │   │       ├── WorkspaceHeader.tsx  # 工作区通用头部（标题 + 问候语）
│   │   │       ├── QuickAction.tsx      # 快速操作卡片入口
│   │   │       ├── RecentConversations.tsx  # 最近对话列表
│   │   │       ├── KnowledgeOverview.tsx    # 知识库统计概览
│   │   │       ├── SearchBar.tsx        # 搜索栏
│   │   │       └── WelcomeCard.tsx      # 欢迎卡片
│   │   ├── store/                       # Zustand 客户端状态管理
│   │   ├── types/
│   │   │   └── next-auth.d.ts          # NextAuth 类型扩展（session.user 添加 role, id）
│   │   └── lib/                         # 客户端工具（与 src/lib 区分）
│   ├── lib/                             # 服务端共享库
│   │   ├── prisma.ts                    # Prisma 客户端单例
│   │   ├── auth-utils.ts               # 认证工具函数
│   │   ├── nav-config.ts               # 导航配置（类型定义）
│   │   ├── nav-items.ts                # 导航项定义（抽离的 navItems）
│   │   ├── utils.ts                     # 通用工具函数
│   │   ├── constants/                   # 常量定义
│   │   ├── validators/                  # Zod 校验器
│   │   └── services/                    # 业务逻辑层（Service 层）
│   │       ├── dashboard.service.ts     # Dashboard 数据聚合
│   │       ├── conversation.service.ts  # 对话管理
│   │       ├── knowledge.service.ts     # 知识库 CRUD
│   │       ├── prompt.service.ts        # Prompt 管理
│   │       └── user.service.ts          # 用户管理
│   ├── auth.ts                          # NextAuth 核心配置（Credentials Provider + JWT/Session 回调）
│   ├── auth.config.ts                   # NextAuth 基础配置（pages, callbacks）
│   └── proxy.ts                         # 代理配置
├── .env                                 # 环境变量（DATABASE_URL, AUTH_SECRET 等）
├── .gitignore
├── components.json                      # shadcn/ui 配置
├── eslint.config.mjs                    # ESLint 配置
├── next.config.ts                       # Next.js 配置
├── package.json                         # 依赖与脚本
├── postcss.config.mjs                   # PostCSS 配置
├── prisma.config.ts                     # Prisma 配置
├── tsconfig.json                        # TypeScript 配置
└── README.md                            # 项目说明
```

## 核心架构说明

### 1. 应用层 (App Router)

采用 Next.js 13+ 文件系统路由，`layout.tsx` 和 `page.tsx` 的嵌套自动构建 UI 层级：

```
(layout.tsx) Sidebar + Header + {children}
├── /dashboard            → page.tsx (主页)
├── /dashboard/chat       → chat/page.tsx
├── /dashboard/knowledge  → knowledge/page.tsx
└── ...
```

### 2. 数据流

```
Server Component (page.tsx)
    → 调用 service 层 (src/lib/services/*.service.ts)
        → Prisma ORM (src/lib/prisma.ts)
            → PostgreSQL 数据库
    → 返回数据
    → 传递给客户端组件（props）
```

### 3. 权限控制

```
auth.ts (JWT + Session 回调)
    → session.user.role (角色注入)
        → layout.tsx 过滤 navItems (UI 层)
        → page.tsx / API Route 二次校验 role (数据层)
```

### 4. 类型安全

```
prisma/schema.prisma → Prisma Client
    ↓
src/app/types/next-auth.d.ts → Session 类型扩展
    ↓
src/lib/nav-config.ts → NavItem 类型定义
    ↓
全链路类型安全（数据库 → 服务 → 组件 props）
```
