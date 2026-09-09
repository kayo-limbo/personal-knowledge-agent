# 人工演示步骤与固定数据

2026-09-09 更新：按用户要求不制作 PPT、不录制视频，直接人工展示项目。

## 演示环境和账号

本轮数据已准备在本地 Docker Compose：`http://localhost:3000`。没有复制到 Neon。两个独立账号的随机密码只保存在根目录 `.env.acceptance-demo.json`，请在编辑器本地查看，不投屏该文件、不提交 Git。

| 账号 | 角色 | 用途 |
| --- | --- | --- |
| summer-assessment@example.com | ADMIN | 完整六页展示、知识问答和 Prompt |
| summer-viewer@example.com | USER | 验证数据隔离和普通角色菜单 |

管理员有三条虚构项目知识：星河项目验收安排、星河项目技术决策、星河项目演示故障预案；还有收藏模板“验收讲解助手”。普通用户只有“隔离验证：我的独立笔记”。数据不包含真实个人隐私。文件导入演示使用仓库内的 `docs/acceptance/demo-import-source.md`，其中同样只有虚构资料。

本地准备命令为 `node scripts/prepare-demo.mjs`。可重复执行，已有同标题知识、模板和密码不会覆盖。不要把它改成生产自动 seed。删除凭据文件不会删除数据库账号，丢失文件后脚本不会擅自重置密码。

## 八分钟人工演示

| 时间 | 操作 | 解释重点 |
| --- | --- | --- |
| 0:00—0:45 | 登录管理员，查看概览与导航 | Next.js 全栈，PostgreSQL 持久化，角色菜单 |
| 0:45—1:45 | 打开知识库，点击“导入文件”，选择 `demo-import-source.md` 并添加“演示”标签 | 服务端校验、文本提取、分块；原始文件不落 Render 磁盘 |
| 1:45—2:15 | 确认列表出现 `source=upload` 条目，再查看“验收讲解助手”模板 | 文件变成当前用户的可检索知识；Prompt 与聊天已接通 |
| 2:15—4:00 | 新建聊天，Flash、普通、禁止联网，选择模板，提交下面问题一 | 模型自主调用 searchKnowledge，混合检索回填，回答带文件来源 |
| 4:00—5:00 | 提交问题二，刷新页面，再从历史打开同一会话 | 多轮上下文与最终回答落库；混合文本检索不等于向量语义检索 |
| 5:00—6:00 | 搜索历史，重命名为“星河项目验收演示” | 历史管理闭环，可保留本次回答做现场备用 |
| 6:00—7:00 | 无痕窗口登录普通用户，查看其知识库 | 看不到管理员三条知识；不向对方复制项目正文 |
| 7:00—8:00 | 管理员查看用户管理和统计，解释架构与限制 | 服务端最新角色检查、每天配额、有限循环、Render + Neon |

问题一（可直接复制）：

> 根据我刚导入的 Polaris 灾备运行手册，恢复目标是多少、演练代号是什么、每周什么时候人工检查？请引用来源。

预期事实：15 分钟、雪松、每周二 16:30。措辞可以变化，但应出现 `demo-import-source.md` 知识来源；不能只看答案正确就断言使用了工具，要检查 `searchKnowledge` 调用轨迹和引用。

问题二：

> 根据原有星河项目知识，这个 Agent 的轮数、工具次数和总超时分别是多少？如果公网不可用怎么办？

预期事实：最多 4 轮、3 次本地工具调用、50 秒；公网不可用切换本地 Docker Compose。当前检索是中文关键词与 PostgreSQL 英文全文排名的混合方案，没有 Embedding，不能介绍成向量数据库或完整语义检索。

## 可选联网与停止演示

有时间再新建默认会话，选择强制联网，询问“请搜索 Next.js 官方博客最近的一篇发布文章，给出标题、发布日期和官方链接”。检查真实网页来源，不预填固定答案。搜索结果属于不可信输入，供应商内部检索次数不保证严格一次。

停止演示可请求较长的分点说明，看到持续输出后点击停止。当前页面可能保留部分文本，失败/取消回答不承诺已落库；刷新历史确认实际保存结果。不要反复触发请求消耗演示额度。

## 演示前检查

- 提前启动 Docker Desktop，运行 `docker compose --env-file .env.docker up -d`，确认 `/api/health` 为 ok/reachable。
- 如修改过代码，要执行 `docker compose --env-file .env.docker up --build -d app`，仅刷新页面不会更新旧镜像。
- 需要重复演示导入时，先删除上次生成的同名上传知识分块，避免列表出现重复；当前版本没有文件级去重。
- 演示前完成一次知识问答并保留会话；AI不可用时展示这条真实历史记录与代码，不伪造实时结果。
- 公网采用 Render Docker + Neon；最新本轮修复仍需提交、用户 push、CI 和手动部署。不能把 localhost 的数据当成线上已准备。
- 现场同类网络、免费实例冷启动和公网登录后回归仍需验证。暂不新增基础设施。

## 文件导入功能的 Git 提交范围

两处用户 Knowledge 修改必须排除。建议本轮代码与配套说明合为一次验收收尾提交，上一轮侧栏验证文档也可一起记录：

```bash
git add package.json package-lock.json next.config.ts src/app/api/knowledge/import src/app/dashboard/knowledge/components/KnowledgeImportDialog.tsx src/app/dashboard/knowledge/components/KnowledgeToolbar.tsx src/lib/knowledge-import.ts src/lib/knowledge-search.ts src/lib/services/knowledge-import.service.ts src/lib/services/knowledge-search.service.ts tests/knowledge-import.test.ts tests/knowledge-search.test.ts scripts/verify-acceptance.mjs README.md docs/README.md docs/features/file-import-hybrid-knowledge-search.md docs/acceptance/demo-import-source.md docs/acceptance/manual-demo.md docs/acceptance/verification-2026-09-09.md docs/plans/next-session-handoff.md docs/plans/summer-assessment-roadmap.md
git diff --cached --name-only
git commit -m "feat(knowledge): 支持文件导入与混合检索"
```

不要使用 `git add .`，不要暂存 `.env.acceptance-demo.json`，也不要把两处既有 Knowledge 修改混入本功能提交。
