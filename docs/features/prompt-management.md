# Prompt 管理

## 目标与结果

导航中的 Prompt 管理不再指向 404。登录的 ADMIN 和 USER 可以创建、查看、编辑、收藏、标记公开及删除自己的 Prompt；GUEST 无权进入。当前功能解决“可复用提示词资产如何持久化和管理”，尚未把选中的 Prompt 自动注入聊天请求，这一点不能在演示中夸大。

## 相关文件职责

- `src/app/dashboard/prompts/page.tsx`：Server Component 页面，读取 Session 和当前用户 Prompt，渲染渐进增强表单。
- `src/app/dashboard/prompts/actions.ts`：创建、更新、删除 Server Action；每次调用都重新认证、校验输入并刷新页面。
- `src/lib/services/prompt.service.ts`：Prisma 数据访问，所有修改条件都包含 `userId`。
- `src/lib/validators/prompt.ts`：限制标题和正文长度，拒绝空输入。
- `tests/dashboard-management.test.ts`：覆盖 Prompt 输入裁剪、必填与非法值。

## 数据流

```text
浏览器 form
  -> Prompt Server Action
  -> auth() 取得可信 userId 和 role
  -> Zod 运行时校验
  -> prompt.service（id + userId）
  -> PostgreSQL Prompt
  -> revalidatePath
  -> 页面重新读取当前用户数据
```

## 关键代码解释

页面隐藏 Guest 导航只是体验优化，真正边界在 Server Action：请求可以绕过页面直接构造，所以每个 Action 都调用 `auth()`。更新使用 `updateMany({ where: { id, userId } })`，不能只凭客户端传来的 id。删除前先确认归属，并在事务中把已有会话的 `promptId` 置空，再删除 Prompt，避免外键失败且保留历史会话。

表单使用 Next.js 16 Server Actions。记录 id 放在 hidden 字段只是为了定位候选记录，它在浏览器中可见且可篡改，因此 Action 会重新校验格式，service 再使用 `id + userId` 约束所有权。成功或失败后跳回固定页面并显示消息，不接受客户端传入回跳 URL，因此没有开放重定向问题。公开标记目前只是数据属性，不赋予其他用户编辑权限。

## 设计取舍

- 复用现有 Prompt 表，不增加 migration，降低截止日前风险。
- 使用服务端表单而不是引入新的复杂客户端状态库；提交后由服务端重新读取，保证展示与数据库一致。
- 暂不做 Prompt 市场、版本历史和聊天自动注入。先保证管理闭环，再决定是否把 Prompt 选择接入 Chat Composer。

## 面试重点

1. TypeScript 类型不能校验真实 HTTP 输入，所以仍用 Zod。
2. 资源 id 不是权限证明；数据查询必须同时约束 Session 的 `userId`。
3. Server Action 仍是公开 POST 入口，页面级鉴权不能替代 Action 内鉴权。
4. 删除父记录前如何处理可选外键，以及为什么要放进事务。

## 易错点

- 把 `isPublic=true` 错当作允许任何用户修改。
- 只在页面过滤 Guest，却没有在 Action 中检查。
- 直接删除仍被 Conversation 引用的 Prompt，触发外键错误。
- 把 Prompt 管理说成已经参与 Agent 推理；当前聊天链路还没有选择 Prompt。

## 验证方法

1. ADMIN/USER 创建、修改、收藏和删除 Prompt，Dashboard 计数同步变化。
2. 第二个用户看不到第一位用户的私有或公开管理记录。
3. GUEST 手输 `/dashboard/prompts` 会被重定向。
4. 提交空标题、空正文和超长正文会得到中文错误。
5. 运行 `npm test`、`npm run lint`、`npm run typecheck` 和 `npm run build`。

2026-09-09 本地 Docker 验证已用随机临时 ADMIN 通过标准 multipart Server Action 完成创建、更新和删除，三个数据库结果均正确；测试账号和 Prompt 已清理。真实浏览器布局与交互仍需人工检查，公网在新提交部署前不能标记完成。

## 后续改进

在核心演示稳定后，可以给 Chat Composer 增加 Prompt 选择器，把选中的 `promptId` 写入 Conversation，并在服务端读取归属正确的 Prompt 注入模型请求；还可以增加模板变量和版本历史，但验收前不扩展 Prompt 市场。
