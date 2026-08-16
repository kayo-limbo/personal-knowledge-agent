# 暑期考核、部署、面试与项目规划

最后更新：2026-08-16
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
- Conversation/Message SQLite 持久化。
- Flash/Pro 多模型选择。
- 普通/深度思考模式选择。
- 聊天模块综合面试文档和多模型独立讲解文档。
- 固定 `searchKnowledge` 关键词检索、上下文注入和可持久化引用来源。
- DeepSeek 自主选择 `searchKnowledge`、`tool_use/tool_result` 回填、最多 4 轮/3 次调用的 Agent 循环、超时取消和工具状态展示。

### 部分完成

- Chat Workspace 主链路已经完成，剩余会话删除、重命名、消息分页、消息状态和 token usage。
- History 已有基础会话列表和消息恢复，但没有独立管理、搜索和分页。
- Knowledge 已完成管理，并已通过模型自主 Tool Calling 接入有限 Agent 循环。

### 尚未开始的核心

- 联网搜索工具和网页引用。
- PostgreSQL 迁移。
- Docker 与线上部署。

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
4. PostgreSQL。
5. 最小 Docker Compose 线上部署。
6. 关键流程测试、功能文档和演示准备。

### P1：尽量完成

1. 联网搜索及网页引用。
2. 用户级限流和 Token/费用保护。
3. 消息模型、思考模式、状态和 token usage 持久化。
4. 会话删除、重命名和消息分页。
5. Nginx + HTTPS。
6. GitHub Actions 基础 CI。

### P2：有明显余量再做

1. 文件上传和解析。
2. Embedding、向量数据库和 rerank。
3. Prompt 管理完整 CRUD。
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

任务：

- 评估 DeepSeek 官方 Web Search 与独立搜索 API。
- 实现受控 `webSearch` 工具。
- 提供自动联网、强制联网、禁止联网选项。
- 返回标题、URL、摘要和发布时间。
- 最终回答显示来源链接。
- 限制搜索次数、结果数和费用。
- 防御搜索结果中的 Prompt Injection。

如果前两阶段延期，降级为“用户手动开启、每次最多搜索一次”，不做复杂自动规划。

### 8 月 30 日—9 月 4 日：最小部署

目标：获得一个稳定、可重复部署的线上验收环境。

任务：

- SQLite 迁移 PostgreSQL。
- 创建 Next.js standalone 多阶段 Dockerfile。
- 创建包含 App 和 PostgreSQL 的 Docker Compose。
- PostgreSQL 使用持久化 volume。
- 生产迁移使用 `prisma migrate deploy`。
- 增加 `/api/health`。
- GitHub Actions 执行 lint、TypeScript 和 build。
- 部署到中国香港 Linux 服务器。
- 验证登录、数据库持久化和 DeepSeek SSE。

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
中国香港 Linux 云服务器
  + Next.js standalone Docker
  + Docker Compose
  + PostgreSQL
  + 持久化 volume
  + 基础 GitHub Actions CI
  + 单一线上环境
```

选择香港节点是为了避免验收进度依赖中国大陆服务器的 ICP 备案流程。腾讯云官方说明，中国香港及境外服务器无需备案，中国大陆境内服务器对外提供网站或 App 服务前需要完成备案：

- https://cloud.tencent.com/document/product/243/18908
- https://cloud.tencent.com/document/api/243/19630

### 第一阶段不做

- staging/production 双环境。
- GitHub Actions 自动 CD 审批。
- 蓝绿或滚动发布。
- 零停机数据库迁移。
- 自动回滚平台。
- Kubernetes。
- Redis 分布式缓存。

### Nginx 和域名

先让 Docker Compose 通过服务器网络稳定运行。Nginx + HTTPS 在核心部署完成且有余量时增加。

如果增加 Nginx，必须关闭 `/api/chat` 的代理缓冲，否则 SSE 可能变成生成完后一次性返回。需要验证整个链路的首字时间，而不是只检查 HTTP 200。

### 数据库

- 本地 `dev.db` 不进入生产，也不提交新的运行数据。
- PostgreSQL 不暴露公网端口，只允许 Compose 内部网络访问。
- 数据保存到命名 volume。
- 生产只运行已有 migration，不使用 `db push` 代替迁移历史。
- 验收版不追求零停机迁移，但迁移前要备份并准备失败处理。

### 基础 CI

Pull Request 或 push 至少执行：

```text
npm ci
npm run lint
npx tsc --noEmit
npm run build
```

验收前不要求自动部署。先使用手动、可记录、可重复的部署命令，理解每一步以后再自动化。

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
- 使用 Docker Compose 部署 Next.js 与 PostgreSQL，并通过 GitHub Actions 执行持续质量检查。

简历只写实际完成并能深入解释的内容。未完成的向量数据库、MCP、Multi-Agent 和自动部署不能提前写入。

## 10. 风险与降级方案

### Tool Calling 延期

保留固定服务端检索，确保 Knowledge 能影响最终回答；Agent 自主判断作为后续增强。

### 联网搜索不稳定

改成用户手动开启、每次只搜索一次，并保留搜索失败时的普通模型回答。

### 部署延期

保留本地 Docker Compose 和现场本地演示，同时准备录像；服务器优先选择无需等待大陆 ICP 备案的香港节点。

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

默认推荐的下一个开发任务是：**复用现有 Agent 工具框架增加受控 `webSearch` 与网页引用；若时间或 API 稳定性不足，则降级为用户手动开启、每次最多搜索一次**。
