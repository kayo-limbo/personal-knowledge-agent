# `searchKnowledge` Tool Calling Agent 循环

## 1. 目标与结果

固定知识检索阶段的流程是：每次用户提问，服务端都先搜索 Knowledge，再调用 DeepSeek。它能让知识影响回答，但模型没有选择权，所以严格来说仍是“带固定 RAG 的 LLM Chat”。

这个功能把流程升级为：

```text
用户提问
  -> DeepSeek 判断是否需要 searchKnowledge
  -> 返回 tool_use
  -> 服务端校验工具名和参数
  -> 按 Session userId 搜索 Knowledge
  -> 返回 tool_result
  -> DeepSeek 继续判断或生成最终回答
  -> 达到最终回答或安全上限后停止
```

现在项目已经具备 Agent 的核心闭环：

- 模型自主选择是否使用工具。
- 工具只能由服务端执行。
- 工具参数经过 Zod 运行时校验。
- 工具结果会回填模型。
- 支持多轮工具调用。
- 有最大轮数、工具次数、工具超时、总超时和取消。
- 普通模式与思考模式共用同一循环。
- SSE 实时展示工具状态与文本回答。
- 工具调用轨迹和知识来源随最终回答持久化。

因此从这一阶段开始，项目可以准确称为“个人知识库 Agent”，但它目前只有一个本地知识检索工具，还不是通用 Agent 平台。

## 2. 相关文件职责

### `src/lib/knowledge-agent.ts`

Agent 的核心领域层，负责：

- 定义 `searchKnowledge` Tool Schema。
- 定义工具参数的 Zod Schema。
- 运行有限 Agent 循环。
- 识别 `tool_use`。
- 校验工具名和参数。
- 执行工具并构造 `tool_result`。
- 处理最大轮数、工具次数、工具超时和取消。
- 跨多次检索去重来源并重新分配引用编号。
- 生成可持久化的 Markdown 工具轨迹。

这个模块通过依赖注入接收“请求模型”和“执行搜索”函数，因此核心循环可以用假模型和假工具做单元测试，不需要消耗 DeepSeek Token。

### `src/app/api/chat/route.ts`

负责把 Agent 核心接到真实运行环境：

- 从 Session 取得 `userId`。
- 创建 DeepSeek Anthropic SDK 流。
- 把完整 assistant content blocks 回填下一轮。
- 只把普通文本与工具状态通过 SSE 发给浏览器。
- 将 50 秒总超时与浏览器取消转换成 AbortSignal。
- 成功后保存回答、工具轨迹和知识来源。

### `src/lib/knowledge-search.ts`

新增 `buildKnowledgeToolResult`，把已有检索结果转换成不可信工具数据：

- 保留引用编号、标题、片段、标签和来源。
- 转义可能伪造上下文边界的字符。
- 明确告诉模型只能把结果当作事实材料。
- 空结果时要求模型不要编造知识引用。

### `src/lib/services/knowledge-search.service.ts`

继续复用固定检索阶段的数据库实现。Agent 只负责决定“何时搜、搜什么”，真正的数据库权限边界仍在服务端：

```ts
searchKnowledge(session.user.id, query)
```

模型无法传入或覆盖 `userId`。

### `src/app/dashboard/chat/types.ts`

扩展 SSE 联合类型，增加工具事件；`ToolCall` 增加运行状态和结果字段。

### `src/app/store/chat-store.ts`

增加 `upsertToolCall`，让同一个工具调用从 `running` 更新为 `success` 或 `error`，而不是创建重复卡片。

### `ChatWorkspace.tsx` 与 `ChatMessages.tsx`

- `ChatWorkspace` 解析 SSE 工具事件并更新 Zustand。
- `ChatMessages` 展示正在检索、命中数量或失败原因。

### `tests/knowledge-agent.test.ts`

使用假模型与假搜索函数测试循环，不访问 DeepSeek，也不读写数据库。

## 3. 完整数据流

```text
ChatWorkspace
  -> POST /api/chat
  -> auth() + Zod 请求校验
  -> 创建 user / assistant 消息
  -> getModelContext
  -> runKnowledgeAgent
       -> 第 1 轮 DeepSeek messages.stream
            tools: [searchKnowledge]
            tool_choice: auto
       -> 模型返回 tool_use
       -> Zod 校验 input.query
       -> searchKnowledge(Session userId, query)
       -> tool_result 回填为 user content block
       -> 第 2 轮 DeepSeek messages.stream
       -> 最终 text answer
  -> SSE: tool running / success / error
  -> SSE: text delta
  -> 追加 Agent 工具调用 Markdown
  -> 追加知识库来源 Markdown
  -> 一次性保存 assistant 完整内容
```

如果模型认为问题是通用常识，可以第一轮直接返回最终文本，不调用工具。

## 4. Tool Schema 为什么不能包含 `userId`

工具暴露给模型的输入只有：

```json
{
  "query": "部署方案"
}
```

不允许出现：

```json
{
  "query": "部署方案",
  "userId": "另一个用户"
}
```

原因是模型不是安全边界。Tool Schema 只是在告诉模型怎样生成参数，模型仍可能输出多余字段、错误类型或恶意值。

真正的安全流程是：

```text
模型 input
  -> Zod strict() 拒绝未知字段
  -> 只提取 query
  -> Session userId 由 Route Handler 注入
  -> Prisma where 同时包含 userId 与关键词
```

即使模型生成了 `userId`，Zod 也会拒绝这次调用，并把“工具参数不合法”作为错误结果回填模型，不会执行数据库查询。

## 5. 为什么同时需要 JSON Schema 和 Zod

JSON Schema 面向模型，用来描述工具希望收到的输入：

```ts
input_schema: {
  type: "object",
  properties: {
    query: { type: "string" },
  },
  required: ["query"],
  additionalProperties: false,
}
```

Zod 面向服务端安全边界：

```ts
z.object({
  query: z.string().trim().min(1).max(500),
}).strict()
```

不能因为 Tool Schema 已经声明类型，就跳过 Zod。模型输出和浏览器输入一样，都是运行时不可信数据。

当前没有开启 DeepSeek strict mode，因为官方 strict mode 需要 Beta base URL。验收版继续使用稳定的 Anthropic base URL，并在服务端自行校验参数。

## 6. 有限 Agent 循环怎样工作

核心循环最多运行 4 个模型轮次：

```text
round 1: 模型选择 searchKnowledge
round 2: 模型可以再次细化检索
round 3: 模型可以执行最后一次工具调用
round 4: 必须产生最终回答，否则终止
```

另外限制总工具调用次数为 3。轮数和工具次数是不同维度：一次模型响应可能包含多个并行 `tool_use`，因此不能只限制轮数。

伪代码如下：

```ts
for (round = 1; round <= MAX_AGENT_ROUNDS; round++) {
  const response = await requestModel(messages, tools)
  const toolUses = response.content.filter(isToolUse)

  if (toolUses.length === 0) return finalAnswer
  if (达到轮数或工具次数上限) throw limitError

  messages.push(fullAssistantBlocks)
  messages.push({ role: "user", content: toolResults })
}
```

“有限”是生产 Agent 的重要特征。没有终止条件的循环会造成请求挂死、Token 费用失控和数据库重复查询。

## 7. 思考模式为什么必须保存完整 blocks

DeepSeek 官方说明：带 `tools` 的思考模式请求，在后续工具轮次中必须回传完整推理内容，否则可能返回 HTTP 400。

Anthropic 格式的响应不是只有文本，还可能包含：

```text
thinking block
text block
tool_use block
```

Agent 循环会把整个 `message.content` 作为 assistant 消息回填下一轮：

```ts
messages.push({ role: "assistant", content: turn.content })
```

但浏览器只接收 `text_delta`。`thinking` 和工具参数 JSON 留在服务端，不会展示给用户。

当前完整 blocks 只在单次 Agent 请求的循环内保留。跨用户回合仍然只持久化最终可见回答，这是为了暂不扩大 Message 数据模型；后续若需要完整审计，可以增加结构化 Agent turn 表。

## 8. 工具结果为什么作为 `user` content block 回填

Anthropic Messages 协议要求：模型的 `tool_use` 属于 assistant 消息，执行结果通过下一条 user 消息中的 `tool_result` 返回：

```ts
messages.push({
  role: "user",
  content: [
    {
      type: "tool_result",
      tool_use_id: toolUse.id,
      content: serializedKnowledge,
    },
  ],
})
```

`tool_use_id` 必须与模型给出的 id 一致，否则模型无法知道结果对应哪一次调用。

DeepSeek Anthropic 兼容表说明 `is_error` 会被忽略，所以错误结果不能只依赖布尔字段。代码会同时把可理解的错误文本写入 `content`，让模型仍能生成降级回答。

## 9. 超时与取消

当前保护参数：

```text
Next.js Route 最大时长：60 秒
Agent 总时长：50 秒
单次 searchKnowledge：5 秒
最大模型轮次：4
最大工具调用：3
```

### 工具超时

单次搜索超过 5 秒时，会产生一个错误 `tool_result`，模型可以告诉用户检索暂时失败，而不是整个聊天请求立即崩溃。

Prisma 查询本身目前不能被真正取消；`Promise` 超时只是不再等待它。迁移 PostgreSQL 后可以进一步评估数据库 statement timeout。

### 总超时

Route Handler 创建独立 AbortController。50 秒到达后使用 `AgentTotalTimeoutError` 中止当前 DeepSeek 流，并返回可理解错误。

### 用户停止生成

浏览器取消 fetch 后：

```text
ReadableStream.cancel
  -> agentController.abort
  -> upstream.abort
  -> 不再 enqueue / close 已取消的浏览器流
```

这样既停止 Agent 循环，也停止上游模型请求，避免继续计费。

## 10. SSE 工具状态怎样展示

新增 SSE 事件：

```ts
{ type: "tool", toolCall: { status: "running", ... } }
{ type: "tool", toolCall: { status: "success", result: { resultCount: 3 }, ... } }
```

Zustand 使用工具调用 id 做 upsert：

```text
tool-123 running
  -> tool-123 success
```

界面不会出现两张重复卡片。用户可以看到 Agent 何时开始检索、查询了什么以及命中多少条。

## 11. 工具轨迹与引用怎样持久化

当前 Message 表只有 `content`，没有 JSON 工具轨迹字段。为了避免这一阶段同时引入数据库迁移，成功回答末尾会追加：

```markdown
---

**Agent 工具调用**

- `searchKnowledge` “部署方案”：命中 2 条

---

**知识库来源**

- [知识库 1] 暑期部署计划
```

实时工具卡片主要改善生成过程体验；Markdown 轨迹保证刷新或重新登录后仍能看到本次调用。

下一版可以给 Message 增加结构化 `toolCalls` 和 `citations` 字段，实现独立样式、审计、统计和点击来源跳转。

## 12. 多次检索的引用编号为什么要全局去重

每次 `searchKnowledge` 原本都会从 `[知识库 1]` 开始编号。如果 Agent 连续搜索两次，就可能出现两个不同文档都叫 `[知识库 1]`。

Agent 循环维护一个按知识 id 去重的 Map：

```text
第一次：A -> [知识库 1]
第二次：A -> 复用 [知识库 1]
        B -> [知识库 2]
```

模型收到的 tool result 和最终来源列表使用同一套编号，避免引用歧义。

## 13. 设计取舍

### 继续使用 Anthropic SDK

现有 SSE 已经基于 Anthropic SDK，DeepSeek 官方兼容表也明确支持 Anthropic 格式的 tools、tool_use 和 tool_result。继续复用可以减少迁移风险。

### 工具循环放在独立领域模块

如果所有逻辑都写在 `route.ts`，认证、SSE、模型协议、工具分发和终止条件会混在一起，难以测试。独立模块让循环可以通过依赖注入测试。

### 工具错误回填模型，而不是全部终止

参数错误、未知工具和单工具超时会作为错误结果回填，让模型生成降级说明。总超时、用户取消、轮数或工具次数超限才终止整个请求。

### 顺序执行多个工具调用

DeepSeek 可能一次返回多个工具调用。当前顺序执行，便于控制数据库压力和工具次数。后续增加互不依赖的联网工具后，再评估受控并行。

## 14. 面试重点

### 问：为什么现在可以叫 Agent？

因为已经存在“模型选择工具、服务端执行、结果回填、继续推理、有限终止”的闭环。此前固定检索只是服务端预处理。

### 问：模型能不能搜索别人的知识？

不能。Tool Schema 没有 `userId`，Zod strict 拒绝多余字段，数据库查询使用服务端 Session 的 `userId`。

### 问：为什么最大轮数和工具次数都要限制？

一次响应可能并行产生多个工具调用，只限制轮数仍可能瞬间执行大量工具；只限制工具次数又无法阻止模型反复空转。

### 问：为什么不展示 thinking？

内部思考不是面向用户的稳定答案，可能包含未验证假设，也会增加信息噪音。服务端保留协议需要的 blocks，客户端只展示最终文本和可审计的工具状态。

### 问：工具超时后为什么还继续调用模型？

工具失败也是一种结果。把错误回填后，模型可以明确告诉用户暂时无法检索，而不是让用户只看到通用 HTTP 500。

### 问：Tool Schema 能代替服务端校验吗？

不能。Schema 是给模型的生成提示，不是安全保证。工具执行前必须进行运行时校验和权限注入。

## 15. 易错点

1. 把 `userId` 放进 Tool Schema，让模型决定数据权限。
2. 相信模型一定输出合法 JSON，不做 Zod 校验。
3. 收到 `tool_use` 后直接执行任意工具名。
4. 忘记回传完整 assistant blocks，导致思考模式工具轮返回 400。
5. `tool_result.tool_use_id` 与 `tool_use.id` 不一致。
6. 只限制轮数，不限制一次响应中的多个工具调用。
7. 工具失败后直接抛 HTTP 500，无法让模型做降级回答。
8. 用户停止生成时只停止浏览器读取，没有取消上游模型请求。
9. 浏览器流取消后仍调用 `controller.enqueue` 或 `close`。
10. 多次检索都从 `[知识库 1]` 编号，造成引用冲突。
11. 工具状态只保存在客户端，刷新后完全不可追溯。
12. 把工具结果视为可信 Prompt，忽略知识内容中的 Prompt Injection。

## 16. 自动验证

运行：

```powershell
npm.cmd test
npm.cmd run lint
.\node_modules\.bin\tsc.cmd --noEmit
npm.cmd run build
```

当前共 14 项测试，其中 Agent 测试覆盖：

1. 空查询被拒绝。
2. 模型伪造 `userId` 被拒绝。
3. `tool_use -> tool_result -> final answer` 正常闭环。
4. 错误参数不执行数据库搜索。
5. 工具超时后模型生成降级回答。
6. 多次检索对相同来源复用引用编号。
7. 总超时或取消保留 AbortSignal 原因。
8. 单轮工具数量超过总次数上限时不执行工具。
9. 达到最大轮数后终止。

测试使用假模型，不调用 DeepSeek，不消耗 Token。

## 17. 手工验证清单

真实端到端验证会消耗少量 DeepSeek Token。

### 模型自主选择

1. 提问“1 + 1 等于多少”，确认没有出现知识库工具卡片。
2. 提问“我的暑期部署方案是什么”，确认出现 `searchKnowledge` 工具卡片。
3. 确认工具卡片从“正在检索”更新为“命中 n 条”。

### 引用与持久化

1. 确认回答正文使用 `[知识库 1]`。
2. 确认末尾显示 Agent 工具调用和知识库来源。
3. 刷新页面，确认 Markdown 调用轨迹和来源仍存在。

### 普通与思考模式

1. 普通模式提问个人知识问题，确认工具闭环完成。
2. 深度思考模式重复提问，确认没有因缺少 thinking blocks 返回 HTTP 400。
3. 确认页面没有展示模型内部思考内容。

### 空结果与错误

1. 提问一个个人知识库中不存在的内容。
2. 确认工具显示命中 0 条。
3. 确认模型明确说明没有相关个人资料，不伪造引用。

### 取消

1. 在模型生成或工具循环过程中点击停止。
2. 确认页面提示已停止生成。
3. 确认服务器没有继续输出 SSE 文本。

### 用户隔离

1. 用户 A 创建带独有文本的知识。
2. 用户 B 用相同关键词提问。
3. 确认用户 B 的工具结果和来源不包含用户 A 数据。

## 18. 后续改进

下一阶段按路线图增加受控 `webSearch`：

1. 复用当前工具注册、参数校验、超时、错误回填和循环框架。
2. 让模型在个人知识与实时网页信息之间选择工具。
3. 限制每次联网次数、结果数、字符数和费用。
4. 网页结果继续视为不可信输入，防御 Prompt Injection。
5. 返回标题、URL、摘要和发布时间，并生成可点击来源。

如果时间紧张，联网搜索应降级为用户手动开启且每次最多一次，不能牺牲当前已经稳定的 Knowledge Agent 闭环。

## 19. 官方协议参考

- DeepSeek Anthropic API 兼容说明：<https://api-docs.deepseek.com/guides/anthropic_api/>
- DeepSeek Tool Calls：<https://api-docs.deepseek.com/guides/tool_calls/>
- DeepSeek Thinking Mode：<https://api-docs.deepseek.com/guides/thinking_mode/>
