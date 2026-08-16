<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:project-learning-rules -->
# 功能讲解与 Git 提醒

- 每完成一个独立功能，都要在 `docs/features/` 下新增或更新一份独立的中文讲解文件，并同步更新 `docs/README.md` 索引。
- 功能文档至少包含：目标与结果、相关文件职责、数据流、关键代码解释、设计取舍、面试重点、易错点、验证方法和后续改进。
- 讲解要面向第一次做 Agent 项目的学习者，解释“为什么这样写”，不能只罗列文件名。
- 每完成一块功能后，都要明确告诉用户当前改动是否需要提交 Git；需要时给出具体的 `git add` 范围和符合仓库习惯的中文提交说明。
- 除非用户明确要求提交，否则只提醒并给出命令，不自动创建 Git commit。
<!-- END:project-learning-rules -->

<!-- BEGIN:summer-assessment-constraints -->
# 暑期考核项目约束

- 这是用于暑期考核和后续实习简历的个人知识库 Agent，验收截止日期是 **2026-09-13**。
- 截止日期前优先保证“功能闭环、稳定演示、能够深入讲解”，不要为了堆技术扩大范围。
- 开始新任务前先阅读 `docs/plans/summer-assessment-roadmap.md`，并结合 `README.md`、`docs/README.md` 和当前 Git 状态确认真实进度，不要根据旧对话重复实现已完成内容。

## 当前真实进度

- 已完成：登录注册、JWT Session、角色权限、Knowledge CRUD、Chat Workspace、DeepSeek SSE、Markdown、停止生成、会话持久化、Flash/Pro 与普通/深度思考模式、固定 `searchKnowledge` 检索、上下文注入、引用来源，以及有最大轮数、超时、取消和错误回填的 Tool Calling Agent 循环。
- 尚未完成的核心：受控联网搜索、PostgreSQL 和部署。
- 思考模式只是单次 LLM 请求配置，不等于 Agent；具备“模型选工具—服务端执行—结果回填—有限循环”后才算 Agent。

## 验收前优先级

1. 固定知识检索已经完成：按 Session 的 `userId` 搜索 Knowledge，并生成带来源回答。
2. `searchKnowledge` Tool Calling 和有最大轮数、超时、错误处理的 Agent 循环已经完成。
3. 下一步复用工具框架增加受控联网搜索；若进度延期，可以降级为用户手动开启、每次只搜索一次。
4. 把 SQLite 迁移到 PostgreSQL，完成单环境、可复现的最小 Docker 部署。
5. 最后集中处理测试、费用保护、交互细节、文档、PPT、演示数据和备用录屏。

## 验收部署范围

- 首选中国香港 Linux 云服务器，避免把验收进度依赖于中国大陆节点的 ICP 备案流程。
- 验收版只要求：Next.js standalone Docker 镜像、Docker Compose、Next.js + PostgreSQL、持久化 volume、`prisma migrate deploy`、健康检查、基础 GitHub Actions CI 和一个线上环境。
- Nginx + HTTPS 有余量再做；必须验证 SSE 端到端不被代理缓冲。
- 验收前不要主动扩展 staging/production 双环境、自动 CD 审批、零停机迁移、自动回滚平台、Kubernetes、Redis 多实例缓存等运维范围。
- 验收前明确延期：MCP、Multi-Agent、Workflow；文件上传、向量数据库和复杂 RAG 只有核心闭环提前完成时再考虑。

## 实施原则

- 每次只做一个可以单独验证和演示的纵向功能块，不同时引入多个陌生基础设施。
- 安全边界必须保留：API Key 只在服务端、所有输入运行时校验、所有用户数据查询按 `userId` 隔离、搜索结果视为不可信输入。
- 每个功能必须有测试或明确的手工验证清单、独立中文讲解文档和 Git 提醒。
- 面试价值以“能解释设计、取舍、风险和改进”为准，不以使用的工具数量为准。
<!-- END:summer-assessment-constraints -->
