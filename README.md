Personal Knowledge Agent

一个基于 Next.js + TypeScript 构建的 AI 聊天工作空间，具备知识库管理功能，并支持通过函数调用实现检索。

技术栈：Next.js 16 + React 19 + TypeScript + TailwindCSS + Zustand + Prisma + SQLite + NextAuth

V1 目标:登录/RBAC + Chat(SSE流式+Markdown) + Prompt管理 + Knowledge CRUD + History + Tool Calling(调用自己的 Knowledge Search)
V2:文件上传解析 + MCP + 更多工具
V3:Multi-Agent + Workflow（后期）

## 当前进度

已经可以使用或已经打通：

- Credentials 登录、JWT Session 和角色导航
- 紧凑型登录页、注册页、注册输入校验和 bcrypt 密码哈希
- Dashboard 数据概览
- DeepSeek V4 Flash/Pro 多模型选择、普通/深度思考模式、SSE 流式输出和会话历史持久化
- Knowledge 页面、Server Action、Service 和 REST API 的 CRUD
- Prisma SQLite 数据模型、迁移和种子数据

正在开发：

- Prompt、History、Admin、Analytics 仍是规划路由
- Knowledge Tool Calling、文件解析、MCP 和 Multi-Agent 尚未开始

## 配置 DeepSeek API

本项目默认使用低成本、低延迟的 `deepseek-v4-flash`，聊天输入区也允许用户按每次请求切换 `deepseek-v4-pro`，并选择普通或深度思考模式。为了复用现有流式聊天代码，服务端通过 Anthropic SDK 调用 DeepSeek 官方提供的 Anthropic 兼容接口；SDK 只是协议客户端，实际请求仍直接发送到 `https://api.deepseek.com/anthropic`。

1. 复制 `.env.example` 为 `.env`。
2. 在 [DeepSeek 开放平台](https://platform.deepseek.com/) 创建 API Key。
3. 将 Key 填入 `DEEPSEEK_API_KEY`，不要使用 `NEXT_PUBLIC_` 前缀。
4. 重启 `npm run dev`，让 Next.js 重新读取环境变量。

```env
DEEPSEEK_API_KEY="sk-..."
DEEPSEEK_MODEL="deepseek-v4-flash"
```

API Key 只会由 `src/lib/deepseek.ts` 在服务端读取，不会发送给浏览器。当前每次请求最多携带最近 30 条、合计约 24,000 字符的历史消息；普通模式最多生成 1024 tokens，深度思考模式最多生成 4096 tokens。

`DEEPSEEK_MODEL` 决定页面首次打开时的默认模型，用户之后可以在聊天输入区切换。官方接口和当前支持的模型可能更新，请以 [DeepSeek API 文档](https://api-docs.deepseek.com/) 为准。

> 学习文档统一从 [`docs/README.md`](docs/README.md) 开始阅读；完整聊天面试指南见 [`docs/chat-deepseek-interview-guide.md`](docs/chat-deepseek-interview-guide.md)。

## 第一次阅读本项目

推荐按照一次请求经过的顺序阅读：

1. `prisma/schema.prisma`：先看系统保存哪些数据。
2. `src/auth.ts`：理解登录后如何把用户 id 和 role 放入 Session。
3. `src/app/dashboard/knowledge/page.tsx`：页面如何取得当前用户并读取数据。
4. `src/app/dashboard/knowledge/actions/knowledge.ts`：浏览器表单如何调用服务端代码。
5. `src/lib/validators/knowledge.ts`：为什么服务端仍然需要校验输入。
6. `src/lib/services/knowledge.service.ts`：业务逻辑如何通过 Prisma 读写数据库。
7. `src/app/api/knowledge/route.ts`：同一套业务逻辑如何暴露为 REST API。
8. `src/app/api/chat/route.ts`：理解 DeepSeek、SSE 与消息持久化如何串联。

Knowledge 新建流程可以简化为：

```text
KnowledgeForm（浏览器）
  -> createKnowledgeAction（认证 + 校验）
  -> createKnowledge（业务逻辑）
  -> Prisma
  -> SQLite dev.db
  -> revalidatePath 刷新页面
```

常用检查命令：

```bash
npm run dev
npm run lint
npx tsc --noEmit
npm run build
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
