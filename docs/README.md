# 项目学习文档索引

这个目录用于记录每个已完成功能的设计和代码讲解。推荐先阅读总览，再按照功能实现顺序阅读 `features` 下的独立文档。

## 总览

- [`acceptance/manual-demo.md`](acceptance/manual-demo.md)：固定演示账号和数据、八分钟人工展示步骤、预期答案与 Git 提交范围；不制作 PPT 或录屏。
- [`acceptance/verification-2026-09-09.md`](acceptance/verification-2026-09-09.md)：本轮本地测试和浏览器集成结果，以及待公网验证边界。

- [`chat-deepseek-interview-guide.md`](chat-deepseek-interview-guide.md)：聊天模块、DeepSeek 接入、SSE、持久化和 Agent 演进路线的综合面试指南。

## 规划与新对话交接

- [`plans/summer-assessment-roadmap.md`](plans/summer-assessment-roadmap.md)：2026-09-13 暑期验收范围、34 天排期、最小部署方案、面试准备和功能裁剪标准。新对话应先阅读这份文件。
- [`plans/next-session-handoff.md`](plans/next-session-handoff.md)：2026-09-09 最新 Git、验证边界、待发布内容和下一会话执行顺序。

## 功能讲解

- [`features/manual-demo-data.md`](features/manual-demo-data.md)：独立本地演示账号、固定知识和模板的幂等准备与隔离验证。

- [`features/chat-prompt-selection.md`](features/chat-prompt-selection.md)：个人模板选用、会话关联、服务端归属校验和删除后的默认行为。

- [`features/chat-stream-reliability.md`](features/chat-stream-reliability.md)：中文输入保护、SSE 完成确认、异常断流与离页取消。
- [`features/dashboard-search-entry.md`](features/dashboard-search-entry.md)：顶部搜索范围选择与现有知识、历史检索页面的连接。

- [`features/current-session-permissions.md`](features/current-session-permissions.md)：角色修改后旧 JWT 的实时权限同步、登录输入校验与失效用户处理。

- [`features/ai-chat-streaming-deepseek.md`](features/ai-chat-streaming-deepseek.md)：AI 流式对话、SSE、会话持久化、客户端状态和常见类型错误排查。
- [`features/chat-multi-model-thinking.md`](features/chat-multi-model-thinking.md)：Flash/Pro 多模型切换与普通/深度思考模式。
- [`features/fixed-knowledge-search-citations.md`](features/fixed-knowledge-search-citations.md)：固定 `searchKnowledge` 关键词检索、`userId` 隔离、上下文注入、字符预算与引用来源持久化。
- [`features/knowledge-tool-calling-agent.md`](features/knowledge-tool-calling-agent.md)：DeepSeek 自主选择 `searchKnowledge`、`tool_use/tool_result` 回填、有限 Agent 循环、超时取消与工具状态展示。
- [`features/controlled-web-search-citations.md`](features/controlled-web-search-citations.md)：DeepSeek 官方服务端 Web Search、三档控制与实际费用边界、`pause_turn` 和服务端 `tool_use` 续跑、SSE 与安全网页引用。
- [`features/postgresql-prisma-migration.md`](features/postgresql-prisma-migration.md)：Prisma 7 从 SQLite 切换 PostgreSQL、`adapter-pg`、迁移历史重建、连接池、幂等 seed 与验证边界。
- [`features/docker-compose-postgresql-deployment.md`](features/docker-compose-postgresql-deployment.md)：Next.js standalone 多阶段镜像、Compose 启动门禁、真实 PostgreSQL migration/seed、健康检查与 volume 持久化验证。
- [`features/github-actions-basic-ci.md`](features/github-actions-basic-ci.md)：GitHub Actions 的最小权限、Node/npm 缓存、Prisma 生成、测试/Lint/类型/构建门禁与 CI/CD 边界。
- [`features/production-safe-demo-seed.md`](features/production-safe-demo-seed.md)：生产部署默认只迁移、演示 seed 显式执行，以及重复 seed 不重置已有账号密码的安全边界。
- [`features/vercel-neon-free-deployment.md`](features/vercel-neon-free-deployment.md)：最初 Vercel 方案与部署尝试、pooled/direct 分层、Serverless 连接池；当前网络未通过可达性验收。
- [`features/render-neon-free-deployment.md`](features/render-neon-free-deployment.md)：当前实际 Render Free Docker + Neon 公网方案、控制台网址、代理与端口配置、联网兼容修复及已验证/待验收记录。
- [`features/postgresql-chat-daily-quota.md`](features/postgresql-chat-daily-quota.md)：PostgreSQL 用户/全站两级每日聊天配额、Serializable 原子计数、429/Retry-After、真实 Neon migration 与费用保护边界。
- [`features/prompt-management.md`](features/prompt-management.md)：Prompt 的用户隔离 CRUD、收藏/公开标记、Server Action 鉴权与表单校验。
- [`features/conversation-history-management.md`](features/conversation-history-management.md)：独立历史页的搜索、重命名、删除及跳回指定会话的数据流与权限边界。
- [`features/admin-users-system-stats.md`](features/admin-users-system-stats.md)：管理员用户角色管理、禁止自我降权和 PostgreSQL 系统统计聚合。
- [`features/dashboard-fixed-sidebar-layout.md`](features/dashboard-fixed-sidebar-layout.md)：Dashboard 固定侧栏、右侧独立滚动、Flex 约束，以及旧 Docker 镜像排查与六页真实 Chrome 滚动验证。

## 后续文档约定

以后每完成一个独立功能，都新增一份 `docs/features/<功能名>.md`，至少回答以下问题：

1. 这个功能解决了什么问题？
2. 修改了哪些文件，各自负责什么？
3. 数据从哪里来，经过什么处理，最后到哪里？
4. 关键代码为什么这样写？
5. 有哪些安全、性能和一致性风险？
6. 面试官可能怎样提问？
7. 如何验证功能正确？
8. 下一步还能怎样改进？

功能完成后还要更新本索引，并提醒是否需要 Git 提交。
