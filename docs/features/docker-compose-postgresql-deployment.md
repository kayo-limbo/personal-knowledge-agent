# Next.js standalone、Docker Compose 与真实 PostgreSQL 验收

## 1. 目标与结果

上一阶段只完成了 Prisma PostgreSQL 代码迁移，`next build` 通过并不能证明 migration 真能在 PostgreSQL 执行。本功能把数据库、迁移和应用串成一个可重复启动的本地部署闭环。

本次结果：

- 使用 Next.js 16 `output: "standalone"` 生成最小生产运行产物。
- 使用多阶段 Dockerfile 分离依赖安装、构建、迁移和运行环境。
- Compose 编排 PostgreSQL、一次性 migrate 和 Next.js App 三个服务。
- PostgreSQL 使用命名 volume，且不向宿主机或公网映射 5432。
- PostgreSQL 健康后先执行 `prisma migrate deploy`；迁移成功后才启动 App，演示 seed 改为受控环境显式执行。
- 新增 `/api/health`，同时检查 Next.js 进程和数据库查询。
- 在真实 PostgreSQL 17 上成功应用初始 migration，并验证重复部署没有待执行迁移、重复 seed 不增加数据。
- 删除并重建全部容器与网络后，volume 中的数据和 migration 记录仍存在。

这完成的是本地可复现部署，不等于已经完成香港云服务器、域名、HTTPS 或 CI。

## 2. 相关文件职责

- `next.config.ts`：启用 standalone 输出，让 Next.js 追踪并复制运行所需文件。
- `Dockerfile`：定义 `dependencies`、`builder`、`migrator` 和 `runner` 等阶段。
- `.dockerignore`：排除依赖、构建产物、Git、文档、本地数据库、安装包和环境变量，缩小构建上下文并避免泄密。
- `compose.yaml`：定义服务、依赖顺序、健康检查、端口和命名 volume。
- `.env.docker.example`：只提交变量名称和占位值，不包含真实密码或 API Key。
- `.env.docker`：本机实际 Compose 配置，受 `.gitignore` 保护。
- `src/app/api/health/route.ts`：执行轻量 `SELECT 1`，数据库不可达时返回 HTTP 503。
- `.gitignore`：允许提交 `.env.docker.example`，继续忽略真实 `.env.docker`。
- `prisma/migrations/20260826000000_init_postgresql/migration.sql`：migrator 在空数据库上执行的已提交迁移。
- `prisma/seed.ts`：使用固定 id 和 upsert 写入可重复运行的演示数据。

## 3. 数据流与启动顺序

```text
docker compose up
  -> postgres 容器启动
  -> pg_isready 健康检查通过
  -> migrate 一次性容器启动
       -> prisma migrate deploy
       -> 成功后以 0 退出
  -> app 容器启动 node server.js
  -> /api/health 执行 SELECT 1
  -> Docker 将 app 标为 healthy
```

运行时数据库连接不会使用 `localhost`。Compose 内每个服务都有自己的网络空间，App 通过服务名 `postgres:5432` 访问数据库。只有 App 的 3000 端口映射到宿主机。

持久化链路是：

```text
Prisma 写入 PostgreSQL
  -> /var/lib/postgresql/data
  -> postgres_data 命名 volume
  -> 容器删除并重建
  -> 新 PostgreSQL 容器重新挂载同一 volume
  -> 数据仍然存在
```

## 4. 关键代码解释

### 4.1 为什么使用 standalone

普通 `next start` 通常需要完整项目和完整 `node_modules`。`output: "standalone"` 会根据输出追踪生成 `.next/standalone`，runner 只复制 standalone、`.next/static` 和 `public`，既保留 Route Handler、认证和 SSE 等服务端能力，也减少最终镜像中的无关开发文件。

### 4.2 为什么 Dockerfile 要分阶段

- `dependencies`：只复制 lockfile 并执行 `npm ci`。业务代码变化时可以复用最慢的依赖层。
- `builder`：生成 Prisma Client 并执行 `next build`，使用的数据库连接串和认证密钥只是单条构建命令的格式占位值。
- `migrator`：保留 Prisma CLI、migration 和 seed 所需文件，默认只负责改变数据库结构；同一镜像也可由运维人员显式运行一次性 seed。
- `runner`：只运行 standalone server，并使用非 root 的 `nextjs` 用户。

本机验证还发现 Prisma 7.8 的 `generate` 在当前含 Debian OpenSSL 3 的 builder 层会异常停滞，而 `migrate deploy` 和运行时需要完整 OpenSSL 环境。当前把 builder 留在官方 Node slim 基础层，把 migrator 和 runner 放在安装 OpenSSL 的层中；这是一项经过实际构建验证的阶段隔离，后续升级 Prisma 时应重新测试并尽量统一基础层。

### 4.3 为什么 migration 是独立服务

如果每个 App 副本启动时都先迁移，多副本会同时争抢 migration；如果把迁移埋在 App 的启动脚本中，结构失败和应用失败也难区分。独立的一次性服务有明确退出码，Compose 只有在它成功后才启动 App。

当前验收版只有单实例，使用 `depends_on.condition: service_completed_successfully` 足够。更复杂的生产编排以后应把 migration 作为发布任务执行，而不是让每个应用实例执行。

### 4.4 为什么健康检查要查询数据库

只检查 3000 端口只能说明 Node 进程在监听，不能说明核心依赖可用。`/api/health` 执行 `SELECT 1`：成功返回 200，失败返回 503。响应不包含连接串或原始异常，并设置 `Cache-Control: no-store`，避免缓存过期健康状态。

### 4.5 为什么构建占位值不是运行时密钥

Next.js 构建会加载服务端模块，Prisma 7 的配置也会在 `generate` 阶段解析 `DATABASE_URL`，所以构建命令需要合法格式的占位值。这些值只对对应 `RUN` 生效；最终容器由 Compose 注入真实 `DATABASE_URL`、`AUTH_SECRET` 和 `DEEPSEEK_API_KEY`。

## 5. 设计取舍

### 数据库不映射宿主机端口

App 和 PostgreSQL 在 Compose 内网通信，本地验证也通过 `docker compose exec postgres psql` 进入数据库。这样线上部署时不会意外把 5432 暴露公网。需要本地 GUI 临时调试时可以单独增加仅绑定 `127.0.0.1` 的开发覆盖文件，但不写进验收默认配置。

### migration 与 demo seed 分离

最初实现让 seed 随 migrate 自动执行，方便本地立即得到固定数据，但也会让公网部署自动创建 `admin@example.com / demo` 弱密码账号。部署前安全审计后改为：migrator 默认只执行 migration，演示数据通过一次性命令显式导入；重复 seed 也不再重置已存在账号的密码。完整取舍见 [`production-safe-demo-seed.md`](production-safe-demo-seed.md)。

### 暂时不加入 Nginx

当前目标是先证明 App、migration、PostgreSQL、volume 和健康检查闭环。Nginx 与 HTTPS 留到服务器部署后；加入代理时必须关闭 `/api/chat` 缓冲，并验证 SSE 首字时间。

### 使用单 App 实例

验收版不引入多副本、共享 Next.js 缓存、滚动发布或 Redis。单实例更容易稳定演示，也符合截止日期前“功能闭环优先”的范围约束。

## 6. 安全与稳定性边界

- `.env.docker` 不进入 Git，也不进入 Docker build context。
- PostgreSQL 没有宿主机端口映射，只能由 Compose 网络内服务访问。
- App 使用非 root 用户运行。
- 生产只执行已提交的 `migrate deploy`，不使用 `migrate dev` 或 `db push`。
- 普通生产启动不执行 demo seed，不自动创建固定弱密码账号。
- App 在 migration 失败时不会启动，避免代码在错误 schema 上运行。
- 健康接口不回传数据库地址、用户名、密码或异常堆栈。
- `restart: unless-stopped` 用于 App 和数据库；一次性 migrator 不自动无限重试。
- 删除 volume 的命令会永久删除数据库。本地停机使用 `docker compose down`，不要随意追加 `-v`。
- 本次 `npm ci` 报告的依赖审计问题没有使用 `npm audit fix --force` 自动改版本；应在独立依赖安全任务中判断生产依赖、可达性和升级影响。

## 7. 面试重点

### 问：`depends_on` 为什么还要配健康条件？

答：容器进程启动不等于数据库已经接受连接。`service_healthy` 等待 `pg_isready`，迁移成功退出后 `service_completed_successfully` 才允许 App 启动，保证顺序表达的是“可用”和“成功”，不只是“已经创建容器”。

### 问：image、container 和 volume 有什么区别？

答：image 是只读模板，container 是 image 的运行实例，volume 是独立于 container 生命周期的数据存储。删除 PostgreSQL container 后，重新挂载同一个 volume 才能恢复原数据。

### 问：为什么不把 migration 放进 App 的 CMD？

答：独立迁移任务有清晰退出码和日志，失败时阻止 App 启动，也避免未来多个 App 副本同时执行迁移。数据库结构变化属于部署步骤，不是每个业务进程的日常启动职责。

### 问：存活检查和就绪检查有什么区别？

答：存活检查回答“进程是否还活着”，就绪检查回答“是否能承接真实请求”。本项目的健康接口包含数据库查询，更接近就绪检查；以后可再拆一个不访问外部依赖的 liveness 接口。

### 问：standalone 为什么仍要复制 static 和 public？

答：standalone 负责 Node 服务端运行依赖，但 `.next/static` 和 `public` 需要显式复制到 runner，浏览器才能加载构建后的 JS、CSS 和公开静态资源。

## 8. 易错点

- 在容器内把数据库主机写成 `localhost`，实际会连接 App 容器自己。
- 只写 `depends_on`，却没有健康条件，导致 migration 抢跑。
- 把 `.env.docker` 复制进镜像或提交 Git。
- 给 PostgreSQL 添加 `5432:5432` 后直接部署到公网服务器。
- 使用 `db push` 替代可审计的 migration 历史。
- migration 目录残留空文件夹，Prisma 会报 P3015 缺少 `migration.sql`。
- 只检查 HTTP 200，不确认数据库查询与 migration 状态。
- 用 `docker compose down -v` 做普通重启，误删持久化数据。
- 把 demo seed 绑定在每次部署上；当前已经拆成显式一次性命令，并通过固定 id + upsert 避免重复数据。
- 在 upsert 的 `update` 分支覆盖密码哈希；当前重复 seed 不会重置已有账号密码。
- 看到本地 Compose 成功就宣称线上部署完成；云服务器、防火墙、SSE 网络链路和 HTTPS 尚需单独验证。

## 9. 验证方法

### 启动

```bash
cp .env.docker.example .env.docker
# 修改密码、AUTH_SECRET 和需要使用聊天时的 DEEPSEEK_API_KEY
docker compose --env-file .env.docker up --build -d
docker compose --env-file .env.docker ps -a
```

预期状态：

- `postgres`：healthy。
- `migrate`：Exited (0)。
- `app`：healthy，只有 App 映射宿主机 3000。
- `GET http://localhost:3000/api/health` 返回 `{"status":"ok","database":"reachable"}`。
- 空数据库普通启动后不会自动出现 `admin@example.com`；需要演示数据时显式执行：

```bash
docker compose --env-file .env.docker run --rm migrate npm run db:seed
```

### 本次真实验证结果

- PostgreSQL：17.11。
- migration：`20260826000000_init_postgresql` 成功，重复运行显示 `No pending migrations to apply`。
- 显式 seed 重复运行后数据仍为：1 User、1 Conversation、2 Message、2 Prompt、2 KnowledgeDoc。
- 容器与网络删除重建后，管理员 id 未变化，已应用 migration 仍为 1 条。
- 自动检查：18/18 测试、ESLint、`tsc --noEmit`、Next.js 生产构建全部通过。

### 日志与停机

```bash
docker compose --env-file .env.docker logs -f app migrate postgres
docker compose --env-file .env.docker down
```

`down` 默认保留 volume；只有明确要清空本地数据库时才考虑 `down -v`，并应先备份。

## 10. 后续改进

- 基础 GitHub Actions CI 已完成并 push，下一步确认首次托管运行结果。
- 如未来选择自托管，可在 Linux 服务器复用同一 Compose，配置真实高熵密钥并完成防火墙检查；当前实际公网方案是 Render + Neon。
- 正式产品可进一步移除固定 demo 密码，改用一次性管理员邀请或初始化 token。
- 服务器主链路稳定后再增加 Nginx + HTTPS，并验证 `/api/chat` SSE 不被缓冲。
- 拆分 liveness 与 readiness，避免数据库短暂故障触发不必要的进程重启。
- 评估 migrator 镜像只安装必要 CLI 依赖，继续缩小体积与依赖攻击面。
- 升级 Prisma 时复验 builder 的 OpenSSL 行为，移除当前兼容性分层。
