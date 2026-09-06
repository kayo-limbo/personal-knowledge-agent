# 受控联网搜索与网页引用

## 1. 目标与结果

大模型的训练知识有截止时间，新闻、价格、软件版本和政策等信息可能已经变化。这个功能让个人知识库 Agent 在必要时搜索互联网，同时把“是否联网”和“最多搜索几次”控制在应用手里。

完成后的效果：

- 聊天输入区有“自动联网、强制联网、禁止联网”三档。
- 自动模式由模型判断问题是否需要最新信息；强制模式保证本次回答先联网；禁止模式完全不向模型提供联网工具。
- 整次聊天请求最多联网一次，即使 `searchKnowledge` 让 Agent 进入下一轮，也不会再次搜索网页。
- 浏览器实时显示“正在联网搜索 / 完成 / 失败”。
- 最终回答追加网页标题、URL 和页面时间，刷新页面后仍能看到来源。
- 搜索结果按不可信输入处理，链接只接受 `http/https`。

## 2. 方案选择与设计取舍

实现前比较了两类方案：

1. DeepSeek 官方服务端 Web Search：与当前 Anthropic 兼容接口共用 `DEEPSEEK_API_KEY`，服务端负责真正的搜索和结果回填。
2. 独立搜索 API：应用自己发送 HTTP 请求，可以获得更自由的摘要和排序字段，但会增加供应商、Key、费用、超时和错误处理。

验收版选择第一种。原因是它能直接复用当前流式请求，新增基础设施最少，符合“先保证功能闭环和稳定演示”的范围约束。官方兼容说明见 [DeepSeek Anthropic API](https://api-docs.deepseek.com/guides/anthropic_api/)；Responses API 也明确列出了服务端 `web_search`，见 [DeepSeek Responses API](https://api-docs.deepseek.com/api/create-response/)。

取舍是：官方结果块中的正文是加密内容，应用只提取标题、URL 和 `page_age`，不能在自己的代码里重排正文摘要。当前由模型基于搜索结果生成答案摘要；如果以后需要固定搜索供应商、可审计摘要或域名级排序，再考虑独立搜索 API。

## 3. 相关文件职责

- `src/lib/web-search-config.ts`：定义三种联网模式及客户端下拉框选项。它不包含服务端秘密，可以安全进入客户端包。
- `src/lib/web-search.ts`：定义官方 Web Search 工具、模式策略、结果提取、URL 白名单、来源去重和 Markdown 来源列表。
- `src/lib/validators/chat.ts`：用 Zod 校验浏览器提交的 `webSearchMode`，不能把任意字符串直接交给上游 API。
- `src/app/dashboard/chat/types.ts`：补充聊天请求的联网模式类型。
- `src/app/dashboard/chat/components/ChatComposer.tsx`：展示联网模式选择器。
- `src/app/dashboard/chat/components/ChatWorkspace.tsx`：保存本次选择并随消息提交。
- `src/app/api/chat/route.ts`：把联网策略接入 DeepSeek 流、监听服务端工具事件、合并网页来源并持久化最终文本。
- `src/app/dashboard/chat/components/ChatMessages.tsx`：区分个人知识库检索和联网搜索的实时状态。
- `tests/web-search.test.ts`：验证策略、次数边界、安全 URL、错误映射、来源去重和 Markdown 转义。
- `package.json`：把新测试加入统一 `npm test`。

## 4. 数据流

```text
用户选择联网模式并提问
  -> ChatWorkspace POST /api/chat
  -> sendChatSchema 校验 webSearchMode
  -> Route Handler 读取本次请求是否已经联网
  -> getWebSearchPolicy
       auto: 暴露工具，由模型决定
       always: 强制选择 web_search
       never: 不暴露工具
  -> DeepSeek 在服务端执行 Web Search
  -> SSE server_tool_use 事件变成浏览器“正在联网搜索”状态
  -> 最终消息中的 web_search_tool_result
  -> 提取标题、http/https URL、page_age
  -> 去重并编号为 [网页 n]
  -> 工具轨迹 + 网页来源追加到最终回答
  -> 一次性写入 assistant Message
  -> 刷新后从会话历史恢复
```

个人知识库搜索仍由应用服务器按 Session `userId` 执行；网页搜索则由 DeepSeek 服务端执行。二者都只在服务端编排，浏览器看不到 API Key。

## 5. 关键代码解释

### 5.1 为什么既要 `max_uses`，又要 `webSearchUsed`

`WEB_SEARCH_TOOL` 设置了 `max_uses: 1`，但这个限制只针对一次上游模型 API 调用。当前 Agent 可能因为 `searchKnowledge` 产生多轮模型请求；如果每一轮都重新暴露 Web Search，每一轮理论上都能搜索一次。

因此 Route Handler 还维护请求级 `webSearchUsed`。一旦流中出现 `server_tool_use(web_search)`，后续 Agent 轮次立即移除联网工具。这才把限制提升为“整条用户消息最多一次”，也是本功能最重要的费用边界。

### 5.2 三档模式如何工作

`getWebSearchPolicy` 只返回受控策略：

- `auto`：提供工具，`tool_choice` 为 `auto`。
- `always`：第一次请求使用指定工具选择，强制 `web_search`。
- `never`：不把 Web Search 放进 `tools`；仅靠 Prompt 说“不要联网”不够可靠。

“能力是否存在”由服务端工具列表决定，比让模型遵守一句自然语言更可控。

### 5.3 为什么不把网页正文直接写入数据库

搜索正文可能很长、重复、带版权限制，也可能包含 Prompt Injection。当前只持久化模型回答、工具轨迹和来源元数据，不保存搜索正文。这样既减少数据库膨胀，也避免把第三方网页内容长期复制到个人数据库。

### 5.4 网页链接为什么还要校验协议

搜索供应商返回的数据也属于外部输入。`normalizeUrl` 使用 `URL` 解析，并只允许 `http:` 和 `https:`，从而拒绝 `javascript:` 等危险协议。标题进入 Markdown 前会转义，URL 中会破坏链接语法的括号也会编码。

### 5.5 为什么使用现有 SSE 事件

聊天已经有 `tool` 类型的 SSE 帧和 Zustand 更新逻辑。联网搜索沿用同一结构，只用 `name` 区分 `searchKnowledge` 与 `webSearch`。这让客户端不需要第二套流协议，也保持了停止生成、错误显示和消息状态的一致性。

## 6. 安全、费用与稳定性边界

- API Key 只由 `src/lib/deepseek.ts` 在服务端读取，没有新增 `NEXT_PUBLIC_` 环境变量。
- `webSearchMode` 必须经过服务端枚举校验。
- 禁止联网通过“移除工具”实现，不依赖模型自觉。
- 每条用户消息最多一次 Web Search；网页来源最多展示 5 条。
- 搜索内容在 System Prompt 中被声明为不可信材料，要求忽略改变角色、泄露提示词或执行操作的指令。
- 来源 URL 只允许 `http/https`，标题进行 Markdown 转义。
- 仍复用 Agent 50 秒总超时和浏览器取消链路；停止生成会中止 DeepSeek 上游请求。
- 搜索会产生额外模型 Token 成本，所以默认自动模式也必须在演示时观察余额；更严格的用户级限流仍是后续任务。

## 7. 面试重点

### 问：为什么这算“受控”联网，而不是给模型一个搜索开关？

答：控制权有三层。请求输入只能取固定枚举；禁止模式从工具列表删除能力；服务端用 `max_uses` 加请求级状态把次数限制为一次。模型只决定“自动模式下要不要用”，不能突破服务端边界。

### 问：为什么 `max_uses: 1` 还不够？

答：Agent 的每一轮是一次新的上游 API 请求，供应商的 `max_uses` 通常只约束单次 API 调用。应用必须跨轮记录是否已经搜索，才能限制整个用户请求。

### 问：本地 `searchKnowledge` 和服务端 Web Search 有什么区别？

答：`searchKnowledge` 是客户端工具：模型给参数，应用校验并按 Session 用户执行数据库查询，再回填 `tool_result`。Web Search 是服务器工具：DeepSeek 在同一次模型请求内搜索并回填，应用监听结果块并负责展示、持久化和安全过滤。

### 问：怎样防 Prompt Injection？

答：不把搜索内容当指令，System Prompt 明确它只能作为事实材料；应用不执行网页中的命令，也不把正文写入数据库；输出链接还经过协议白名单。要注意，Prompt 防护不能保证绝对安全，后续可以增加域名白名单和高风险动作的人工确认。

## 8. 易错点

- 只设置工具的 `max_uses`，忘记 Agent 多轮会创建多次上游请求。
- “禁止联网”只写在 Prompt 中，却仍把工具暴露给模型。
- 把 `web_search_tool_result` 当作应用自己要回填的 `tool_result`；它其实由 DeepSeek 服务端完成。
- 只监听文本增量，导致用户不知道首字前为什么等待很久。
- 直接把第三方标题和 URL 拼进 Markdown，造成链接语法破坏或危险协议。
- 联网搜索成功但没有把来源追加到持久化文本，刷新后引用消失。
- 把网页搜索和 PostgreSQL、Docker 同时开发，出现问题时难以定位是哪一层。

## 9. 验证方法

自动验证：

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
```

`tests/web-search.test.ts` 覆盖：

- 自动、强制、禁止三档映射。
- 已搜索后不再暴露工具。
- `javascript:` URL 被拒绝。
- 来源去重和最多 5 条。
- 搜索错误转为可公开的中文提示。
- 同一 URL 跨轮复用 `[网页 n]` 编号。
- 标题和 URL 安全生成 Markdown。

手工验证清单：

1. 选择“禁止联网”，询问今天的新闻，确认没有联网工具状态。
2. 选择“强制联网”，询问一个普通问题，确认仍出现一次联网状态和网页来源。
3. 选择“自动联网”，询问最新软件版本，确认 Agent 自主搜索。
4. 在同一问题中同时询问“我的部署计划”和“今天的相关最新消息”，确认知识库和网页工具可以共同出现，但联网不超过一次。
5. 搜索中点击停止生成，确认请求停止且历史中没有空 assistant 消息。
6. 回答完成后刷新页面，确认工具轨迹和网页链接仍存在。
7. 点击网页链接，确认只会打开 `http/https` 地址。

真实 DeepSeek 联网调用会产生费用，因此自动测试只验证本地策略和结果解析；端到端搜索需要使用配置好余额的测试账号手工验证。

## 10. 后续改进

- 增加用户级每日搜索次数、并发限制和 Token/费用统计。
- 持久化结构化的工具调用与网页来源，而不是只保存在 Markdown 文本中。
- 增加允许/禁止域名配置，优先官方文档和权威来源。
- 当需要可审计摘要、固定排序或供应商故障切换时，抽象 Search Provider 并接入独立搜索 API。
- 增加 Route Handler 集成测试，模拟完整 SSE 搜索事件序列。
- 在 PostgreSQL 和 Docker 部署后验证代理链路不会缓冲搜索状态与文本增量。

## 11. 线上 `pause_turn` 续跑修复（2026-09-07）

### 目标与结果

Render 公网验收时，DeepSeek 已成功执行 `web_search` 并返回搜索结果，但响应以 `stop_reason: "pause_turn"` 暂停。旧循环只检查本地 `tool_use`；当这一轮暂时没有文本时，它会误判成“模型没有生成最终回答”，因此浏览器只能收到通用错误。

修复后，Agent 会把暂停轮的完整 assistant 内容块原样追加到上下文，再在现有最大轮数和 50 秒总超时内请求下一轮。续跑不是一次新的本地工具调用，也不需要应用伪造 `tool_result`。

### 相关文件职责与数据流

- `src/lib/knowledge-agent.ts`：识别 `pause_turn`，保存原始 assistant blocks 并继续有限循环。
- `src/app/api/chat/route.ts`：判断当前请求是否是在续跑已暂停的 Web Search。
- `src/lib/web-search.ts`：续跑时保留同一个服务端工具定义，但把 `tool_choice` 改回 `auto`，避免再次强制搜索。
- `tests/knowledge-agent.test.ts`：验证暂停内容原样进入下一轮，并最终得到文本回答。
- `tests/web-search.test.ts`：验证续跑策略不会再次强制 `web_search`。

```text
DeepSeek 执行服务端 Web Search
  -> 返回 server_tool_use + web_search_tool_result
  -> stop_reason = pause_turn
  -> Agent 原样回传本轮 assistant content
  -> 下一轮保留 Web Search 定义，tool_choice = auto
  -> DeepSeek 继续同一回合并生成最终文本
  -> 追加工具轨迹与网页来源
  -> SSE done + PostgreSQL 持久化
```

### 关键解释与设计取舍

`pause_turn` 是服务端工具的正常停止原因，不是 HTTP 错误。必须保留搜索结果中的加密内容，因此不能只提取标题和 URL 后自己拼一个新 Prompt；原始内容块用于上游续跑，经过白名单处理的标题和 URL 只用于最终页面展示。

续跑仍占用 Agent 轮数，也继续受 50 秒总超时和浏览器取消信号控制。这样可以防止上游反复暂停导致无限循环。续跑必须保留工具定义，但不能沿用“强制联网”的 `tool_choice`，否则可能把恢复动作变成又一次搜索。

### 面试重点与易错点

- 服务端工具由模型提供方执行，本地工具由应用执行，两者的续跑协议不同。
- `pause_turn` 要回传 assistant blocks；本地 `tool_use` 才由应用返回 user 角色的 `tool_result`。
- 不能看到 HTTP 200 和搜索 success 就认为整条回答完成，还要等待最终文本与 SSE `done`。
- 不能为了续跑移除工具定义，也不能再次强制选择工具。
- 原始搜索块只回传给上游，不写入日志；最终只持久化回答、工具轨迹和经过协议校验的来源 URL。

### 验证方法

本地回归新增 1 个 Agent 测试和 1 个策略断言。修复后共 19 个测试通过，ESLint、TypeScript 和 Next.js 16.2.10 生产构建通过。公网还需在包含本修复的提交部署后，再验证强制联网得到网页来源、SSE `done`，并刷新页面确认回答持久化。
