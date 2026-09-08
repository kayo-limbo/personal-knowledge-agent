# Vercel Hobby + Neon Free 零成本部署

> 2026-09-08 状态更新：Neon 项目、初始 migration、Vercel 配置与部署已完成，生产没有运行 demo seed。但当前测试网络无法访问 `vercel.app`，Vercel 端到端验收未通过；已启用 **Render Free Docker + Neon** 作为实际公网方案，见 [Render 部署与验收记录](render-neon-free-deployment.md)。下文 2026-09-04 的准备状态和 Vercel 清单保留为历史与复现说明，不是当前待创建清单。

## 目标与当前结果

这个功能块的目标，是在不购买香港 VPS 的前提下，为 2026-09-13 验收准备一个可公开访问、可以持久化数据并支持 SSE 流式回答的环境。

实际线上架构选择为：

```text
中国大陆浏览器
  -> Vercel CDN
  -> 香港 hkg1 的 Next.js Node.js Function
      -> Neon Singapore PostgreSQL（运行时使用 pooled URL）
      -> DeepSeek 官方 API
```

截至 2026-09-04，仓库侧准备已完成：

- GitHub Actions 在 `0bd56c2` 上首次远程运行成功。
- Vercel 函数区域固定为单一区域 `hkg1`。
- Prisma runtime 和 migration 使用不同连接变量。
- Vercel 实例内数据库连接池缩小为 1，本地和 Docker 仍为 10。
- Vercel 每次构建都会先生成 Prisma Client。
- 聊天路由继续使用 Node.js runtime、60 秒函数上限和 SSE 防缓冲响应头。

2026-09-04 当时尚未完成：创建 Neon/Vercel 项目、配置密钥、执行线上 migration 和公网端到端验证。当前进度以顶部更新及 Render 文档为准。

## 为什么选择这个方案

Vercel 对 Next.js 16 有原生构建适配，Route Handler 可以返回流式响应；Neon 提供 PostgreSQL、PgBouncer pooled endpoint 和免费额度。两者都能按需缩容，适合访问量很小的考核项目。

Docker Compose 不会删除。它仍然负责本地生产模拟、自托管备用方案和现场断网时的演示兜底。简历和文档必须如实区分最初 Vercel 方案、实际 Render Docker + Neon 线上环境与本地 Compose。

免费方案也有边界：额度和产品规则可能变化；Neon 休眠后首次查询会有冷启动；`vercel.app` 在中国大陆的可达性以及 Vercel 香港到 DeepSeek 的链路必须实际测试。若主链路不稳定，再评估 Render Free + Neon，而不是同时建设两套环境。

## 相关文件职责

- `vercel.json`：把 Vercel Functions 固定在单一香港区域 `hkg1`。Hobby 只使用一个区域，不引入多区域一致性问题。
- `src/app/api/chat/route.ts`：保持 `runtime = "nodejs"` 和 `maxDuration = 60`；50 秒 Agent 总超时给函数清理、错误回填和关闭流预留约 10 秒。
- `src/lib/prisma.ts`：应用运行时只读取 `DATABASE_URL`。Vercel 中每个实例最多保留 1 个 `pg` 连接，本地/Docker 长生命周期进程仍使用 10。
- `prisma.config.ts`：Prisma CLI 优先读取 `DIRECT_URL`，缺少时回退到 `DATABASE_URL`，所以旧的本地和 Docker 流程不需要增加变量。
- `package.json`：`build` 先运行 `prisma generate`，避免 Vercel 的依赖缓存或未提交生成目录造成构建失败；Node.js 固定为与 CI、Docker 一致的 22.x。
- `.env.example`：只提供变量用途和假地址，不保存真实凭据。
- `README.md`、`docs/plans/summer-assessment-roadmap.md`：记录真实部署决策、已完成项和待验收项。

## 两条数据库连接为什么要分开

Neon 会提供同一数据库的两类地址：

```text
DATABASE_URL
  -> 主机名包含 -pooler
  -> Vercel 应用运行时
  -> 多个短生命周期函数共享 Neon PgBouncer

DIRECT_URL
  -> 主机名不包含 -pooler
  -> 本地执行 prisma migrate deploy
  -> 数据库管理和迁移操作
```

`DATABASE_URL` 是高频业务查询入口。Serverless 会横向创建多个函数实例，如果每个实例都创建 10 个直连，很容易耗尽 PostgreSQL 连接；因此实例内限制为 1，再由 Neon 的 PgBouncer 在数据库前统一复用连接。

`DIRECT_URL` 只给 Prisma CLI 使用。迁移需要稳定的数据库会话，并且不应让生产应用持有管理用途的直连配置。Vercel 运行时不需要保存 `DIRECT_URL`；在本机的被 Git 忽略的 `.env` 中配置即可。

## 数据流

一次普通业务查询的路径是：

```text
浏览器请求
  -> Vercel hkg1 Node.js Function
  -> Prisma Client 单例（当前实例 max=1）
  -> DATABASE_URL
  -> Neon PgBouncer pooled endpoint
  -> PostgreSQL
  -> 响应返回浏览器
```

一次发布前迁移的路径是：

```text
开发者本机 npm run db:deploy
  -> prisma.config.ts
  -> DIRECT_URL
  -> Neon direct endpoint
  -> 只应用 prisma/migrations 中已提交的 migration
```

聊天请求还会从 hkg1 调用 DeepSeek。Route Handler 先认证并写入用户消息，再运行最多 50 秒的有限 Agent 循环；文本 chunk 通过 SSE 立即发往浏览器，结束后一次性持久化完整 assistant 消息。停止生成时，浏览器取消请求，服务端继续向上游传播 Abort 信号。

## 关键代码解释

### Serverless 与 Docker 使用不同的实例内池大小

`src/lib/prisma.ts` 检查 Vercel 自动注入的 `VERCEL=1`：

```ts
const isVercel = process.env.VERCEL === "1";

new PrismaPg({
  connectionString: getDatabaseUrl(),
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: isVercel ? 10_000 : 30_000,
  max: isVercel ? 1 : 10,
});
```

这不是让 PostgreSQL 只能处理一个请求。每个 Vercel 实例有自己的小池，Neon PgBouncer 再汇聚所有实例。Docker App 是单个长生命周期 Node.js 进程，保留 10 可以避免无意义地降低本地并发。

连接等待从 5 秒提高到 10 秒，是为了覆盖 Neon Free 从休眠唤醒的延迟。它不能消除冷启动，只是避免唤醒尚未完成就过早失败。

### migration 变量向后兼容

```ts
const migrationDatabaseUrl =
  process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim() || "";
```

Neon 部署显式提供 `DIRECT_URL` 时，CLI 一定使用直连；Docker 和本地 PostgreSQL 只有 `DATABASE_URL` 时，原有命令仍能运行。两者都缺失时留空，Prisma 命令会失败，不会静默连接到某个默认数据库。

### 为什么不改成 Edge runtime

当前服务端依赖 `pg`、Prisma、bcrypt 和完整 Node.js 能力，Node.js runtime 风险最低。区域由 `vercel.json` 的平台配置控制，不需要为了选择香港区域重写为 Edge。迁移到 Edge 会引入 Neon HTTP/WebSocket driver、兼容性验证和额外改造，不符合验收前“最小变更、稳定演示”的原则。

### 为什么构建时生成 Prisma Client

`src/generated/prisma` 被 Git 忽略。若远程构建只执行 `next build`，干净 checkout 中没有客户端代码。`build` 改为 `prisma generate && next build`，保证 CI、Vercel 和 Docker 都从已提交 schema 生成匹配的 Client。

## 控制台部署步骤

### 1. 创建 Neon Free PostgreSQL

1. 登录 Neon 控制台，新建 Free 项目。
2. 区域选择 AWS Singapore（`ap-southeast-1`）。
3. 在 Connect 面板分别复制 pooled 和 direct 连接串。
4. 不要把连接串、密码或截图发送到聊天，也不要写进任何受 Git 跟踪文件。
5. 把 pooled 地址保存为 Vercel 的 `DATABASE_URL`；主机名应包含 `-pooler`，并保留 TLS 参数。
6. 把 direct 地址只写入本机被忽略的 `.env`：

```env
DIRECT_URL="postgresql://...非-pooler主机.../neondb?sslmode=require"
```

然后在本机执行：

```bash
npm run db:deploy
```

预期结果是初次应用已提交 migration，重复执行显示没有待迁移。生产默认不执行 `npm run db:seed`；只有确实需要受控演示数据时才手动运行，并在公开访问前处理弱密码账号。

### 2. 创建 Vercel Hobby 项目

1. 在 Vercel 导入 GitHub 仓库 `kayo-limbo/personal-knowledge-agent`。
2. Framework Preset 保持 Next.js，Root Directory 保持仓库根目录，构建命令使用仓库的 `npm run build`。
3. 为 Production 配置以下变量，值只粘贴到 Vercel 控制台：

```text
DATABASE_URL       Neon pooled connection string
AUTH_SECRET        足够长的随机字符串
DEEPSEEK_API_KEY   DeepSeek 服务端密钥
DEEPSEEK_MODEL     deepseek-v4-flash
```

4. 不要添加 `NEXT_PUBLIC_` 前缀，不要把 `DIRECT_URL` 放入 Vercel runtime，除非未来明确让受控发布任务在 Vercel 内执行 migration。
5. 发起 Production Deployment，确认构建日志中 Prisma Client 生成与 Next.js build 都成功。

`vercel.json` 已设置 `hkg1`。香港更靠近主要访问者和 DeepSeek 链路，但与 Neon Singapore 不是同区；如果线上实测数据库延迟明显，再把单一区域改成 `sin1` 对比，不在验收前启用多区域。

## 上线验证方法

必须在 Production URL 上逐项记录结果，不能只看部署状态为 Ready：

- [ ] `GET /api/health` 返回 200、`status=ok`、`database=reachable`。
- [ ] 新用户可以注册、登录、退出并重新登录。
- [ ] 两个不同账号的 Knowledge 数据互不可见。
- [ ] Knowledge 新建、查询、编辑、删除均成功。
- [ ] 新建会话并刷新页面后，历史消息仍存在。
- [ ] Agent 能调用 `searchKnowledge`，回答包含对应知识来源。
- [ ] Flash/Pro、普通/深度思考模式至少各做一次冒烟验证。
- [ ] SSE 首字在回答结束前到达，后续文本持续增量出现，而不是最后一次性显示。
- [ ] 点击停止生成后，页面停止追加内容，Vercel 日志没有继续长时间执行。
- [ ] 强制联网能显示搜索状态并生成可点击网页来源。
- [ ] Vercel 重新部署后，原有账号、Knowledge 和 Conversation 仍存在。
- [ ] 查看 Vercel Function 日志，确认实际区域为 `hkg1`，没有函数超时或连接耗尽。
- [ ] 使用验收现场同类的中国大陆网络，多次访问 `vercel.app` 并记录首屏和 SSE 稳定性。
- [ ] 从 Vercel 日志确认 DeepSeek 请求可成功发出；401、402、429 和超时提示均不会泄露密钥。

本地回归命令：

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

还应解析 `vercel.json`、运行 `docker compose config`，并至少再构建一次 Docker 镜像，证明免费线上适配没有破坏自托管备用方案。

本次仓库侧验证结果（2026-09-04）：18/18 测试、ESLint、TypeScript、Prisma schema 双连接变量校验、Next.js 生产构建、`vercel.json` JSON 解析和 `docker compose config --quiet` 均通过；GitHub Actions 的 `0bd56c2` 远程运行也为绿色。Docker Desktop daemon 当时未启动，因此本次没有重新完成镜像构建，这一项仍需在 Docker Desktop 启动后补验。Neon migration、Vercel 部署和公网功能清单同样仍是待验证状态。

## 设计取舍

### hkg1 而不是 sin1

Vercel 官方建议函数尽量靠近数据库，按这一点 `sin1` 更理想。但本项目还需要服务中国大陆访问者并从函数连接 DeepSeek，因此先选香港，随后用真实首字时间、数据库查询延迟和稳定性决定是否切到新加坡。这里只选一个区域，避免 Hobby 限制和跨区域状态问题。

### `@prisma/adapter-pg` 而不是改用 Neon adapter

现有 PostgreSQL 和 Docker 路径已经用 `adapter-pg` 验证。Neon pooled TCP 地址可以继续被 `pg` 使用，改成 Neon 专用 driver 会扩大依赖和回归范围。等核心演示稳定后，若冷启动或连接延迟成为已测量的瓶颈，再评估 HTTP driver。

### 手动 migration 而不是部署时自动 migration

Vercel Functions 会并发扩缩容，不适合让应用启动时竞争执行 migration。验收版由本地使用 direct URL 执行一次 `migrate deploy`，部署阶段只生成 Client 和构建应用。这个流程简单、可解释，也不会自动 seed。

## 面试重点

可能的追问和回答方向：

1. 为什么 Serverless 容易打爆数据库连接？函数实例会横向扩容，每个实例若各自持有大连接池，总连接数会乘法增长。
2. 应用池和 PgBouncer 是否重复？两者层级不同：`pg` 池复用单个函数实例内连接，PgBouncer 复用所有实例到 PostgreSQL 的后端连接。
3. 为什么 migration 走 direct URL？迁移需要可靠会话和数据库管理语义，不应通过 transaction pooler 执行。
4. 为什么 50 秒 Agent 配 60 秒函数上限？业务超时必须先于平台硬超时，才能主动取消上游、清理计时器并返回可理解的错误。
5. Serverless 为什么仍能 SSE？HTTP 响应体可以是流；关键是平台和中间代理不能把所有 chunk 缓冲到结束。
6. Vercel 部署后数据为什么不会因重新部署消失？函数是无状态计算，持久数据在独立 Neon PostgreSQL，不在函数文件系统。
7. 为什么没有自动 CD 和自动 migration？截止日前更看重可控发布与稳定演示，自动化发布会引入权限、并发迁移和回滚的新风险。

## 易错点

- 把 direct URL 误填为 `DATABASE_URL`，导致函数实例直接消耗 PostgreSQL 连接。
- pooled 与 direct 都放入公开文档、截图、Git commit 或聊天消息。
- 在 Vercel Build Command 中绕过仓库 `npm run build`，导致 Prisma Client 没生成。
- 把 `maxDuration=60` 误解为 Agent 可以完整运行 60 秒；平台清理前必须留出安全余量。
- 只看到 HTTP 200 就认为 SSE 正常，实际上响应可能被缓冲成一次性返回。
- 在生产部署阶段自动运行 seed，公开创建弱密码账号。
- 使用 `prisma db push` 代替 `prisma migrate deploy`，丢失可审计的 migration 历史。
- 为选择区域把 Route Handler 改成 Edge，随后才发现 `pg` 或其他 Node.js 依赖不兼容。
- 把 Docker Compose 写成线上实际架构，或把尚未完成的公网验证写成“已上线”。

## 后续改进

验收前只处理实测阻断项：若 hkg1 到 Neon 延迟明显，A/B 对比 `sin1`；若 `vercel.app` 在现场网络不稳定，准备 Render Free + Neon 备用或本地录屏。验收完成后再考虑自定义域名、监控、备份、限流和自动发布，不扩展 Kubernetes、MCP、Multi-Agent 或 Workflow。

## 官方参考

- [Vercel：Next.js on Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs)
- [Vercel：配置函数区域](https://vercel.com/docs/functions/configuring-functions/region)
- [Vercel：函数流式响应](https://vercel.com/docs/functions/streaming-functions)
- [Vercel：函数限制](https://vercel.com/docs/functions/limitations)
- [Neon：Connection pooling](https://neon.com/docs/connect/connection-pooling)
- [Neon：Scale to Zero](https://neon.com/docs/introduction/scale-to-zero)
- [Prisma：Neon 数据库指南](https://www.prisma.io/docs/orm/v6/overview/databases/neon)
- [Prisma：Vercel 构建时生成 Client](https://docs.prisma.io/docs/orm/v7/more/troubleshooting/nextjs)
