# 文件知识导入与混合检索

## 目标与结果

过去的知识库只能由用户把内容复制到表单中。现在用户可以在知识库页面直接导入 PDF、TXT 和 Markdown 文件，服务端会提取文字、分块并保存，原有 `searchKnowledge` Agent 随后可以检索这些分块并在答案末尾列出文件来源。

本功能没有使用 Embedding，也没有向量数据库，因此应准确称为“文件导入 + 混合文本检索”，不能称为向量语义检索。它把 PostgreSQL 英文全文检索、适合中文的二元关键词召回、字段权重和 Agent 生成检索词组合起来。模型把自然语言问题转换成工具查询，数据库负责确定性召回，服务端负责重排和引用。

## 相关文件职责

- `src/app/dashboard/knowledge/components/KnowledgeImportDialog.tsx`：选择文件、提交 multipart 请求，展示导入数量或错误。
- `src/app/dashboard/knowledge/components/KnowledgeToolbar.tsx`：提供“导入文件”入口。
- `src/app/api/knowledge/import/route.ts`：认证、角色检查、请求大小检查、读取 `FormData`，调用解析和保存服务。
- `src/lib/knowledge-import.ts`：文件名/MIME/魔数/大小校验、UTF-8 和 PDF 文字提取、文本清洗、分块以及来源元数据生成。
- `src/lib/services/knowledge-import.service.ts`：把已经完整解析的所有分块一次性写入当前用户的 `KnowledgeDoc`。
- `src/lib/services/knowledge-search.service.ts`：并行执行关键词查询和 PostgreSQL 全文查询，按 id 合并候选。
- `src/lib/knowledge-search.ts`：中文关键词拆分、全文检索词筛选、统一打分、字符预算和安全引用格式化。
- `next.config.ts`：把 `pdf-parse` 保留为 Node 服务端外部包，并把 native canvas 与 PDF worker 纳入 standalone 文件追踪。
- `tests/knowledge-import.test.ts`、`tests/knowledge-search.test.ts`：覆盖导入限制、真实 PDF 提取、分块页码、召回条件和重排。
- `docs/acceptance/demo-import-source.md`：人工展示可直接选择的虚构 Markdown 文件。

没有修改 Prisma Schema：每个文件分块继续使用已有 `KnowledgeDoc`，`source` 固定为 `upload`。这样不需要在验收前增加 migration，已有 Knowledge CRUD、权限隔离、Agent 工具和引用持久化可以直接复用。

## 数据流

```text
浏览器选择 PDF/TXT/MD
  -> POST /api/knowledge/import（multipart/form-data）
  -> Session 认证与 GUEST 拒绝
  -> 扩展名、MIME、大小、UTF-8/PDF 魔数校验
  -> PDF 按页提取 / 文本按 UTF-8 解码
  -> 清洗控制字符，按段落和句子切成 <= 6000 字符的块
  -> 全部文件解析成功后 createMany
  -> KnowledgeDoc(source=upload, userId=Session.user.id)
  -> 页面刷新并显示文件分块

用户提问
  -> DeepSeek 决定调用 searchKnowledge，并生成 query
  -> 中文二元关键词查询 + PostgreSQL simple 全文查询
  -> 合并候选，按标题/标签/摘要/正文/全文 rank/词覆盖率重排
  -> 最多 5 条、约 6000 字符上下文回填模型
  -> 最终回答 + 确定性知识库来源落库
```

## 关键代码解释

### 为什么在 Route Handler 接收文件

文件上传天然使用 `multipart/form-data`。独立 POST Route Handler 可以直接读取标准 Web `Request.formData()`，也便于返回 401、403、413 等明确 HTTP 状态。接口不能相信前端提交的 `userId`，它始终从服务端 Session 获取身份；GUEST 即使手工调用接口也会被拒绝。

### 为什么限制资源

每次最多 3 个文件、单文件最多 2 MB、提取文本最多 80,000 字符、每块最多 6,000 字符且单文件最多 20 块。Render Free 的 CPU 和内存有限，边界可以阻止异常文件长期占用解析器或一次写入过多记录。多个 PDF 顺序解析，是用速度换峰值内存和演示稳定性。

### 为什么先解析全部文件再写数据库

如果一边解析一边写入，第二个文件失败时第一个文件可能已经存在，用户会得到“部分成功”的模糊状态。当前实现先把本次请求全部解析成内存数据，成功后再 `createMany`；因此解析错误不会产生半套知识。数据库写入本身是单条批量语句。

### 分块为什么不做重叠

分块优先保留段落和 PDF 页边界，超长段落再从句号、换行或空格处切开。验收版不做重叠分块，因为重叠会让相同句子进入多个 `KnowledgeDoc`，容易造成重复引用和上下文浪费。后续采用向量检索时，可以增加小范围 overlap 并在检索后去重。

### PDF 页码如何追溯

PDF 解析结果按页提供文本。分块记录覆盖的起止页，并把“PDF 第 3-4 页”写入摘要；标题同时带文件名和分块序号。即使没有新增文件表，引用仍能显示文件名和分块，用户也能在知识详情中看到页码元数据。

`pdf-parse` 内部的 pdf.js 运行时依赖 native canvas 和独立 worker。Next.js standalone 默认静态追踪没有完整复制这些动态依赖，真实 Linux 回归曾出现 `DOMMatrix` 和 `pdf.worker.mjs` 缺失。配置通过 `serverExternalPackages` 避免错误打包，再用仅针对导入路由的 `outputFileTracingIncludes` 带入 canvas 和 worker；这也是为什么不能只以“next build 成功”判断 PDF 在生产容器可用。

### 混合检索是什么

中文没有引入分词服务，继续使用短语和二元词组做 `contains` 召回；英文/数字词进入 PostgreSQL `websearch_to_tsquery('simple', ...)`，数据库计算 `ts_rank_cd`。两路查询并行执行并按知识 id 去重，最后综合以下信号：

- 标题命中权重最高，其次是标签、摘要和正文；
- 命中查询词越多，覆盖分越高；
- PostgreSQL 全文相关度作为额外分数；
- 分数相同则优先更新时间更近的内容。

原始 SQL 使用 Prisma tagged template 绑定 `userId` 和查询文本，不进行字符串 SQL 拼接。SQL 和关键词查询都带当前 Session 的 `userId`，否则合并结果时就可能泄露其他账号的数据。

## 设计取舍

1. **复用 KnowledgeDoc，而不是新增 File/Chunk 表**：交付快、无 migration、已有 CRUD 和 Agent 立即可用；代价是不能一键按文件删除全部分块，也不保存原始二进制文件。
2. **只提取纯文本**：PDF 内容不会执行，Markdown 也不渲染上传文件中的 HTML，安全面较小；代价是扫描 PDF、图片、复杂表格暂时无法识别。
3. **即时构造 tsvector**：无需生产 migration，适合当前小型个人知识库；数据量大时会扫描文本，应升级生成列和 GIN 索引。
4. **不额外调用 DeepSeek 做 rerank**：现有 Agent 已负责把问题改写成工具查询，数据库重排保持低延迟且不额外消耗聊天额度；同义词召回仍弱于 Embedding。
5. **不保存上传原文件**：避免 Render 临时文件系统和对象存储新依赖；用户只能编辑或删除提取后的文本分块。

## 安全边界与易错点

- 扩展名不能证明文件类型，因此 PDF 还检查 `%PDF-` 魔数；MIME 只作为第二层一致性检查。
- TXT/MD 必须是合法 UTF-8，不能默默用错误编码生成乱码。
- 文件内容属于不可信用户数据。检索回填继续使用已有转义和 Prompt 边界，文件中的“忽略系统指令”不能成为系统指令。
- 浏览器的 `accept` 只是交互提示，服务端仍必须重复全部校验。
- `Content-Length` 可以提前拒绝正常浏览器的大请求，但不能作为唯一防护；生产反向代理还应配置上传大小和请求超时。
- PDF 文本解析不等于 OCR。扫描图片没有文字层时要明确提示，不应返回“导入成功但内容为空”。
- 当前“全文检索”主要改善英文词边界和排序，不代表理解中文语义，更不等于向量检索。

## 面试重点

面试时可以这样解释：

> 我先完成可部署的 RAG 数据入口：文件在服务端经过认证、资源限制和纯文本抽取，按可控字符预算拆成现有 KnowledgeDoc。检索不是只写一个 LIKE，而是并行合并中文关键词召回和 PostgreSQL 全文排名，再由有限 Tool Calling Agent 使用结果并持久化引用。由于没有 Embedding Key，我明确把它称为混合文本检索，并预留后续向量召回的位置。

可能追问：

- 为什么不直接把 80,000 字符全部交给模型？上下文成本高、容易超过限制，相关信息也会被噪声淹没。
- 为什么 `userId` 不能来自表单？攻击者可以伪造，从 Session 取值才能建立真实租户边界。
- 为什么 SQL 不会注入？变量由 Prisma tagged template 参数化绑定，表名和 SQL 结构没有来自用户输入。
- 如何升级？增加 File/Chunk 数据模型、对象存储、内容哈希去重、异步任务、OCR，再增加 Embedding 和向量召回，最终做 RRF 或 rerank。

## 验证方法

自动检查：

```bash
npm test
npm run lint
npm run typecheck
$env:DATABASE_URL='postgresql://build:build@127.0.0.1:5432/build'
$env:AUTH_SECRET='build-placeholder-not-used-at-runtime'
npm run build
```

完整本地环境应重建镜像，然后执行真实浏览器回归：

```bash
docker compose --env-file .env.docker up --build -d app
node scripts/verify-acceptance.mjs
```

人工验证：登录非 GUEST 账号，在知识库点击“导入文件”，选择 `docs/acceptance/demo-import-source.md`；确认页面出现 `source=upload` 的知识；在聊天中禁止联网并询问 Polaris 的恢复目标和演练代号，答案应为“15 分钟”和“雪松”，并出现文件知识来源。再用另一个账号搜索 Polaris，必须没有结果。

## 后续改进

- 增加 File 和 Chunk 表、文件级状态、一键删除和内容哈希去重。
- 用对象存储保存用户确实需要下载的原文件，增加病毒扫描和异步解析队列。
- 为 PostgreSQL 全文字段增加生成列和 GIN 索引，引入更合适的中文分词。
- 支持 DOCX、网页剪藏、OCR、表格结构和页内定位。
- 获得可靠 Embedding 服务后增加向量召回，与关键词结果做 RRF 融合；届时再称为语义/向量检索。
