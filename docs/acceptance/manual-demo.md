# 人工演示步骤与固定数据

2026-09-09 更新：按用户要求不制作 PPT、不录制视频，直接人工展示项目。

## 演示环境和账号

本轮数据已准备在本地 Docker Compose：`http://localhost:3000`。没有复制到 Neon。两个独立账号的随机密码只保存在根目录 `.env.acceptance-demo.json`，请在编辑器本地查看，不投屏该文件、不提交 Git。

| 账号 | 角色 | 用途 |
| --- | --- | --- |
| summer-assessment@example.com | ADMIN | 完整六页展示、知识问答和 Prompt |
| summer-viewer@example.com | USER | 验证数据隔离和普通角色菜单 |

管理员有三条虚构项目知识：星河项目验收安排、星河项目技术决策、星河项目演示故障预案；还有收藏模板“验收讲解助手”。普通用户只有“隔离验证：我的独立笔记”。数据不包含真实个人隐私。

本地准备命令为 `node scripts/prepare-demo.mjs`。可重复执行，已有同标题知识、模板和密码不会覆盖。不要把它改成生产自动 seed。删除凭据文件不会删除数据库账号，丢失文件后脚本不会擅自重置密码。

## 八分钟人工演示

| 时间 | 操作 | 解释重点 |
| --- | --- | --- |
| 0:00—0:45 | 登录管理员，查看概览与导航 | Next.js 全栈，PostgreSQL 持久化，角色菜单 |
| 0:45—1:45 | 顶部选择知识库，搜索“星河项目”，打开知识编辑查看内容 | 输入被校验，查询按 userId 隔离；侧栏固定 |
| 1:45—2:15 | 查看“验收讲解助手”模板 | CRUD 与聊天选用已经接通；公开意向不等于分享 |
| 2:15—4:00 | 新建聊天，Flash、普通、禁止联网，选择模板，提交下面问题一 | 模型自主调用 searchKnowledge，工具结果回填，回答带来源 |
| 4:00—5:00 | 提交问题二，刷新页面，再从历史打开同一会话 | 多轮上下文与最终回答落库；模型配置不等于 Agent |
| 5:00—6:00 | 搜索历史，重命名为“星河项目验收演示” | 历史管理闭环，可保留本次回答做现场备用 |
| 6:00—7:00 | 无痕窗口登录普通用户，查看其知识库 | 看不到管理员三条知识；不向对方复制项目正文 |
| 7:00—8:00 | 管理员查看用户管理和统计，解释架构与限制 | 服务端最新角色检查、每天配额、有限循环、Render + Neon |

问题一（可直接复制）：

> 根据我的知识库，星河项目什么时候验收、演示多久、负责人是谁？如果公网不可用怎么办？请引用来源。

预期事实：2026-09-13、8 分钟、林同学、公网不可用时切换本地 Compose。措辞可以变化，但应出现知识来源；不能只看答案正确就断言使用了工具，要检查调用轨迹和引用。

问题二：

> 这个项目为什么先使用关键词检索？Agent 的轮数、工具次数和总超时分别是多少？

预期事实：当前没有向量数据库；最多 4 轮、3 次本地工具调用、50 秒。关键词检索的取舍可以结合项目目标解释，但不要把推论冒充笔记原文。

## 可选联网与停止演示

有时间再新建默认会话，选择强制联网，询问“请搜索 Next.js 官方博客最近的一篇发布文章，给出标题、发布日期和官方链接”。检查真实网页来源，不预填固定答案。搜索结果属于不可信输入，供应商内部检索次数不保证严格一次。

停止演示可请求较长的分点说明，看到持续输出后点击停止。当前页面可能保留部分文本，失败/取消回答不承诺已落库；刷新历史确认实际保存结果。不要反复触发请求消耗演示额度。

## 演示前检查

- 提前启动 Docker Desktop，运行 `docker compose --env-file .env.docker up -d`，确认 `/api/health` 为 ok/reachable。
- 如修改过代码，要执行 `docker compose --env-file .env.docker up --build -d app`，仅刷新页面不会更新旧镜像。
- 演示前完成一次知识问答并保留会话；AI不可用时展示这条真实历史记录与代码，不伪造实时结果。
- 公网采用 Render Docker + Neon；最新本轮修复仍需提交、用户 push、CI 和手动部署。不能把 localhost 的数据当成线上已准备。
- 现场同类网络、免费实例冷启动和公网登录后回归仍需验证。暂不新增基础设施。

## Git 提交范围

两处用户 Knowledge 修改必须排除。建议本轮代码与配套说明合为一次验收收尾提交，上一轮侧栏验证文档也可一起记录：

```bash
git add src/auth.ts src/lib/validators/auth.ts src/lib/validators/chat.ts src/lib/chat-stream.ts src/lib/services/prompt.service.ts src/lib/services/conversation.service.ts src/app/api/chat/route.ts src/app/components/dashboard/Header.tsx src/app/components/dashboard/SearchBar.tsx src/app/dashboard/chat src/app/dashboard/prompts tests/dashboard-management.test.ts tests/chat-stream.test.ts scripts README.md docs/README.md docs/features/current-session-permissions.md docs/features/chat-stream-reliability.md docs/features/dashboard-search-entry.md docs/features/chat-prompt-selection.md docs/features/prompt-management.md docs/features/manual-demo-data.md docs/features/dashboard-fixed-sidebar-layout.md docs/acceptance/manual-demo.md docs/acceptance/verification-2026-09-09.md docs/plans/next-session-handoff.md docs/plans/summer-assessment-roadmap.md
git diff --cached --name-only
git commit -m "fix: 完善权限与聊天收尾并准备人工验收数据"
```

助手没有创建 commit 或 push。不要使用 `git add .`，也不要暂存 `.env.acceptance-demo.json`。
