# 2026-09-09 收尾验证记录

## 环境与边界

本轮验证对象为本地工作区构建的 Compose 应用。Render 当前仍是之前的 bcbf877，不能声称本轮未提交修复已公网通过。没有 schema 变更，不需要新增 migration；没有自动 seed。

## 已通过

- 31 项 Node 测试：新增跨字节中文 SSE、CRLF、正常 done、提前 EOF、半帧、非法事件、服务端 error、登录输入校验。
- TypeScript 与 ESLint；Next.js 16.2.10 Docker 生产构建。
- 真实 Chrome + 本地 PostgreSQL 集成：旧 Cookie 角色更新；旧管理员 Action 在降权后拒绝执行；恢复角色后同 Cookie 更新。
- 浏览器 Prompt 创建、修改、删除；他人模板在配额计数前拒绝。
- 一次真实 DeepSeek 模板回答，Markdown 列表与代码渲染，Conversation.promptId 与回答落库，刷新后保留模板选择。
- 浏览器组合输入 Enter 不发送。受控浏览器响应验证提前 EOF 错误、停止按钮与离页 Abort；这些异常样本没有调用真实 DeepSeek。
- 顶部两种搜索目标、中文与 & 编码。
- 删除模板后关联会话保留、promptId 置空。
- 人工演示数据重复准备；真实 Chrome 登录两个账号，确认角色和知识隔离。
- 两处 Knowledge 原有修改哈希保持不变。

## 可重复验证

先构建启动 Compose，再执行 `node scripts/verify-acceptance.mjs`。脚本创建随机临时账号，会调用一次真实 DeepSeek；结束按精确 userId 清理这些账号和关联数据，不清理已有记录。测试占用的全站配额保留，不通过修改总计数抹去实际请求。

该脚本不加入无密钥 CI，因为它依赖本地 Docker、Chrome 和真实模型。CI 继续运行无外部服务的单元测试、Lint、类型检查和构建。

## 尚待完成

- 本轮代码提交、用户 push、对应 CI、Render 手动部署。
- 新版本公网登录后的功能与浏览器回归。
- 现场同类网络和 Render 休眠唤醒检查。
- 用户人工完成一次固定问题演练并保存回答作为现场备用。

PPT 和录屏已按用户要求取消。分页、消息 usage、移动端抽屉与新技术扩展仍延期。
