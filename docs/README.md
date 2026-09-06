# 项目学习文档索引

这个目录用于记录每个已完成功能的设计和代码讲解。推荐先阅读总览，再按照功能实现顺序阅读 `features` 下的独立文档。

## 总览

- [`chat-deepseek-interview-guide.md`](chat-deepseek-interview-guide.md)：聊天模块、DeepSeek 接入、SSE、持久化和 Agent 演进路线的综合面试指南。

## 规划与新对话交接

- [`plans/summer-assessment-roadmap.md`](plans/summer-assessment-roadmap.md)：2026-09-13 暑期验收范围、34 天排期、最小部署方案、面试准备和功能裁剪标准。新对话应先阅读这份文件。

## 功能讲解

- [`features/ai-chat-streaming-deepseek.md`](features/ai-chat-streaming-deepseek.md)：AI 流式对话、SSE、会话持久化、客户端状态和常见类型错误排查。
- [`features/chat-multi-model-thinking.md`](features/chat-multi-model-thinking.md)：Flash/Pro 多模型切换与普通/深度思考模式。
- [`features/fixed-knowledge-search-citations.md`](features/fixed-knowledge-search-citations.md)：固定 `searchKnowledge` 关键词检索、`userId` 隔离、上下文注入、字符预算与引用来源持久化。
- [`features/knowledge-tool-calling-agent.md`](features/knowledge-tool-calling-agent.md)：DeepSeek 自主选择 `searchKnowledge`、`tool_use/tool_result` 回填、有限 Agent 循环、超时取消与工具状态展示。
- [`features/controlled-web-search-citations.md`](features/controlled-web-search-citations.md)：DeepSeek 官方服务端 Web Search、自动/强制/禁止三档、单次搜索费用边界、SSE 状态与安全网页引用。
- [`features/postgresql-prisma-migration.md`](features/postgresql-prisma-migration.md)：Prisma 7 从 SQLite 切换 PostgreSQL、`adapter-pg`、迁移历史重建、连接池、幂等 seed 与验证边界。
- [`features/docker-compose-postgresql-deployment.md`](features/docker-compose-postgresql-deployment.md)：Next.js standalone 多阶段镜像、Compose 启动门禁、真实 PostgreSQL migration/seed、健康检查与 volume 持久化验证。
- [`features/github-actions-basic-ci.md`](features/github-actions-basic-ci.md)：GitHub Actions 的最小权限、Node/npm 缓存、Prisma 生成、测试/Lint/类型/构建门禁与 CI/CD 边界。
- [`features/production-safe-demo-seed.md`](features/production-safe-demo-seed.md)：生产部署默认只迁移、演示 seed 显式执行，以及重复 seed 不重置已有账号密码的安全边界。
- [`features/vercel-neon-free-deployment.md`](features/vercel-neon-free-deployment.md)：Vercel Hobby + Neon Free 的零成本线上架构、pooled/direct 连接分层、Serverless 小连接池、迁移步骤、SSE 与公网验收清单。

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
