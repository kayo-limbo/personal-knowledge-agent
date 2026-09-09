# 2026-09-09 收尾验证记录

## 环境与边界

本轮验证对象为本地工作区构建的 Compose 应用。Render 当前仍是之前的 bcbf877，不能声称 `1f27fec` 或本轮未提交文件导入已公网通过。文件导入复用 `KnowledgeDoc`，没有 schema 变更，不需要新增 migration；没有自动 seed。

## 已通过

- 39 项 Node 测试：除原有收尾测试外，新增文件格式/编码/数量限制、分块预算与 PDF 页码；内存生成的真实 PDF 已成功提取文字。
- TypeScript 与 ESLint；Next.js 16.2.10 Docker 生产构建。
- 真实 Chrome + 本地 PostgreSQL 集成：旧 Cookie 角色更新；旧管理员 Action 在降权后拒绝执行；恢复角色后同 Cookie 更新。
- 浏览器 Prompt 创建、修改、删除；他人模板在配额计数前拒绝。
- 一次真实 DeepSeek 模板回答，Markdown 列表与代码渲染，Conversation.promptId 与回答落库，刷新后保留模板选择。
- 浏览器组合输入 Enter 不发送。受控浏览器响应验证提前 EOF 错误、停止按钮与离页 Abort；这些异常样本没有调用真实 DeepSeek。
- 顶部两种搜索目标、中文与 & 编码。
- 删除模板后关联会话保留、promptId 置空。
- 人工演示数据重复准备；真实 Chrome 登录两个账号，确认角色和知识隔离。
- 真实 Chrome 向 Linux standalone Docker 同时上传 Markdown 和 PDF，两个文件均提取文字并以 `source=upload` 落入当前临时账号。
- 未登录直接 POST `/api/knowledge/import` 返回 401；浏览器不能通过伪造 userId 指定数据归属。
- 首次容器 PDF 回归发现 standalone 缺少 `@napi-rs/canvas` 和 `pdf.worker.mjs`；按 Next.js 16 `serverExternalPackages` 与 `outputFileTracingIncludes` 修复，重建后真实 PDF 上传通过。
- 一次真实 DeepSeek 请求主动调用 `searchKnowledge`，从导入的 Polaris 文档回答“15 分钟”和“雪松”，页面和持久化消息均包含 `demo-import-source.md` 来源。
- PostgreSQL 英文全文查询与中英文关键词查询在真实 Agent 链路中执行；结果仍受 `userId`、最多 5 条和约 6000 字符限制。
- 最终本地 app 镜像约 121 MB；完成 PDF/Agent 回归后的容器内存约 185 MiB，低于 Render Free 512 MB 配额。该读数是本机单次样本，不代表公网峰值承诺。
- 两处 Knowledge 原有修改哈希保持不变。

生产依赖审计通过 npm 官方 registry 执行，报告 22 条仓库现有依赖树告警；报告中没有 `pdf-parse`、`pdfjs-dist` 或 `@napi-rs/canvas` 责任链。直接依赖中的 Next.js/Auth.js 告警仍是独立安全债，不能用 `npm audit fix --force` 在验收前盲目降级或升级，后续需要结合兼容性单独处理并完整回归。

## 可重复验证

先构建启动 Compose，再执行 `node scripts/verify-acceptance.mjs`。脚本创建随机临时账号和临时 PDF，会调用一次真实 DeepSeek；结束按精确 userId 清理这些账号和关联数据，并删除临时 PDF，不清理已有记录。测试占用的全站配额保留，不通过修改总计数抹去实际请求。

该脚本不加入无密钥 CI，因为它依赖本地 Docker、Chrome 和真实模型。CI 继续运行无外部服务的单元测试、Lint、类型检查和构建。

## 尚待完成

- 本轮代码提交、用户 push、对应 CI、Render 手动部署。
- 新版本公网登录后的功能与浏览器回归。
- 现场同类网络和 Render 休眠唤醒检查。
- 用户人工完成一次固定问题演练并保存回答作为现场备用。

PPT 和录屏已按用户要求取消。分页、消息 usage、移动端抽屉与新技术扩展仍延期。
