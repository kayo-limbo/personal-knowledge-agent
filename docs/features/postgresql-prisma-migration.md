# Prisma 7 从 SQLite 迁移到 PostgreSQL

## 1. 目标与结果

SQLite 很适合单机开发：零安装、一个文件即可运行。但验收版需要 Docker Compose、持久化 volume，并为后续线上服务提供更稳定的并发连接和迁移流程，因此运行数据库必须切换到 PostgreSQL。

本次完成的是数据库代码和迁移历史的纵向切换：

- Prisma datasource 从 `sqlite` 改为 `postgresql`。
- Prisma 7 运行时驱动从 `@prisma/adapter-libsql` 改为 `@prisma/adapter-pg` + `pg`。
- 删除不能在 PostgreSQL 执行的 SQLite migration，生成新的 PostgreSQL 初始 migration。
- 初始 SQL 包含完整字段、原生 `Role` 枚举、主键、外键、唯一索引和常用查询索引。
- Prisma Client 使用开发环境全局单例，避免 Next.js 热更新反复创建连接池。
- 为连接池增加连接超时、空闲超时和最大连接数。
- seed 改为使用固定 id 的 upsert，可重复执行而不重复插入演示数据。
- 增加 `db:generate`、`db:migrate`、`db:deploy`、`db:status`、`db:seed`、`db:studio` 脚本。
- 旧 `dev.db` 作为本地备份保留，但不再作为运行数据库，也不再进入 Git。

后续已于 2026-08-27 在 Docker Compose 的真实 PostgreSQL 17 实例上完成 `migrate deploy`、幂等 seed、健康检查和 volume 重建验证。容器编排细节见 [`docker-compose-postgresql-deployment.md`](docker-compose-postgresql-deployment.md)。

## 2. 相关文件职责

- `prisma/schema.prisma`：定义 PostgreSQL provider、业务模型和查询索引。
- `prisma/migrations/20260826000000_init_postgresql/migration.sql`：从空 PostgreSQL 数据库创建完整结构的唯一初始 migration。
- `prisma/migrations/migration_lock.toml`：声明 migration 历史只适用于 PostgreSQL。
- `prisma.config.ts`：Prisma CLI 从 `DATABASE_URL` 读取直连地址，并定位 schema、migration 和 seed。
- `src/lib/prisma.ts`：校验 PostgreSQL URL，创建 `PrismaPg` 和 Prisma Client 单例。
- `prisma/seed.ts`：为演示账号、Prompt、Conversation、Message 和 Knowledge 写入幂等种子数据。
- `.env.example`：提供 PostgreSQL URL 格式，不包含真实密码。
- `.gitignore`：保留旧 SQLite 文件的忽略规则，防止本地备份继续进入 Git。
- `package.json` / `package-lock.json`：切换驱动依赖并提供数据库命令。
- `README.md`：说明首次初始化和开发、生产迁移命令。

## 3. 数据流

### 应用运行时

```text
Server Component / Route Handler / Service
  -> import src/lib/prisma.ts
  -> 校验 DATABASE_URL 必须是 postgres:// 或 postgresql://
  -> PrismaPg 创建 pg 连接池
  -> PrismaClient（开发环境复用 globalThis 单例）
  -> PostgreSQL
  -> 返回类型安全的业务数据
```

### 首次部署

```text
空 PostgreSQL 数据库
  -> npm run db:generate
  -> npm run db:deploy
  -> Prisma 读取已提交的 migration.sql
  -> 创建 enum / table / index / foreign key / _prisma_migrations
  -> npm run db:seed
  -> 幂等写入演示数据
  -> 启动 Next.js
```

### 后续模型变更

```text
修改 schema.prisma
  -> 开发环境 npm run db:migrate -- --name <name>
  -> 检查生成 SQL
  -> 提交 schema + 整个 migrations 目录
  -> 生产环境 npm run db:deploy
```

生产环境不用 `db push`，因为 `db push` 只同步最终结构，不能提供可审计、可按顺序执行的 migration 历史。

## 4. 关键代码解释

### 4.1 为什么必须重建 migration 历史

Prisma migration 是供应商专用 SQL。旧文件使用 SQLite 的 `DATETIME`、内联主键和表内外键语法，PostgreSQL 需要 `TIMESTAMP(3)`、原生 enum、独立 `ALTER TABLE ... ADD CONSTRAINT` 等语法。

因此不能只把 `provider` 改成 PostgreSQL 后继续使用旧 SQL。官方要求切换数据库 provider 时归档或删除旧 migration，并从空数据库到当前 schema 生成新的初始历史。旧 SQLite migration 仍可在 Git 历史中找到，不需要复制进新的活动 migrations 目录。

### 4.2 为什么 Prisma 7 还需要 driver adapter

Prisma 7 的直连数据库模式要求显式驱动适配器。`PrismaClient` 提供类型安全查询，`PrismaPg` 负责把这些查询接到 Node.js `pg` 驱动。

```text
PrismaClient -> @prisma/adapter-pg -> pg -> PostgreSQL
```

只把 schema provider 改成 `postgresql` 而继续使用 `PrismaLibSql`，类型可能暂时生成成功，但运行时一定无法正确连接。

### 4.3 为什么使用 globalThis 单例

Next.js 开发模式会热更新服务端模块。如果每次模块重新加载都 `new PrismaClient()`，就会创建多个 `pg` 连接池，最后可能出现 PostgreSQL “too many clients”错误。

生产进程正常只加载一次；开发环境把实例放在 `globalThis`，后续热更新继续复用。这个单例只在同一个 Node.js 进程内有效，不是跨容器的全局单例。

### 4.4 连接池参数为什么显式设置

`pg` 默认没有连接建立超时。如果数据库地址错误，请求可能等待很久。当前设置：

- `connectionTimeoutMillis: 5000`：5 秒连不上就失败，便于健康检查和故障定位。
- `idleTimeoutMillis: 30000`：空闲连接 30 秒后可回收。
- `max: 10`：单个应用进程最多 10 个连接，适合验收版单实例。

这不是所有生产环境的万能值。未来增加应用副本时，总连接数约为“副本数 × 每池上限”，必须结合 PostgreSQL `max_connections` 调整。

### 4.5 为什么给外键查询增加索引

PostgreSQL 创建外键时不会自动为引用列创建索引。项目经常执行以下查询：

- 按 `userId` 查询并按 `updatedAt` 排序会话。
- 按 `conversationId` 和创建时间读取消息。
- 按 `userId` 查询 Prompt。
- 按 `userId` 查询并排序 Knowledge。

复合索引让过滤和排序尽量由同一个索引支持。数据量很小时差异不明显，但这是进入 PostgreSQL 后合理的基础设计，不需要等性能问题出现才补。

### 4.6 seed 为什么改成固定 id + upsert

原 seed 对 Prompt、Conversation 和 Knowledge 使用 `create` / `createMany`，重复运行会产生重复演示数据。部署脚本重试或现场恢复时，这种行为不稳定。

固定 id 让每类演示数据有稳定身份；`upsert` 保证不存在时创建、存在时跳过。Conversation 的嵌套 Message 只在第一次创建，避免每次 seed 都追加重复消息。

## 5. 设计取舍

### 不自动复制 dev.db 数据

SQLite 文件中可能包含本地账号、密码哈希、聊天记录和测试知识。自动导出并提交 JSON 会带来隐私泄露风险；编写一次性双数据库迁移器还要同时保留两套驱动，扩大验收范围。

当前选择是：保留 `dev.db` 本地备份，新 PostgreSQL 用 migration 建结构、用 seed 建演示数据。若将来确实需要迁移个人数据，再编写只在本地执行、输出不入 Git、带条数校验和事务的数据搬迁脚本。

### 为什么当时没有把 Docker 混入同一轮

PostgreSQL provider 与 Docker Compose 是两个可定位的问题域。当时先验证 schema、驱动、migration 和构建，下一轮再加入容器、volume、健康检查和启动顺序。后续实际排错也证明拆分有效：空 migration 目录导致的 P3015、镜像 OpenSSL 环境和 Compose 启动门禁可以分别定位。

### 使用标准 pg，而不是 Serverless 驱动

验收部署目标是香港 Linux 服务器上的单个 Next.js 容器和 PostgreSQL 容器，二者通过 Compose 内网 TCP 连接。标准 `pg` 最直接，不需要引入 Neon、Accelerate 或额外托管平台。

## 6. 安全与稳定性边界

- `DATABASE_URL` 只在服务端和 Prisma CLI 使用，不能添加 `NEXT_PUBLIC_`。
- 示例 URL 使用占位密码，真实密码只放 `.env` 或部署环境变量。
- 应用会拒绝 `file:` 等非 PostgreSQL URL，避免迁移后误连旧 SQLite。
- PostgreSQL 生产端口后续只暴露到 Compose 内网，不暴露公网。
- 生产使用 `migrate deploy`，不使用会生成新 migration 或要求重置的 `migrate dev`。
- migration 与 schema 必须一起提交，不能只提交 Prisma 模型。
- `dev.db` 保留在本地且取消 Git 跟踪；它不是生产备份方案。
- seed 默认演示密码仍是 `demo`，只用于本地/验收演示；公开部署前必须更换或禁用演示账号。

## 7. 面试重点

### 问：为什么 SQLite migration 不能直接拿到 PostgreSQL 执行？

答：migration 保存的是数据库供应商专用 SQL，不是抽象 Prisma 模型。字段类型、enum、默认值、主键和外键语法不同。切换 provider 要从当前 schema 重新生成 PostgreSQL 初始历史。

### 问：Prisma Client、adapter-pg 和 pg 分别做什么？

答：Prisma Client 提供生成的类型安全 API；adapter-pg 把 Prisma 查询协议适配到驱动；pg 管理真实 TCP 连接和连接池，并与 PostgreSQL 通信。

### 问：开发环境为什么会连接过多？

答：Next.js 热更新会重新执行服务端模块。如果模块每次都创建 Prisma Client，就会产生多个池。开发环境用 `globalThis` 缓存实例可以复用同一池。

### 问：`migrate dev` 与 `migrate deploy` 有什么区别？

答：`migrate dev` 用于开发，会检测 drift、使用 shadow database、生成并应用新 migration，某些冲突下会要求 reset。`migrate deploy` 只按顺序执行仓库中已有 migration，适合测试和生产，不会替你生成新 SQL。

### 问：为什么 foreign key 还需要 index？

答：外键保证引用完整性，但 PostgreSQL 不会自动为引用列创建查询索引。项目按这些列过滤和排序，所以需要显式索引。

## 8. 易错点

- 改了 `provider`，忘记把 `PrismaLibSql` 换成 `PrismaPg`。
- 把旧 SQLite migration 和新 PostgreSQL migration 放在同一活动目录。
- 只提交 `schema.prisma`，漏掉 migration SQL 或 `migration_lock.toml`。
- 在生产容器执行 `migrate dev` 或 `db push`。
- 为每个请求创建 Prisma Client，耗尽 PostgreSQL 连接。
- 以为外键会自动建立过滤索引。
- 重复运行 seed 后生成大量重复会话和知识。
- 把真实数据库密码写入 `.env.example` 或 GitHub Actions 日志。
- 看到静态构建通过就宣称数据库已验证；构建不会代替真实连接和 migration 执行。

## 9. 验证方法

### 已完成的无数据库验证

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
npm run db:generate
npx prisma validate
```

还应检查生成的 PostgreSQL migration 至少包含：

- `CREATE TYPE "Role" AS ENUM ...`
- 五张业务表及主键。
- `User_email_key` 唯一索引。
- Conversation、Message、Prompt、KnowledgeDoc 查询索引。
- 五条外键约束。

### 真实 PostgreSQL 验收结果

已在 Docker Compose PostgreSQL 17 上完成：

1. 对空 PostgreSQL 运行 `migrate deploy`，唯一初始 migration 成功应用。
2. 重复运行 deploy，确认 `No pending migrations to apply`。
3. 重复运行 seed，数据仍为 1 User、1 Conversation、2 Message、2 Prompt、2 KnowledgeDoc。
4. `/api/health` 返回数据库 reachable，App 和 PostgreSQL 均为 healthy。
5. 删除并重建容器与网络但保留 volume，管理员 id 与 migration 记录保持不变。

登录、Knowledge CRUD、Chat 与 DeepSeek SSE 还要在香港服务器线上环境再做一轮端到端验收。

## 10. 后续改进

- Docker Compose、命名 volume、健康检查和 `migrate deploy` 启动流程已经完成，下一步部署到香港 Linux 服务器。
- 后续可把 `/api/health` 拆成应用存活与数据库就绪两个端点。
- 在 GitHub Actions 中生成 Prisma Client并执行 lint、TypeScript、测试和 build。
- 部署前把演示密码改为环境变量，或提供专用演示数据初始化命令。
- 数据量增长后评估 PostgreSQL 全文检索，再决定是否需要 embedding 和向量数据库。
- 若未来迁移旧 SQLite 个人数据，使用本地一次性脚本、事务、外键顺序和迁移前后条数校验。
