# 会话历史管理

## 目标与结果

独立历史记录入口不再返回 404。ADMIN 和 USER 可以按标题搜索最近会话、修改标题、删除会话及其消息，并从历史页跳回 Chat Workspace 的指定会话。GUEST 仍只保留受限聊天入口，不获得历史管理权限。

## 相关文件职责

- `src/app/dashboard/history/page.tsx`：历史列表、搜索表单、继续对话、重命名和删除入口。
- `src/app/dashboard/history/actions.ts`：历史修改的认证、校验、缓存刷新和结果跳转。
- `src/lib/services/conversation.service.ts`：查询最近 50 条、按 `id + userId` 修改、事务删除消息与会话。
- `src/app/dashboard/chat/page.tsx`：读取 Next.js 16 异步 `searchParams` 中的会话 id。
- `src/app/dashboard/chat/components/ChatWorkspace.tsx`：用服务端已经验证的初始会话 id 初始化 Zustand。
- `src/lib/validators/conversation.ts`：会话标题长度校验。

## 数据流

```text
/dashboard/history?query=关键词
  -> Server Component + Session userId
  -> PostgreSQL Conversation（最多 50 条）
  -> 用户点击继续对话
  -> /dashboard/chat?conversation=<id>
  -> getChatBootstrap(id + userId)
  -> ChatWorkspace 激活该会话
```

删除路径是 `Action -> auth -> 归属检查 -> transaction(deleteMany Message, delete Conversation)`。若 id 属于其他用户，归属检查直接失败，不会触碰其消息。

## 关键代码解释

Next.js 16 的 `searchParams` 是 Promise，所以页面先 `await searchParams`。历史链接或表单 hidden id 即使被篡改，`getChatBootstrap` 和修改 service 仍用 `id + userId` 查询；客户端只负责提交候选 id，不能凭 URL 或表单越权加载、修改记录。

Conversation 和 Message 没有配置数据库级级联删除，因此服务层在同一事务中先删消息再删会话。这样不会遗留孤儿数据，也不会出现只删了一半的状态。

## 设计取舍

- 当前最多显示最近 50 条并支持标题搜索，足够验收演示；真正大数据量分页明确延期。
- 不展示完整消息正文，只显示最近有效消息摘要，减少页面体积和隐私暴露。
- 重命名由用户明确触发，没有额外调用模型生成标题，避免费用和延迟。

## 面试重点

1. URL 参数为什么不能作为权限依据。
2. 为什么删除会话要事务处理两张表。
3. Server Component 获取数据和 Client Component 管理交互状态如何分工。
4. 为什么限制首屏历史数量，以及未来怎样做游标分页。

## 易错点

- 只按 Conversation id 查询，造成水平越权。
- 删除 Conversation 前没有处理 Message 外键。
- 历史链接只跳到聊天页，却始终选中第一条会话。
- 声称已经完成无限历史或数据库分页；当前是最近 50 条上限。

## 验证方法

1. 新建至少两个会话，历史页能按更新时间倒序显示。
2. 搜索、重命名后 Dashboard 和聊天侧栏标题同步。
3. 点击继续对话后打开正确消息。
4. 删除后会话和 Message 同时消失。
5. 使用第二个账号篡改 URL 或 Action id，不能读取或修改他人会话。

2026-09-09 本地 Docker 验证已完成指定会话重命名和“Message 先删、Conversation 后删”的事务删除，临时记录已清理；ADMIN 四页面均返回 200，普通 USER 手输管理员 URL 返回 307。真实浏览器视觉和公网版本仍待验证。

## 后续改进

数据量增长后改为基于 `updatedAt + id` 的游标分页；再补批量删除、归档和摘要搜索。验收前不引入全文搜索集群或向量化历史检索。
