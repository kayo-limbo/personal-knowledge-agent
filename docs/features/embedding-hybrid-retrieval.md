# Embedding 与 pgvector 混合检索

验证状态更新（2026-09-15，后续执行）：功能已提交 `aa0ddf1`；独立本机 pgvector 三条 migration、生命周期集成测试、登录后索引接口权限回归均通过。standalone 同源误拒绝已修复；45 项单元测试、Lint 和生产构建通过。真实 Key/接口地址尚未配置，中文效果与公网发布仍未验证。下文“本轮 Docker 不可用/未提交”为最初实现时的历史状态。

## 1. 目标与结果

原检索依赖标题、正文、标签中的文字重合。比如笔记写 `AbortController 中断上游请求`，提问却说“让模型别继续生成”，两者可能没有共同关键词。Embedding 将两段文本编码为数字向量，允许按语义接近程度召回。

2026-09-15 用户明确要求开始这一升级，覆盖此前“没有 Embedding Key，延期”的范围决定。当前已实现向量入库、混合召回、引用、状态展示、补建/重试入口、测试和评测脚本。**代码完成不等于真实语义效果已验证**：本轮尚无供应商 Key；本地 Docker 引擎不可用，真实 pgvector 集成测试和公网部署仍待执行。

默认接入百炼 `text-embedding-v4`，固定 1024 维，使用其 OpenAI 兼容协议。没有配置 Key 时保持原有文本检索。更换模型只能选择支持该协议及 1024 维的模型；修改环境变量不会自动转换已有向量。

## 2. 相关文件职责

| 文件 | 职责与为什么这样拆 |
| --- | --- |
| `src/lib/embedding.ts` | 配置校验、分块、指纹和接口响应校验；不依赖数据库，便于测试异常响应 |
| `src/lib/knowledge-embedding-index.ts` | 索引租约、原子发布、失败恢复、状态统计和用户隔离的向量查询；由网页服务与脚本复用 |
| `src/lib/knowledge-retrieval.ts` | 并行召回文本与向量候选，评测和聊天使用同一检索管线 |
| `src/lib/knowledge-search.ts` | 词法排序、RRF 融合、片段与引用预算，纯函数便于测试 |
| `src/lib/services/knowledge-embedding.service.ts` | `server-only` 边界、读取环境配置、`after()` 后台任务和失败降级 |
| `src/lib/services/knowledge.service.ts` / `knowledge-import.service.ts` | 保存知识后安排索引，保留原有返回类型和用户数据 |
| `src/app/api/knowledge/embeddings/route.ts` | 当前账号状态与一批补建入口；鉴权、角色和同源检查 |
| `src/app/dashboard/knowledge/components/KnowledgeEmbeddingStatus.tsx` | 展示就绪/待处理/处理中/失败，允许刷新和继续处理 |
| `prisma/migrations/20260915000000_add_knowledge_embeddings/migration.sql` | 扩展、表、外键、更新失效触发器；触发器不能由 Prisma schema 表达 |
| `scripts/knowledge-embeddings.ts` | 显式按用户查询状态、补建、对比评测；不在生产启动时自动执行 |
| `tests/embedding.test.ts` / `embedding.integration.test.ts` | 纯逻辑/接口测试与真实 PostgreSQL 生命周期测试 |

## 3. 数据流

### 新建、修改、导入

```text
Session userId → 校验输入 → KnowledgeDoc 保存成功 → 立即返回
                                             ↓ after()
            最多 20 条知识、总计 25 秒 → 抢占索引租约
                                             ↓
         每块 1000 Unicode 码点，重叠 150 → 每批最多 10 个输入
                                             ↓
           Embedding API → 检查响应 → 核对知识仍未变化
                                             ↓
                        短事务发布全部向量和 ready 状态
```

文件导入原有 6000 字符知识条目保持不变；向量层再分成更小的块，避免整篇知识的语义被稀释。每个输入包含标题、标签、摘要和该块正文。数据库另存纯正文块，因此回答引用展示的是实际命中原文，而不是编码输入里的辅助标签。

`after()` 不等于持久化任务队列。进程退出时任务可能中断，超过 20 条或 25 秒的部分保持待处理；页面按钮可以继续补建。过期的处理中任务会重新成为待处理状态。这个限制是有意控制单次资源消耗，不承诺上传后全部向量立即可用。

### 提问

```text
Agent 选择 searchKnowledge
  ├─ 原有关键词 + PostgreSQL 全文召回 → 文本排名
  └─ 问题 embedding → 用户范围内余弦相似度 → 每条知识最佳片段
                    ↓
                  RRF 融合 → 最多 5 条、6000 字符上下文预算
                    ↓
            tool_result → 带来源回答 → 原有持久化流程
```

生成问题向量最多等待 2.5 秒，以适应原有 5 秒工具预算。这里的 2.5 秒主要约束供应商请求，不是整次数据库检索的硬时限。供应商失败时返回空的语义候选，文本召回继续生效。评测脚本则主动报错，避免把降级后的结果误认为真实向量表现。

## 4. 关键代码解释

### 4.1 为什么需要模型指纹

两个模型即使输出都是 1024 维，各维度的含义也可能完全不同。`modelKey` 对接口地址、模型名、维度和分块版本做哈希。检索只读取相同 `modelKey` 的就绪索引。轮换 API Key 不会改变指纹；更换模型或地址则需要补建。

### 4.2 为什么既有触发器又有内容指纹

数据库触发器在标题、正文、摘要或标签真正变化时删除旧索引，外键顺带删除旧向量，涵盖 ORM、脚本和直接 SQL 更新入口。仅靠应用层“修改后再删除”会留下遗漏入口或短暂错误窗口。

向量生成比较慢。在请求供应商期间，用户可能再次修改或删除知识。因此发布时先按 `userId + id` 锁住知识行，再比较 `sourceHash` 和任务 `claimToken`。过期任务不能把旧结果覆盖到新知识上。

### 4.3 为什么不能把 API 调用放进事务

持有数据库锁等待远程 HTTP 会占用连接，并阻塞修改操作。实现分为“短事务领任务 → 事务外调用供应商 → 短事务发布”。租约为 60 秒，大于单轮 25 秒处理预算；失败后冷却一分钟，降低重复点击造成的费用。同一文档有有效租约时其他任务跳过。

这不是严格的 exactly-once：服务崩溃、索引失效或租约到期仍可能重新产生供应商费用。它保证旧任务不能发布覆盖新任务，不保证外部请求恰好收费一次。

### 4.4 为什么采用 RRF

文本分数和余弦相似度不在同一个量纲，直接相加很难解释权重。RRF 按每一路中的名次投票：`1 / (60 + rank)`，其中 rank 从 1 开始。两个列表都命中的知识往往更靠前。先融合候选再截断到 5 条，避免过早丢弃有用结果。

纯语义命中不要求含有关键词。若继续使用原来“关键词分数大于 0”的过滤，新增向量检索就会被悄悄抵消。两路命中同一知识时，最终使用向量召回的具体原文片段。

### 4.5 为什么第一版使用精确向量检索

当前个人知识库规模小，先通过 `userId` 和模型过滤，再计算余弦相似度。第一版未加 HNSW 近似索引，避免引入全局近似召回后再过滤用户所导致的漏召回。规模增长后需要基于实测延迟、召回率和隔离条件选择索引，不能声称当前已实现百万级检索。

## 5. 配置与启用

### 本地或 Render 服务端配置

```dotenv
EMBEDDING_API_KEY=在本地环境文件或服务控制台填写真实Key
EMBEDDING_BASE_URL=从百炼控制台复制与Key地域一致的兼容baseURL
EMBEDDING_MODEL=text-embedding-v4
EMBEDDING_MIN_SIMILARITY=0.35
```

URL 不包含结尾 `/embeddings`，使用 HTTPS；不要把 Key 放入聊天、Git、浏览器代码或 `NEXT_PUBLIC_` 变量。配置后会将知识片段及提问发给所选 embedding 服务。聊天模型配置仍独立使用 DeepSeek。

0.35 只是可调初始相似度门槛，不代表 35% 正确率。模型和资料不同，分数分布也不同，需通过下方评测确定。不要默认 top-k 返回的每个结果都相关。

### 数据库与部署顺序

1. 先在独立测试库验证 migration 和集成测试。
2. 确认 PostgreSQL 有 `vector` 扩展；Neon 支持 pgvector，本地 Compose 使用 `pgvector/pgvector:pg17`。
3. 备份现有数据库，再执行 `prisma migrate deploy`。不要 `db push`，不要删除旧数据 volume。
4. 配置 Key 和地址、部署应用，再刷新知识库的索引状态。
5. 点击“更新语义索引”，有待处理则继续点击；失败至少等待一分钟后重试。
6. 测试真实问题、更新、删除和账号隔离，最后做公网回归。

Compose 的数据库镜像从 Alpine 切换为 pgvector 镜像，PostgreSQL 主版本仍为 17。**旧 volume 未在本轮切换或重建验证**；跨基础镜像的 locale/collation 兼容性需要检查，稳妥做法是备份后恢复到新建的 pgvector 测试卷验证，再安排切换。首次不要直接对旧演示实例运行全量升级命令。

### 显式命令

脚本按 Next.js 规则读取 `.env.local` / `.env`，所有操作都要求指定真实 userId，避免默认遍历所有账号。

```powershell
npm run knowledge:embeddings -- status <userId>
npm run knowledge:embeddings -- rebuild <userId>
npm run knowledge:embeddings -- evaluate <userId> docs/acceptance/embedding-evaluation.example.json
```

`rebuild` 单次最多 20 条、25 秒；看到 pending 后可以继续运行。索引就绪的条目不会重复生成。准备评测集时把示例 ID 替换为当前账号真实知识 ID；脚本会拒绝其他账号的 ID。

## 6. 设计取舍与边界

- 继续使用已有 PostgreSQL，未引入单独向量数据库、Redis、队列服务或 Multi-Agent。
- 数据库事务保证索引和向量一起发布；缺索引或状态非 ready 时走文本能力。
- `after()` 用于响应后尝试更新，不提供可靠后台调度；按钮和脚本承担恢复入口。
- 元数据仍按知识条目引用，一条知识仅取最佳语义片段；没有跨多个片段的 reranker。
- 当前页面仅展示账号级统计，不展示每块向量或敏感输入；手工刷新状态后看到后台结果。
- 所有 SQL 使用 Prisma 参数绑定；查询先限制 Session userId，搜索内容继续按不可信材料处理。
- 沿用聊天请求配额；索引每批有数量、时限、租约和失败冷却，但未实现每日 embedding token 总预算。
- 请求和更新失败只记录固定说明，不记录供应商原始响应、知识正文或 Key；代价是细粒度故障定位需再补充脱敏错误码。

## 7. 面试重点

1. Embedding 模型负责编码语义，聊天模型负责推理与回答；向量检索本身不等于 Agent。
2. 为什么不能混用不同模型的向量？维度一样也不意味着坐标空间一致。
3. 为什么保留关键词？精确术语、编号、代码标识符未必能被语义模型可靠区分。
4. 修改知识时怎样避免旧索引污染回答？数据库触发失效 + 发布前内容校验 + 任务 token。
5. 为什么用租约而不是长事务？避免网络等待期间占用数据库连接和行锁。
6. 如何证明升级有效？使用固定真实问题比较 Hit@5、Recall@5、无答案误召回与延迟，不以接通 API 为验收标准。

## 8. 易错点

- 把旧的 `rankKnowledgeCandidates` 再套在纯语义候选上，会过滤掉没有关键词的命中。
- 忘记 import/脚本的写入入口会导致旧向量长期残留；触发器必须随 migration 发布。
- 供应商返回数组不保证顺序，必须检查 `index` 后恢复顺序；重复索引、缺失向量、零向量、维度错误均拒绝。
- 有 `EMBEDDING_API_KEY` 但无地址属于配置错误，不能猜测地域或静默把凭据发往默认地址。
- `after()` 完成之前 UI 显示 pending 是正常状态，不应谎报“全部知识可语义检索”。
- 尚未迁移或未配置 Key 时页面可明确提示，不能在简历写成“线上语义检索已验收”。

## 9. 验证方法与本轮结果

已完成：Prisma Client 生成；44 项自动化测试；Lint；TypeScript；生产构建。生产构建通过时使用进程级临时 PostgreSQL 占位地址，未连接数据库，也未修改已有环境文件。原环境构建曾因非 PostgreSQL 地址失败。

运行检查：本机生产服务器启动成功，未登录访问索引接口的 GET 和 POST 均返回 401；未包含登录后的浏览器验收。

未完成：真实百炼调用、真实中文效果指标、本机 pgvector 集成测试、浏览器登录后交互和 Render 部署。本机 Docker 引擎未就绪，未对旧 Compose 或 Neon 执行 migration。集成测试在未配置 `EMBEDDING_TEST_DATABASE_URL` 时显示 SKIP，不能算通过。

CI 已配置独立 pgvector 服务、先 migration 再集成测试；尚未 push，不能声称远程 CI 通过。

本地集成测试使用专用本机数据库，名称必须以 `_embedding_test` 结尾。测试自行创建隔离的测试账号，结束时仅清理这些账号的资料，模拟供应商向量响应，不调用收费接口。

```powershell
# 前提：已经在独立的本机 pgvector 测试库执行全部 migration。
$env:EMBEDDING_TEST_DATABASE_URL = 'postgresql://测试用户:测试密码@127.0.0.1:5432/pka_embedding_test'
npm run test:embeddings:integration
```

手工回归清单：

- [ ] 未配置 Key，知识增改、文件导入和聊天文本检索仍正常。
- [ ] 配置 Key 后新建知识先保存，随后索引成为 ready。
- [ ] 导入较大文件后可通过补建处理全部 pending。
- [ ] 旧资料补建两次，第二次 completed 为 0。
- [ ] 修改知识立即失效；等待后台或点击重试后只返回新原文。
- [ ] 删除知识后搜索不再出现该来源。
- [ ] 两个账号内容相似，来源始终属于各自账号。
- [ ] 关闭供应商或模拟 429，聊天仍有文本检索；失败任务可冷却后恢复。
- [ ] 20 道示例问题改成真实 IDs 后完成评测，记录无答案误召回。
- [ ] 登录页面状态、按钮等待/错误反馈，以及公网 SSE、来源持久化回归。

## 10. 后续改进

优先用真实资料校准分块和阈值，补充每种错误的脱敏诊断、索引每日预算和小规模用户评测。数据量增长后再考虑 HNSW、精确 token 分块、reranker 或持久化任务队列；这些均未在本轮实现。

## 11. Git 提醒

本功能需要提交 Git，但建议先完成真实数据库集成测试与配置后的回归。本轮未 commit、push 或部署。`README.md`、`docs/README.md`、`src/lib/services/knowledge.service.ts` 原本已有改动，应使用 `git add -p` 只选择本轮新增部分。

```powershell
git add .env.example .env.docker.example compose.yaml package.json .github/workflows/ci.yml prisma/schema.prisma prisma/migrations/20260915000000_add_knowledge_embeddings src/lib/embedding.ts src/lib/knowledge-embedding-index.ts src/lib/knowledge-retrieval.ts src/lib/knowledge-search.ts src/lib/services/knowledge-embedding.service.ts src/lib/services/knowledge-search.service.ts src/lib/services/knowledge-import.service.ts src/app/api/knowledge/embeddings src/app/dashboard/knowledge/components/KnowledgeEmbeddingStatus.tsx src/app/dashboard/knowledge/page.tsx tests/embedding.test.ts tests/embedding.integration.test.ts scripts/knowledge-embeddings.ts docs/features/embedding-hybrid-retrieval.md docs/acceptance/embedding-evaluation.example.json docs/plans/summer-assessment-roadmap.md docs/plans/next-session-handoff.md
git add -p README.md docs/README.md src/lib/services/knowledge.service.ts
git commit -m "feat: 接入知识向量索引与混合检索"
```

## 参考

- [百炼文本向量接口](https://help.aliyun.com/zh/model-studio/text-embedding-synchronous-api/)
- [pgvector：余弦距离、混合检索与 Docker](https://github.com/pgvector/pgvector)
- [Neon AI 与 pgvector](https://neon.com/docs/ai/ai-concepts)
- Next.js 本地指南：`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md`。
