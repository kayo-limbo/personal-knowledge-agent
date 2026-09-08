# 暑期考核、部署、面试与项目规划

最后更新：2026-09-08
验收日期：2026-09-13
规划周期：约 34 天

这份文件是新对话的项目交接入口，用来防止上下文过长或切换开发会话后丢失真实进度、范围约束和设计取舍。

## 1. 项目定位

项目定位是“个人知识库 Agent”，不是 Coding Agent，也不是通用多智能体平台。

目标用户可以：

1. 注册并登录自己的账号。
2. 创建和管理个人知识。
3. 与 DeepSeek 进行流式多轮对话。
4. 让模型检索当前用户的知识库并引用来源。
5. 必要时调用联网搜索获得最新信息。
6. 在刷新或重新登录后继续查看历史会话。

验收时最重要的是展示一条完整路径：

```text
登录
  -> 创建知识条目
  -> 提问
  -> Agent 调用 searchKnowledge
  -> 返回带知识来源的答案
  -> 对实时问题调用 webSearch
  -> 返回带网页链接的答案
  -> 刷新后历史仍然存在
```

## 2. 项目原则

### 完整优先于堆叠

一个稳定的 Knowledge Tool Calling Agent，比同时出现但无法讲清楚的向量数据库、MCP、Multi-Agent 和 Kubernetes 更有验收与面试价值。

### 深入理解优先于生成速度

每个功能必须理解：

- 为什么需要它。
- 数据如何流动。
- 客户端与服务端如何分工。
- 安全边界在哪里。
- 为什么选择当前方案。
- 出错时怎样定位。
- 下一版怎样演进。

### 每次完成一个纵向闭环

先完成并验证固定 Knowledge 检索，再升级为 Tool Calling；不要同时引入向量数据库、文件解析、联网搜索和 Agent 循环。

## 3. 当前真实进度

### 已完成

- Credentials 登录、注册、bcrypt 密码哈希。
- JWT Session、用户 id 和 role 传递。
- Dashboard 与角色导航。
- Knowledge 页面、Server Action、Service、REST API CRUD。
- Knowledge 服务端输入校验和 `userId` 权限隔离。
- Chat Workspace、输入区和历史会话侧边栏。
- DeepSeek 官方 API 与 Anthropic 兼容 SDK。
- SSE 流式输出、停止生成和 Markdown 代码高亮。
- Conversation/Message PostgreSQL 持久化。
- Flash/Pro 多模型选择。
- 普通/深度思考模式选择。
- 聊天模块综合面试文档和多模型独立讲解文档。
- 固定 `searchKnowledge` 关键词检索、上下文注入和可持久化引用来源。
- DeepSeek 自主选择 `searchKnowledge`、`tool_use/tool_result` 回填、最多 4 轮/3 次调用的 Agent 循环、超时取消和工具状态展示。
- DeepSeek 官方服务端 Web Search、自动/强制/禁止三档、跨轮工具控制、实时状态和持久化网页来源；上游内部搜索次数不是硬保证。
- Prisma PostgreSQL provider、`adapter-pg`、完整初始 migration、连接池单例、常用索引和幂等 seed 的代码迁移。
- Next.js standalone 多阶段 Dockerfile、Docker Compose、真实 PostgreSQL `migrate deploy`/幂等 seed、健康检查和命名 volume 持久化验证。
- GitHub Actions 基础 CI：Prisma Client 生成、测试、Lint、TypeScript 和生产构建，并已确认远程运行绿色。
- 生产默认只迁移、demo seed 显式执行且不覆盖已有账号密码的部署安全门禁。
- Vercel Hobby + Neon Free 的仓库侧适配：hkg1 单区域、pooled/direct 连接分层、Serverless 小连接池和构建时 Prisma Client 生成。
- Neon Singapore 项目与初始 migration 已完成，无自动 seed；Vercel 已部署但当前网络不可达，已启用 Render Free Docker + Neon 实际公网方案。
- `11e29e5` 已在 Render live：登录注册、Knowledge CRUD/隔离、知识与联网 Agent、Flash/Pro、普通/深度思考、SSE、消息与每日配额持久化均已实测；同一 SHA 重新部署后 Session、Knowledge、Conversation 和配额仍可读取。
- Prompt 用户隔离 CRUD、会话历史搜索/重命名/删除/继续对话、管理员用户角色管理和系统统计页面已通过本地 Docker HTTP/Server Action 验证，等待真实浏览器视觉回归与公网发布验证。

### 部分完成

- Chat Workspace 主链路、会话删除与重命名已经完成，剩余消息分页、消息状态和 token usage。
- History 已有独立搜索、重命名、删除和继续对话页面；当前最多读取最近 50 条，尚未做数据库分页。
- Knowledge 已完成管理，并已通过模型自主 Tool Calling 接入有限 Agent 循环。

### 尚未完成的验收准备

- 真实浏览器中的 Markdown 和“停止”按钮视觉反馈；底层 SSE 取消、上游 Abort 和空占位清理已实测。
- 现场同类网络多次访问，以及 Render Free 休眠后的唤醒体验。
- `11e29e5` 的 GitHub Actions 已由用户在 Actions 页面确认绿色。
- 固定演示数据、PPT、演示脚本和备用录屏。

### 暂不进入验收范围

- MCP。
- Multi-Agent。
- Workflow 编排。
- Kubernetes。
- 多实例缓存。
- 完整 staging/production 双环境。

## 4. 功能优先级

### P0：验收必须完成

1. 固定知识库检索和引用。（已完成）
2. `searchKnowledge` Tool Calling Agent。（已完成）
3. Agent 最大轮数、超时、权限和错误处理。（已完成）
4. PostgreSQL。（代码迁移与真实 PostgreSQL 验收已完成）
5. 免费 Render Docker + Neon 线上部署。（公网功能与跨部署持久化已完成，剩余现场/浏览器人工检查）
6. 关键流程测试、功能文档和演示准备。

### P1：尽量完成

1. 联网搜索及网页引用。（已完成）
2. 用户级与全站每日请求配额。（代码、migration、本地并发和公网跨部署验证已完成；精确 Token 统计延期）
3. 消息模型、思考模式、状态和 token usage 持久化。
4. 会话删除、重命名和消息分页。（删除、重命名已完成，分页延期）
5. Nginx + HTTPS。
6. GitHub Actions 基础 CI。（已在 `0bd56c2` 上确认首次远程绿色运行）

### P2：有明显余量再做

1. 文件上传和解析。
2. Embedding、向量数据库和 rerank。
3. Prompt 管理完整 CRUD。（已完成）
4. 自动 CD、镜像回滚和数据库自动备份。
5. 独立 staging 环境。

## 5. 34 天排期

### 8 月 10 日—8 月 16 日：固定知识检索

目标：聊天第一次真正使用 Knowledge 数据。

状态：已于 2026-08-14 完成固定关键词检索、`userId` 隔离、上下文注入、引用持久化、针对性测试和独立功能文档。

任务：

- 设计 `searchKnowledge` 输入与返回类型。
- 使用标题、正文和标签进行关键词搜索。
- 所有查询按 Session 的 `userId` 隔离。
- 限制命中数量和总字符数。
- 把片段加入模型上下文。
- 回答显示知识条目标题或引用标记。
- 覆盖空结果、越权和超长内容测试。
- 新增独立功能讲解文档。

第一版先由服务端固定检索，不依赖模型自主判断，保证闭环稳定。

### 8 月 17 日—8 月 23 日：Tool Calling Agent

目标：让 DeepSeek 自主决定是否搜索知识库。

状态：已于 2026-08-16 提前完成 Tool Schema、`tool_use/tool_result` 回填、有限循环、普通/思考模式、最多 4 轮/3 次调用、5 秒工具超时、50 秒总超时、取消、错误回填、工具状态展示、调用轨迹持久化和针对性测试。

任务：

- 定义 `searchKnowledge` Tool Schema。
- 处理 `tool_use`。
- 服务端执行工具。
- 把 `tool_result` 返回模型。
- 循环到最终回答。
- 设置最大轮数、超时和取消。
- 保存或记录工具调用。
- 支持普通和思考模式。
- 新增独立 Agent 循环讲解文档。

完成这一阶段后，项目才可以准确称为 Agent。

### 8 月 24 日—8 月 29 日：联网搜索

目标：解决模型训练知识过期问题。

状态：基础实现已于 2026-08-26 完成，支持自动、强制、禁止三档，SSE 状态与持久化网页引用。2026-09-08 发现真实兼容接口的服务端 `tool_use` 总结问题，已修复并通过本地真实集成，待公网发布；同时纠正次数边界：`max_uses: 1` 下上游仍可能内部搜索多次。搜索结果仍视为不可信输入，链接只允许 `http/https`。

任务：

- 评估 DeepSeek 官方 Web Search 与独立搜索 API。
- 实现受控 `webSearch` 工具。
- 提供自动联网、强制联网、禁止联网选项。
- 返回标题、URL、摘要和发布时间。
- 最终回答显示来源链接。
- 限制搜索次数、结果数和费用。
- 防御搜索结果中的 Prompt Injection。

如果前两阶段延期，降级为用户手动开启，不做复杂自动规划；不承诺供应商内部严格搜索一次。

### 8 月 30 日—9 月 4 日：最小部署

目标：获得一个稳定、可重复部署的线上验收环境。

状态：PostgreSQL 与本地 Compose 闭环已完成。免费部署先尝试 Vercel + Neon，随后因当前网络不可达转用 Render Docker + Neon；Neon 两条 migration、公网健康/登录/隔离/知识与联网 Agent/SSE/配额及跨容器持久化已验证，详见 [Render 记录](../features/render-neon-free-deployment.md)。`11e29e5` 的基础 CI 已由用户在 Actions 页面确认绿色。

任务：

- SQLite 迁移 PostgreSQL。（已完成）
- 创建 Next.js standalone 多阶段 Dockerfile。（已完成）
- 创建包含 App 和 PostgreSQL 的 Docker Compose。（本地已完成）
- PostgreSQL 使用持久化 volume。（已完成并完成容器重建验证）
- 生产迁移使用 `prisma migrate deploy`。（已完成）
- 增加 `/api/health`。（已完成）
- GitHub Actions 执行 Prisma Client 生成、测试、lint、TypeScript 和 build。（已完成并确认远程绿色）
- 生产启动与 demo seed 解耦，避免自动创建或重置弱密码演示账号。（已完成）
- 完成 Vercel Hobby + Neon Free 仓库适配。（已完成）
- 在 Neon Singapore 创建项目并用 direct URL 执行 `prisma migrate deploy`。（已完成，无 seed）
- Vercel hkg1 已部署但当前网络不可达；Render Singapore Docker 已 live，不自动 seed。
- 验证登录、用户隔离、数据库持久化、DeepSeek SSE、联网搜索和中国大陆可达性。

### 9 月 5 日—9 月 9 日：质量打磨

- 修复主要 Bug。
- 补充限流与费用保护。
- 完善 Loading、错误、空状态和基础响应式布局。
- 增加关键集成测试。
- 补齐每个功能的学习文档。
- 更新 README、架构图和数据流图。

### 9 月 10 日—9 月 12 日：验收准备

- 准备演示账号和固定演示数据。
- 编写 5—10 分钟稳定演示脚本。
- 录制线上故障时可使用的备用视频。
- 准备本地运行备用方案。
- 整理 PPT、面试问答和简历描述。
- 检查 API Key、测试账号和隐私数据是否泄露。

### 9 月 13 日：验收

不增加新功能，只处理阻断演示的问题。

## 6. 验收版部署决策

### 选择

```text
Render Free（Singapore Docker Web Service）
  + Neon Free PostgreSQL（AWS Singapore）
  + pooled runtime URL / direct migration URL
  + 基础 GitHub Actions CI
  + 单一线上环境
```

预算决策是不购买香港 VPS。最初 Vercel 部署已 Ready，但当前网络无法访问其域名，因此启用原定备用 Render Free + Neon Free。实际网址是 https://personal-knowledge-agent.onrender.com，简历必须如实写 Render Docker + Neon PostgreSQL。免费额度内托管费用为 0，DeepSeek 调用仍收费。

Docker Compose 已完成且继续保留，职责是本地生产模拟、可移植自托管方案和验收现场备用；不再把“香港 Linux Compose 已上线”作为当前目标。

当前 Render 与 Neon 均选择新加坡。Vercel `hkg1` 配置保留作历史尝试，不再同时建设另一套主环境；不能把 Ready 写成该链路已验收。

### 第一阶段不做

- staging/production 双环境。
- GitHub Actions 自动 CD 审批。
- 蓝绿或滚动发布。
- 零停机数据库迁移。
- 自动回滚平台。
- Kubernetes。
- Redis 分布式缓存。

### 容器、Vercel 兼容配置与 SSE

聊天 Route Handler 保持 Node.js runtime 和 `maxDuration = 60`，Agent 业务总超时为 50 秒，给主动取消、错误回填和流关闭留出余量。Vercel 支持 Route Handler 流式响应，但上线后必须测量首字到达和持续增量输出，不能只检查 HTTP 200。

`maxDuration` 不构成 Render Docker 的函数时限，实际业务仍受 50 秒超时保护。Render 到 DeepSeek 的知识与联网 SSE 均已实测。Render Free 空闲约 15 分钟休眠、唤醒约一分钟，演示前暖机并备录屏；还需现场同类网络多次验证。Cloudflare Quick Tunnel 不作为 SSE 主方案。

### 数据库

- Render/Vercel runtime 的 `DATABASE_URL` 使用 Neon 主机名带 `-pooler` 的 pooled connection string。
- migration 在本地通过 `DIRECT_URL` 连接 Neon 非 pooler endpoint，执行 `prisma migrate deploy`。
- Vercel 实例内 `pg` pool 最大连接数为 1，Docker/本地长生命周期进程仍为 10。
- 生产不自动 seed；demo seed 只能显式执行，重复 seed 不重置已有密码。
- 不使用 `prisma db push` 替代生产 migration。
- `DATABASE_URL`、`DIRECT_URL` 和数据库密码不提交 Git、不发送到聊天、不出现在截图或日志中。
- Neon 重新唤醒可能带来冷启动延迟，健康检查和首次登录必须覆盖冷启动场景。

### 基础 CI

状态：工作流代码、本地等价验证和 push 已完成；`0bd56c2`、`73bc63c`、`f3abb8a` 的托管 runner 均已确认成功。新修复提交仍需单独检查。

Pull Request 或 push 至少执行：

```text
npm ci
npm run db:generate
npm test
npm run lint
npm run typecheck
npm run build
```

验收前不要求自动 CD。Render 自动部署已关闭，用户 push 后按 commit SHA 手动部署；Neon migration 由本地使用 direct URL 执行，避免并发迁移和生产自动 seed。

## 7. 面试重点知识地图

### Next.js 与 React

- Server Component、Client Component 和 Route Handler 的运行位置。
- 为什么认证和数据库读取留在服务器。
- 为什么 ChatWorkspace 必须是 Client Component。
- Next.js 16 动态参数、Proxy 和环境变量的变化。

### 认证与安全

- Credentials 登录与 bcrypt。
- JWT Session 如何携带 id 和 role。
- 身份认证与资源授权的区别。
- 为什么数据库查询必须同时包含资源 id 和 userId。
- 为什么 TypeScript 不能替代 Zod。
- API Key、环境变量和 `NEXT_PUBLIC_` 的边界。

### 流式聊天

- SSE 与 WebSocket 的选择。
- 为什么 POST 场景使用 fetch + ReadableStream，而不是 EventSource。
- 网络 chunk 为什么不等于一个 SSE 事件。
- TextDecoder、buffer 和 AbortController。
- 代理缓冲为什么会破坏流式体验。

### LLM 与 Agent

- system prompt、messages、上下文窗口和 token。
- Flash/Pro 与普通/思考模式的取舍。
- 思考模式为什么不是 Agent。
- Tool Schema、tool_use、tool_result 和有限循环。
- 如何限制工具次数、超时和费用。
- 搜索内容为什么可能包含 Prompt Injection。

### 数据库

- User、Conversation、Message、KnowledgeDoc 的关系。
- SQLite 和 PostgreSQL 的适用场景。
- Prisma Migration 与 `migrate deploy`。
- 事务、幂等性、分页和消息状态。
- 为什么流式生成时不能每个 token 都写一次数据库。

### 部署

- Vercel Serverless Functions、函数区域和执行时长边界。
- Neon pooled runtime URL 与 direct migration URL 的职责分离。
- 为什么 Serverless 实例内使用小连接池，并由 PgBouncer 汇聚连接。
- Docker 多阶段构建和 standalone 输出。
- Docker image、container、volume 和 network。
- Docker Compose 如何组织 App 与 PostgreSQL。
- 运行时环境变量为什么不写入镜像。
- 健康检查、日志、数据持久化和失败恢复。
- 如果加入 Nginx，如何保证 SSE 不缓冲。

## 8. 验收演示脚本

建议控制在 5—10 分钟：

1. 简短说明项目目标和技术栈。
2. 注册或使用准备好的账号登录。
3. 新建一条只有当前用户可见的知识。
4. 在聊天页选择 Flash/Pro 和思考模式。
5. 提问与知识条目相关的问题。
6. 展示 Agent 调用 Knowledge 搜索并引用来源。
7. 提问需要最新信息的问题，展示联网搜索和链接。
8. 刷新页面，证明会话和回答已持久化。
9. 展示一张架构图，说明服务端安全与数据流。
10. 主动说明当前限制和下一步，而不是等待老师指出。

必须准备：

- 线上环境。
- 本地可运行环境。
- 备用演示视频。
- 固定演示问题和知识数据。
- 不依赖临时生成质量的可预测流程。

## 9. 简历表达方向

项目名称可以写：个人知识库 Agent。

描述重点：

- 基于 Next.js 16、TypeScript、NextAuth、Prisma 和 PostgreSQL 构建全栈个人知识助手。
- 接入 DeepSeek V4 Flash/Pro，支持思考模式、SSE 流式输出和多轮会话持久化。
- 设计用户级知识检索与 Tool Calling Agent 循环，实现权限隔离、引用来源和联网搜索。
- 使用 Render Docker + Neon PostgreSQL 提供免费额度内的线上演示，并保留 Docker Compose 本地备用，通过 GitHub Actions 执行持续质量检查。（完成剩余公网验收后再写入简历，不声称 Vercel 已验收）

简历只写实际完成并能深入解释的内容。未完成的向量数据库、MCP、Multi-Agent 和自动部署不能提前写入。

## 10. 风险与降级方案

### Tool Calling 延期

保留固定服务端检索，确保 Knowledge 能影响最终回答；Agent 自主判断作为后续增强。

### 联网搜索不稳定

降级为用户手动开启或现场禁止联网并使用固定知识；保留明确错误提示。不承诺供应商内部严格一次，也不把未实现的失败后自动降级写成已有功能。

### 部署延期

保留本地 Docker Compose 和现场本地演示，同时准备录像。当前已启用 Render Free + Neon；演示前暖机，避免将免费实例冷启动误认为故障，不同时扩展两套线上环境。

### PostgreSQL 迁移失败

先保留 SQLite 分支和数据库备份，在独立分支完成迁移，不直接破坏可演示版本。

### API 额度或服务异常

准备账户余额、低成本 Flash 默认配置、明确错误提示和固定演示录像。

### 范围失控

优先砍掉向量数据库、文件上传、Prompt 完整管理、多环境部署、MCP 和 Multi-Agent，不能砍掉知识检索、权限、稳定演示和文档。

## 11. 新对话启动检查清单

新开发对话开始时应先执行：

1. 完整阅读根目录 `AGENTS.md`。
2. 阅读本文件和 `docs/README.md`。
3. 阅读 `README.md` 的当前进度。
4. 运行 `git status --short` 和 `git log --oneline -5`。
5. 检查是否存在用户未提交的改动，不覆盖 `dev.db` 或其他本地数据。
6. 检查目标功能对应的 Next.js 16 本地文档。
7. 只选择当前最高优先级的一个纵向功能块。
8. 实现后运行 lint、TypeScript、build 和针对性测试。
9. 新增独立中文功能讲解并更新文档索引。
10. 提醒用户需要提交的文件和具体中文 commit message，不自动提交。

默认推荐的下一个任务是：**准备固定演示数据、5—10 分钟演示脚本、PPT 和备用录屏，并用验收当天同类浏览器/网络检查 Markdown、停止按钮和 Render 休眠唤醒**。数据库、服务、联网修复和每日配额已完成，不重复创建基础设施；不自动 seed，不扩展新技术范围。
