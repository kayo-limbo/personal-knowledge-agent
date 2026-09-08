# 管理员用户管理与系统统计

## 目标与结果

ADMIN 导航中的用户管理和系统统计不再返回 404。用户管理页展示非敏感账号信息、各用户内容数量并允许调整 ADMIN/USER/GUEST；系统统计页聚合用户、知识、Prompt、会话、消息、近 7 天活动和 UTC 当日聊天配额。普通 USER/GUEST 手输 URL 也不能进入。

## 相关文件职责

- `src/app/dashboard/admin/users/page.tsx`：管理员用户表格、搜索和角色表单。
- `src/app/dashboard/admin/users/actions.ts`：再次校验 ADMIN、限制角色枚举并阻止当前管理员自我降权。
- `src/lib/services/user.service.ts`：只选择页面需要的字段与关联计数，不返回 `passwordHash`。
- `src/app/dashboard/admin/stats/page.tsx`：统计卡片和配额进度展示。
- `src/lib/services/admin-stats.service.ts`：并行执行 PostgreSQL count 查询并读取全站配额桶。
- `src/lib/validators/admin.ts`：角色白名单。

## 数据流

```text
管理员请求页面
  -> auth() 检查 role === ADMIN
  -> user/admin-stats service
  -> PostgreSQL 聚合或最小字段查询
  -> Server Component HTML

角色表单
  -> Server Action 再次检查 ADMIN
  -> Zod 角色白名单
  -> 禁止当前管理员自我降权
  -> 更新 User.role
```

## 关键代码解释

侧栏只对 ADMIN 显示入口，但页面和 Action 都再次鉴权，因为隐藏链接不是安全控制。角色表单中的 hidden 用户 id 可被篡改，因此 Action 重新校验 id 与角色枚举，并以 Session 角色决定是否允许全局管理。用户查询使用 `select` 明确列出 id、邮箱、姓名、角色、时间和计数，密码哈希从数据访问层就不会返回。

统计服务使用 `Promise.all` 并行执行相互独立的 count，缩短总等待时间。今日请求数读取已有 `ChatQuota(scope=global, subjectId=all)`，没有重复维护第二套统计口径。页面只展示数量，不读取聊天正文。

## 设计取舍

- 用户管理只做角色调整，不提供删除账号或重置密码，避免验收前引入高风险破坏操作。
- 禁止当前管理员降低自己的角色，避免单管理员演示环境把自己锁在后台外。
- 系统统计是轻量运营概览，不冒充日志、Tracing 或完整可观测平台。

## 面试重点

1. RBAC 为什么必须在服务端页面和每个 mutation 中执行。
2. 数据最小化：为什么不查询 `passwordHash` 后再依赖 UI 隐藏。
3. 如何避免管理员误操作导致权限锁死。
4. 并行聚合的收益，以及数据量大后 count 查询可能带来的成本。

## 易错点

- 只根据前端角色或侧栏判断权限。
- 接受任意字符串写入角色。
- 把密码哈希传给页面再说“没有显示”。
- 允许管理员取消自己最后的 ADMIN 权限。
- 在统计页读取或展示聊天正文。

## 验证方法

1. ADMIN 能搜索用户并修改另一账号角色，刷新后 Session 权限按新登录状态生效。
2. 当前管理员的角色控件禁用，伪造 Action 也会被服务端拒绝自我降权。
3. USER/GUEST 手输两个管理员 URL 会跳回 Dashboard。
4. 系统统计数字与数据库抽样计数一致，今日配额不超过配置上限。
5. 页面源码和响应中没有 `passwordHash`、数据库连接串或 API Key。

2026-09-09 本地 Docker 验证已由临时 ADMIN 把临时 USER 调整为 GUEST，重新登录后的 JWT Session 角色为 GUEST；用户管理和系统统计页面均成功执行真实 PostgreSQL 查询。所有临时账号已精确清理，公网版本仍待部署。

## 后续改进

后续可增加审计日志、最后登录时间、管理员操作二次确认和大表统计缓存。账号删除、封禁、密码重置需要单独设计审计与恢复流程，不在本次截止日前仓促加入。
