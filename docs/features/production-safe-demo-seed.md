# 生产安全的数据库初始化与演示 seed

## 1. 目标与结果

Docker Compose 最初把 `prisma migrate deploy` 和 `prisma db seed` 写在同一个 migrator 启动命令中。这样本地验证很方便，但每次线上部署都会创建 `admin@example.com / demo` 固定弱密码账号；旧实现重复 seed 时还会重置这个账号的密码。

本功能把“数据库结构迁移”和“演示数据导入”拆开：

- migrator 默认只执行已提交的 production migration。
- App 仍然只在 migration 成功后启动。
- 演示 seed 改为运维人员显式执行的一次性命令。
- 重复 seed 不再修改已存在演示账号的密码哈希。
- 生产环境无需演示账号即可正常注册和使用核心功能。

结果是安全默认值变成“不创建公开弱密码账号”，同时保留本地学习和受控验收时快速准备固定数据的能力。

## 2. 相关文件职责

- `Dockerfile`：migrator 的默认命令只运行 `npm run db:deploy`。
- `prisma/seed.ts`：首次创建演示账号；账号已存在时不更新密码。
- `.env.docker.example`：提示默认启动不会导入 demo seed。
- `README.md`：给出显式的一次性 seed 命令和公开部署警告。
- `docs/features/docker-compose-postgresql-deployment.md`：同步 Compose 启动数据流与验证方法。
- `docs/plans/summer-assessment-roadmap.md`：记录公网部署前的安全门禁已经完成。

## 3. 数据流

默认生产启动：

```text
docker compose up
  -> postgres 健康
  -> migrate 执行 prisma migrate deploy
  -> migrate 成功退出
  -> app 启动
  -> 数据库中不会自动出现 demo 账号
```

受控环境需要固定演示数据时：

```text
运维人员显式运行 docker compose run ... npm run db:seed
  -> 使用同一个 migrator 镜像和 DATABASE_URL
  -> upsert 固定演示数据
  -> 首次创建 admin@example.com
  -> 再次执行不会重置其密码
```

## 4. 关键代码解释

### 4.1 为什么 migration 可以自动执行，seed 不应自动执行

migration 描述应用运行所必需的数据库结构，而且来自已提交、可审计的 SQL 历史。没有正确 schema，App 本来就不应启动。

demo seed 属于可选业务数据，不是应用启动条件。把它绑在每次部署上，会让“重新发布代码”意外改变账号和数据，这违反最小意外原则，也扩大固定凭据的暴露风险。

### 4.2 为什么选择显式命令，而不是长期环境变量开关

长期保留 `ENABLE_DEMO_SEED=true` 很容易在首次部署后忘记关闭，之后每次发布仍会执行 seed。一次性命令要求操作者明确表达意图，而且部署配置本身保持安全默认值。

命令复用 migrator 镜像：

```bash
docker compose --env-file .env.docker run --rm migrate npm run db:seed
```

`--rm` 只删除这次一次性容器，不删除 PostgreSQL volume。

### 4.3 为什么 `upsert.update` 不能再写 `passwordHash`

如果 seed 每次都更新密码哈希，管理员即使已经修改密码，下一次误执行 seed 也会被改回公开默认值。将 `update` 改为空对象后，seed 只负责首次创建；已有账号的认证信息归真实业务流程管理。

## 5. 设计取舍

### 保留固定 demo 密码，但不自动执行

验收项目仍需要快速准备可预测的演示数据，因此暂时保留受控环境的一次性 seed。正式产品更适合从安全输入读取初始管理员凭据，或完全通过注册与后台授权流程创建管理员。

### 不在本轮增加初始化后台页面

当前截止日期前优先完成稳定线上闭环。新增首次启动向导、管理员邀请或密钥托管会扩大认证和部署范围；显式命令已经能消除默认公网风险。

## 6. 安全与稳定边界

- 普通 `docker compose up` 不创建演示账号。
- 生产 migration 不使用 `db push`，只执行已提交的 `migrate deploy`。
- seed 命令仍然具有写数据库权限，只能由可信运维人员执行。
- 不要把 `.env.docker`、数据库密码、`AUTH_SECRET` 或 DeepSeek Key 提交到 Git。
- 显式 seed 后若服务器可公网访问，必须立即修改或删除默认演示账号。
- `docker compose run --rm` 不会删除数据库 volume；不要把它和 `docker compose down -v` 混淆。

## 7. 面试重点

### 问：migration 和 seed 为什么要分开？

答：migration 是应用代码与数据库结构的兼容门禁，失败时必须阻止启动；seed 是可选业务数据。把两者绑定会让每次部署产生不必要的数据副作用，并可能重新引入弱密码账号。

### 问：幂等 seed 为什么仍可能不安全？

答：幂等只说明重复执行后的数据形态可预测，不代表副作用安全。旧代码虽然不会重复创建用户，却会重复覆盖密码哈希，因此在记录条数上幂等，在认证安全上并不幂等。

### 问：为什么不直接删除 seed？

答：固定演示数据对验收和本地学习有价值。更合适的边界是默认不执行、需要时显式执行，并保证重复执行不会覆盖已有凭据。

## 8. 易错点

- 只修改文档，却忘记移除 Dockerfile 中串联的 `npm run db:seed`。
- 用持久环境变量长期打开自动 seed，首次部署后忘记关闭。
- 误以为 upsert 一定安全，没有检查 `update` 分支是否覆盖密码。
- 为了清理一次性 seed 容器而执行 `down -v`，导致真实数据库 volume 被删除。
- 在线上直接使用固定 demo 密码，然后依赖“不公开账号邮箱”作为保护。
- 本地 `.env` 仍是旧 SQLite 连接串，导致生产构建误判为部署代码失败。

## 9. 验证方法

自动与配置检查：

```bash
docker compose --env-file .env.docker config --quiet
docker compose --env-file .env.docker build migrate
docker image inspect personal-knowledge-agent-migrate
npm test
npm run lint
npm run typecheck
DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build" \
AUTH_SECRET="local-build-placeholder" \
npm run build
```

如果本地 `.env` 还保留旧 SQLite URL，`next build` 在收集 `/api/health` 页面数据时会触发 PostgreSQL URL 校验并失败。这里使用的只是格式合法的构建占位值，不会真的连接数据库；生产运行时仍由 Compose 注入真实变量。

集成验证清单：

1. 对空数据库执行普通 `docker compose up --build -d`。
2. 确认 migrate 日志只有 `prisma migrate deploy`，没有自动 seed。
3. 查询 User 表，确认没有 `admin@example.com`。
4. 显式执行一次性 seed 命令，确认固定演示数据出现。
5. 修改演示账号密码后再次执行 seed，确认密码没有被重置。
6. 确认 App 健康检查仍返回数据库 reachable。

## 10. 后续改进

- 为真正生产环境设计一次性管理员邀请或初始化 token，完全移除固定密码。
- 将演示数据初始化放到独立 Compose profile 或专用运维脚本中。
- 增加数据库备份与恢复演练，再执行有风险的数据初始化操作。
- 香港服务器部署完成后，记录线上不自动 seed、注册、登录和 SSE 的端到端验证结果。
