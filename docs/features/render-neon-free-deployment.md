# Render Free + Neon Free 公网部署与验收

最后更新：2026-09-08。验收截止：2026-09-13。

## 1. 目标与实际结果

目标是获得能演示登录、个人知识检索、Agent 流式回答和历史记录的公网环境，同时把托管费用控制在免费额度内。DeepSeek API 调用仍产生模型费用，“免费部署”不等于 AI 调用免费。

实际站点：[Personal Knowledge Agent](https://personal-knowledge-agent.onrender.com)。当前架构是 **Render 新加坡单实例 Docker Web Service + Neon AWS Singapore PostgreSQL**。不是香港 VPS 上运行 Compose，也不是 Vercel Serverless。

先前 Vercel 部署已 Ready，但当前测试网络访问 `vercel.app` 失败；因此启用原定 Render 备用路线。Vercel 项目保留为部署尝试记录，其联网、SSE 和大陆可达性没有通过验收。Docker Compose 继续作为本地生产模拟与现场备用。

## 2. 相关文件职责

| 文件 | 职责与原因 |
| --- | --- |
| `Dockerfile` | 构建 Next.js standalone 镜像，最终 runner 用非 root 用户启动 `node server.js`；migrator 是独立阶段 |
| `.dockerignore` | 排除本机 `.env*`、数据库备份、node_modules 和构建缓存 |
| `next.config.ts` | `output: "standalone"` 收集运行所需依赖，减小镜像 |
| `src/lib/prisma.ts` | 通过 `adapter-pg` 连接数据库；Render 走 Docker 分支，最大 10 个客户端连接 |
| `prisma.config.ts` | 优先读取 migration 专用 `DIRECT_URL`，否则使用 `DATABASE_URL` |
| `src/app/api/health/route.ts` | 实际执行 `SELECT 1`，确认应用和数据库同时就绪 |
| `src/auth.ts`、`src/proxy.ts` | 登录与 JWT Session；通过运行变量 `AUTH_URL` 修正代理后的公开地址 |
| `src/app/api/chat/route.ts` | 认证、有限 Agent 编排、SSE、取消和最终消息保存 |
| `src/lib/knowledge-agent.ts`、`src/lib/web-search.ts` | 区分本地工具、服务端搜索结果与暂停续跑 |

## 3. 请求与数据流

```text
浏览器 HTTPS
  -> Render 托管 TLS 与反向代理
  -> 新加坡 Docker：Next.js / 0.0.0.0:3000
       -> Auth.js 从 JWT 取得 userId
       -> Prisma / pg -> Neon pooled endpoint -> PostgreSQL
       -> DeepSeek Anthropic 兼容 API -> SSE 增量回答
       -> 完成后一次性保存 assistant Message 与引用
```

Render 容器只承担计算。账号、Knowledge、Conversation、Message 存在外部 Neon，容器文件系统的临时性质不会改变这些数据的存储位置。重新部署仍必须实测原记录可读，不能只根据架构推断通过。

## 4. 复现配置与具体网址

现有服务控制台：[Render 服务](https://dashboard.render.com/web/srv-daeqsdvqj5pc73aj0h80)。数据库控制台：[Neon](https://console.neon.tech/)。持续集成：[GitHub Actions](https://github.com/kayo-limbo/personal-knowledge-agent/actions)。

服务配置：

| 配置 | 当前值 |
| --- | --- |
| Repository / Branch | `https://github.com/kayo-limbo/personal-knowledge-agent` / `main` |
| Runtime / Plan / Region | Docker / Free / Singapore |
| Dockerfile / Docker Command | 根目录 `Dockerfile` / 使用镜像自带 CMD |
| Health Check Path | `/api/health` |
| Auto Deploy | 关闭；push 后需要手动部署 |
| PORT | `3000`，与应用和 Docker 内建健康检查一致 |
| AUTH_URL | `https://personal-knowledge-agent.onrender.com` |
| DATABASE_URL | Neon pooled 地址，仅控制台或安全 CLI 注入 |
| AUTH_SECRET | 随机服务端密钥 |
| DEEPSEEK_API_KEY | 服务端 DeepSeek Key |
| DEEPSEEK_MODEL | `deepseek-v4-flash` |

首次创建空数据库时：在 Neon 选择 Free、AWS Singapore，取得 direct 连接串并仅在本机进程或被忽略的环境文件中设置 `DIRECT_URL`，运行 `npm run db:deploy`。当前 Neon 初始 migration 已成功应用，无需重新初始化，也没有执行 demo seed。

后续发布：

1. 本地运行测试、Lint、TypeScript 和 build，按文件范围提交。
2. `git push origin main`，在 Actions 查看对应提交是否绿色。
3. Render 控制台选择 Manual Deploy，并核对部署的 commit SHA；或使用已授权官方 CLI：`render deploys create srv-daeqsdvqj5pc73aj0h80 --commit <完整提交SHA> --confirm -o json`。
4. 等待状态为 live，访问 `/api/health` 并验证主流程。
5. 只有 schema 改动才需要先部署 migration；应用构建和启动不运行 seed。

## 5. 关键代码解释与设计取舍

### AUTH_URL 与代理

容器监听地址 `0.0.0.0:3000` 不是用户访问的站点地址。首次部署的登录回调曾指向该内部地址；在 Render 配置公开 `AUTH_URL` 并重新部署后，回调已变成正确的 HTTPS 站点。此值是环境配置，不应把 Render 域名写死到业务代码里。

### 为什么显式 PORT=3000

Render 默认推荐 10000，也允许配置端口。这里显式使用 3000，与现有 Docker HEALTHCHECK 一致；Render 自身另用 `/api/health` 做 HTTP 检查。仅有 `EXPOSE 3000` 不能让进程开始监听，真正生效的是服务器读取 `PORT` 并绑定 `HOSTNAME=0.0.0.0`。

### Serverless 与容器时限

`maxDuration=60` 保留用于 Vercel 部署；它不是 Render Docker 的硬函数时限。实际业务保护仍由 Agent 50 秒超时、4 轮、3 次本地工具调用和 AbortSignal 实现。SSE 必须从客户端观察连续增量，单独 HTTP 200 不能证明未缓冲。

### 服务端搜索的真实兼容边界

线上强制搜索返回成功结果后仍失败。直接检查真实 DeepSeek 响应确认：停止原因是 `tool_use`，内容只有 `server_tool_use` 与 `web_search_tool_result`，没有本地工具调用，也没有最终文本。此前仅处理 `pause_turn` 的提交没有覆盖此情况。

当前修复将完整 assistant 搜索结果回传，并添加总结请求；下一轮移除联网工具，继续受原有轮数和总超时限制。加密搜索内容只留在本次内存上下文并回传供应商，最终保存回答和安全来源链接。

还发现上游在 `max_uses: 1` 下报告 `web_search_requests: 3`。应用可以控制是否开放工具、后续是否继续开放，却不能据此保证供应商内部严格只搜一次。文档、简历和费用估计必须区分应用轮次与上游内部次数。

## 6. 验证记录与待完成项目

已实测：

- Neon migration 成功、无自动 seed；Render Docker 构建与 `/api/health` 200，数据库 reachable。
- 当前测试网络可访问 Render 站点，注册、登录、JWT Session、Knowledge CRUD、跨用户 Knowledge 404。
- `searchKnowledge` 与知识引用，Flash 普通模式 SSE；此前一次请求首 chunk 1.435 秒、总 5.184 秒、262 个 delta，属于单次样本而非性能保证。
- 完整回答已写入 Neon 的 Message；不能直接在原始 SSE 中搜索完整句子，需先解析和拼接 delta。
- 客户端主动断开后，测试会话只保留 user 消息，assistant 占位被删除。
- `f3abb8a` 已 live，GitHub Actions [对应运行绿色](https://github.com/kayo-limbo/personal-knowledge-agent/actions/runs/34053048732)。但该线上版本的强制联网仍失败。
- 新增的服务端 `tool_use` 总结修复已通过真实 Agent 直连：两轮完成、生成文本和 5 条网页来源；发布后仍需公网复验。
- 修复版本本地完整 HTTP 链路已通过：登录 → 强制联网 → 486 个 delta → 网页链接 → `done` → Neon Message 与拼接文本一致；首字 4.637 秒，总 8.358 秒。该结果不是 Render 公网复验结果。
- 最终本地检查：21/21 测试、ESLint、TypeScript、Next.js 16.2.10 生产构建通过。构建使用非秘密 PostgreSQL 占位地址，不执行线上迁移。

待验收，不能标记已完成：

- [ ] 发布最终搜索修复后，Render 强制联网产生文本、网页来源和 `done`。
- [ ] 发布每日聊天配额代码；对应 Neon migration 已应用，本地 200→429 门禁已通过。
- [ ] 完整 Pro/思考模式、浏览器 Markdown 和“停止”按钮视觉交互。
- [ ] 保存账号、知识、回答后重新部署，再核对记录仍可访问。
- [ ] 现场同类网络多次访问，覆盖免费实例休眠与唤醒。

测试用户使用随机邮箱与强随机密码，验证后按本轮精确 userId/邮箱清理关联数据；不运行固定弱密码 seed。清理测试数据不可恢复，不影响用户原有记录。

## 7. 面试重点与易错点

- 为什么 Ready/live 不等于全流程通过？它只说明构建、启动或健康门禁通过。
- 为什么换容器数据还在？应用与数据库生命周期分离，持久记录放在 Neon。
- 为什么 SDK 类型正确仍可能协议失败？兼容接口的停止原因和内部搜索次数必须实测。
- 为什么保留 Docker？同一应用可在 Render 和本地 Compose 运行，现场断网时仍能讲解与演示本地闭环。
- 不把 `DIRECT_URL`、API Key、Auth Secret 写进 Git、镜像、日志或截图；不把模板占位值当作运行凭据。

## 8. 后续与免费限制

Render Free 空闲约 15 分钟会休眠，再次访问唤醒约一分钟，且有免费实例小时、构建和流量额度。演示前主动打开网页完成一次暖机，并保留本地 Compose 与备用录屏；不扩展付费机器、多环境或自动 CD。详见 [Render 免费计划限制](https://render.com/docs/free)。

下一步统一发布搜索修复与 PostgreSQL 每日请求配额并完成公网验收，再处理演示数据、5—10 分钟脚本和 PPT。精确 usage 与预算告警仍延期。免费托管不提供稳定性承诺，当前网络的一次成功也不代表所有大陆网络可达。

官方参考：[Render Web Service 与端口](https://render.com/docs/web-services)、[Render Docker](https://render.com/docs/docker)、[Auth.js 部署](https://authjs.dev/getting-started/deployment)、[DeepSeek Anthropic 兼容协议](https://api-docs.deepseek.com/guides/anthropic_api/)。
