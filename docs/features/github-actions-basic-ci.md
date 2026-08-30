# GitHub Actions 基础持续集成

## 1. 目标与结果

本地能通过测试和构建，并不能保证每次提交都执行了同一套检查。基础 CI 的目标是在代码进入 `main` 前提供自动质量门禁，让明显的测试失败、Lint 错误、类型错误、Prisma Client 缺失和生产构建失败尽早暴露。

本次完成：

- 新增 GitHub Actions 工作流，在推送到 `main`、面向 `main` 的 Pull Request 和手动触发时运行。
- 固定使用 Node.js 22，与 Dockerfile 的主要 Node 版本一致。
- 按 lockfile 执行 `npm ci`，并缓存 npm 下载缓存。
- 在干净检出中先生成 Prisma Client，再执行测试、ESLint、TypeScript 和 Next.js 生产构建。
- 工作流只授予 `contents: read`，不写仓库、不部署、不读取 DeepSeek API Key。
- 增加并统一使用 `npm run typecheck`，减少本地与 CI 命令差异。
- 增加并发取消：同一分支出现新提交时，取消旧的未完成 CI，减少等待和 Actions 分钟浪费。

工作流已经通过本地 YAML 解析和完整等价命令验证。由于仓库改动尚未提交和推送，第一次 GitHub 托管 runner 的绿色运行仍需在 push 后确认。

## 2. 相关文件职责

- `.github/workflows/ci.yml`：定义触发条件、最小 token 权限、并发策略、Node 环境和质量检查步骤。
- `package.json`：增加 `typecheck` 脚本，让本地和 CI 都通过同一入口执行 `tsc --noEmit`。
- `README.md`：说明 CI 覆盖范围、触发方式和状态边界。
- `docs/README.md`：把本文加入功能学习索引。
- `docs/plans/summer-assessment-roadmap.md`：同步基础 CI 的真实进度，并保留首次远程运行和线上部署待办。

## 3. 数据流

```text
开发者 push / 创建或更新 PR / 手动触发
  -> GitHub 创建 ubuntu-latest runner
  -> checkout 只读检出当前提交
  -> setup-node 安装 Node.js 22 并恢复 npm 下载缓存
  -> npm ci 按 package-lock.json 安装依赖
  -> prisma generate 生成未提交到 Git 的 Prisma Client
  -> npm test
  -> npm run lint
  -> npm run typecheck
  -> npm run build
  -> 全部成功：job 绿色
  -> 任一步失败：job 立即失败，后续步骤不执行
```

CI 不向生产环境发布内容。它只回答“这个提交是否通过当前定义的质量门禁”，不是 CD。

## 4. 关键代码解释

### 4.1 为什么同时监听 push、pull_request 和 workflow_dispatch

- `pull_request`：在合并前发现问题，是主要质量门禁。
- `push` 到 `main`：防止直接推送或合并后的最终提交未被检查。
- `workflow_dispatch`：排查 runner、缓存或外部网络问题时可以手动重跑。

没有使用 `pull_request_target`。后者在基础仓库权限上下文中运行，若错误检出并执行 fork 代码，容易扩大不可信代码的权限。当前 `pull_request` 配合只读 token，也不使用仓库 secrets，更适合本项目。

### 4.2 为什么是 `npm ci` 而不是 `npm install`

`npm ci` 要求 `package.json` 与 `package-lock.json` 一致，并严格安装 lockfile 记录的版本；不在 CI 中偷偷改 lockfile。这样本地、Docker 和 GitHub runner 更容易复现同一依赖树。

`setup-node` 的 npm cache 缓存的是 npm 全局下载缓存，不是 `node_modules`。每次仍会执行干净安装，只是尽量少重复下载压缩包。

### 4.3 为什么必须显式运行 Prisma generate

`src/generated/prisma` 受 `.gitignore` 保护，不会随源码检出。开发机上已有生成目录时，可能误以为 `next build` 自己会生成 Prisma Client；干净 runner 上则会直接出现模块缺失。

因此顺序必须是：

```text
npm ci -> npm run db:generate -> typecheck/build
```

这也验证了 schema、Prisma 配置和生成器至少能在 Linux runner 上加载。

### 4.4 为什么 CI 不启动 PostgreSQL

当前单元测试使用可控依赖替身，Lint、类型检查和 Next.js 构建也不会发起真实数据库查询。Prisma 7 加载配置时只要求 `DATABASE_URL` 格式合法，所以工作流提供指向本机占位地址的非秘密连接串即可。

如果加入需要真实数据库的集成测试，再为那个独立 job 增加 PostgreSQL service container、健康检查、`migrate deploy` 和测试数据；当前先避免增加无效等待和排错面。

### 4.5 为什么构建占位变量可以写在工作流中

`DATABASE_URL` 和 `AUTH_SECRET` 都是明确的 CI 占位值，不连接真实服务，也不承担任何线上认证功能。它们只让 Prisma 配置和 NextAuth 模块在构建时通过格式要求。

`DEEPSEEK_API_KEY` 没有提供，因为生产构建不需要调用模型。CI 也不应该为了编译而获得付费 API Key，避免 PR 代码或日志接触真实秘密。

### 4.6 为什么使用最小权限和并发取消

工作流只需要读取代码，因此显式设置：

```yaml
permissions:
  contents: read
```

`persist-credentials: false` 让检出后不为后续脚本保留可写认证配置。`concurrency.cancel-in-progress` 会在同一分支的新提交到来时取消旧运行，避免检查已经过时的 commit。

## 5. 设计取舍

### 一个 job 顺序执行，而不是拆成多个 job

测试、Lint、类型检查和构建共享同一套依赖与 Prisma 生成物。拆成四个并行 job 会重复执行 `npm ci`，增加 Actions 时间和初学者理解成本。当前单 job 日志也能明确显示失败步骤。

未来检查时间明显增长时，可以把便宜的静态检查与慢集成测试拆开，并使用 artifact 或可复现安装，而不是现在提前复杂化。

### 不在本轮构建 Docker 镜像

Next.js 生产构建已经覆盖应用编译，Docker 镜像也已在本地完成真实验证。每次 PR 再拉取基础镜像和构建两个 target 会明显增加时间，并受 Docker Hub 网络波动影响。部署到服务器前可增加只构建不推送的 Docker job，或在发布流程中构建。

### 不做自动 CD

验收阶段需要先理解服务器初始化、环境变量、migration、日志和回滚。CI 只检查质量，不持有服务器 SSH Key，也不自动发布，符合当前“先手动、可记录、可重复部署”的路线。

### 使用 action 主版本标签

依据 2026-08-31 的官方文档，当前使用 `actions/checkout@v7` 和 `actions/setup-node@v7`。主版本标签便于获得兼容修复；更严格的供应链环境可以锁定完整 commit SHA，并通过 Dependabot 定期更新。

## 6. 安全与稳定性边界

- `GITHUB_TOKEN` 只有仓库内容读取权限。
- 工作流不读取或打印 `DEEPSEEK_API_KEY`、生产 `DATABASE_URL`、生产 `AUTH_SECRET`。
- PR 使用普通 `pull_request` 触发器，不使用高风险的 `pull_request_target` 执行不可信代码。
- CI 不执行 migration、不连接生产数据库、不访问服务器、不推送镜像。
- 每个 job 最长 15 分钟，避免异常命令无限占用 runner。
- 缓存键由 lockfile 决定；缓存不替代 `npm ci`，也不缓存 `node_modules`。
- action 主版本会随上游更新；需要结合 GitHub Dependabot、官方 release notes 或完整 SHA 固定策略管理供应链风险。
- `npm ci` 的依赖审计告警仍需独立评估，不能用 `npm audit fix --force` 在 CI 中自动改变依赖版本。

## 7. 面试重点

### 问：CI 和 CD 有什么区别？

答：CI 在每次变更时自动安装、测试和构建，尽早发现集成问题；CD 把通过检查的产物发布到环境。当前项目只实现 CI，服务器部署仍是手动流程。

### 问：为什么 CI 仍要运行 `next build`，TypeScript 不是已经检查了吗？

答：`tsc --noEmit` 只验证 TypeScript；`next build` 还会执行 Next.js/Turbopack 编译、路由分析、服务端与客户端边界检查、静态页面生成和 standalone 输出。两者覆盖面不同。

### 问：为什么不用真实 secrets？

答：当前质量检查不需要访问真实外部服务。使用非秘密占位值可以减少泄漏面，fork PR 也能安全运行。只有确实需要集成外部服务的专门测试才应按最小权限注入 secret。

### 问：为什么 CI 中容易出现“本地正常、远程失败”？

答：CI 是干净的 Linux 环境，不包含本机未提交文件、旧生成物或隐式环境变量。大小写路径、漏提交 lockfile、漏执行 Prisma generate 和依赖系统库等问题都会暴露出来，这正是 CI 的价值。

### 问：为什么不并行跑所有命令？

答：当前总耗时短，共享依赖安装和生成产物更省资源；顺序执行也避免 build 与 typecheck 同时写缓存。检查规模增长后再按耗时和依赖关系拆 job。

## 8. 易错点

- 忘记运行 `prisma generate`，本机因残留生成目录成功，干净 runner 失败。
- 在 CI 使用真实生产数据库 URL 或付费 API Key。
- 使用 `npm install` 导致 lockfile 与实际安装漂移。
- 只跑 Lint，不跑测试、类型检查和生产构建。
- 用 `pull_request_target` 检出并执行 fork 代码，却没有理解其权限上下文。
- 给 `GITHUB_TOKEN` 默认写权限，或让 checkout 凭据留给后续脚本。
- 缓存整个 `node_modules`，导致原生依赖或 Node 版本切换后出现隐蔽问题。
- 在每个 job 重复安装依赖，却没有实际并行收益。
- 把 CI 绿色误认为线上运行正常；数据库、网络、SSE 和第三方 API 仍需部署后验证。

## 9. 验证方法

### 本地等价验证

```bash
npm ci
npm run db:generate
npm test
npm run lint
npm run typecheck
npm run build
```

本次结果：Prisma Client 7.8.0 生成成功，18/18 测试通过，ESLint、TypeScript 和 Next.js 16.2.10 生产构建均退出 0。

工作流 YAML 还通过本地 YAML 1.2 解析，确认包含 `push`、`pull_request`、`workflow_dispatch` 三个触发器和 `quality` job。

### GitHub 首次远程验证

1. 提交并 push `.github/workflows/ci.yml` 及相关改动。
2. 打开仓库 Actions 页面，确认 `Continuous Integration` 自动出现。
3. 检查 `quality` job 的七个业务步骤全部绿色。
4. 再创建一个面向 `main` 的 PR，确认 PR 会自动触发同一工作流。
5. 可在仓库分支保护中把该 check 设为合并前必需；个人仓库权限或套餐不支持时可暂缓。

## 10. 后续改进

- push 后确认第一次 GitHub 托管 runner 运行绿色，并把结果补充到路线图。
- 评估依赖审计告警，区分生产/开发依赖、可达性和安全升级影响。
- 增加带 PostgreSQL service container 的关键 API 集成测试，而不是让所有单元测试依赖数据库。
- 部署流程稳定后增加 Docker image build 检查，但暂不自动推送或发布。
- 按需要配置 Dependabot 更新 npm 依赖和 GitHub Actions 主版本或固定 SHA。
- 完成香港服务器手动部署后，再决定是否增加受审批保护的自动 CD。

## 11. 参考资料

- [GitHub Docs：构建和测试 Node.js](https://docs.github.com/en/actions/tutorials/build-and-test-code/nodejs)
- [actions/checkout 官方仓库](https://github.com/actions/checkout)
- [actions/setup-node 官方仓库](https://github.com/actions/setup-node)
- [GitHub Docs：控制 GITHUB_TOKEN 权限](https://docs.github.com/en/actions/tutorials/authenticate-with-github_token)
