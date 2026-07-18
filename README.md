Personal Knowledge Agent

一个基于 Next.js + TypeScript 构建的 AI 聊天工作空间，具备知识库管理功能，并支持通过函数调用实现检索。

技术栈：Next.js + TypeScript + TailwindCSS + Zustand + Prisma + PostgreSQL + NextAuth

核心功能:登录/RBAC + Chat(SSE流式+Markdown) + Prompt管理 + Knowledge CRUD + History + Tool Calling(调用你自己的Knowledge Search)
V2:文件上传解析 + MCP + 更多工具
V3:Multi-Agent + Workflow（后期）

## 项目目录结构

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