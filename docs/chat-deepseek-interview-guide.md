# Chat 与 DeepSeek 模块：代码、数据流和面试指南

这份文档不是只告诉你“代码在哪”，而是帮助你在面试时说清楚：为什么这样设计、请求如何流动、做过哪些取舍，以及下一步怎样把它发展成真正的知识库 Agent。

## 1. 先用一句话介绍项目

可以这样回答面试官：

> 这是一个基于 Next.js 16 App Router 的个人知识助手。我把认证、会话持久化和大模型调用放在服务端，通过 DeepSeek 官方 Anthropic 兼容接口获得流式响应，再用 SSE 转发给浏览器；前端使用 Zustand 管理会话状态，并用 React Markdown 渲染回答。

当前 Chat 已经完成“普通多轮对话”，但 Knowledge 检索、Tool Calling、Prompt 管理和真正的 Agent 循环还没有接入。不要把现阶段描述成完整 RAG Agent，这一点面试时诚实说明反而更专业。

## 2. 当前架构

```text
浏览器
  ChatWorkspace + Zustand
       |
       | POST /api/chat（JSON）
       v
Next.js Route Handler
  auth -> Zod -> Conversation Service -> Prisma -> SQLite
                         |
                         v
                 DeepSeek Anthropic API
                         |
                         | 流式事件
                         v
Next.js 将事件转换为 SSE（delta / done / error）
       |
       v
浏览器逐帧解析 -> 追加到 assistant 消息 -> React Markdown 渲染
```

这里存在两条不同的数据流：

1. 首次打开页面：Server Component 直接读取数据库，把历史会话作为 props 交给 Client Component。
2. 发送消息：Client Component 调用 Route Handler，通过 SSE 持续读取生成内容。

## 3. 文件职责

### `src/lib/deepseek.ts`

模型基础设施层，只做三件事：

- 使用 `server-only` 防止该模块被 Client Component 引用。
- 从服务端环境变量读取 `DEEPSEEK_API_KEY` 和 `DEEPSEEK_MODEL`。
- 创建指向 `https://api.deepseek.com/anthropic` 的 Anthropic SDK 客户端。

为什么依赖仍叫 `@anthropic-ai/sdk`？因为 DeepSeek 官方兼容 Anthropic Messages 协议。SDK 是协议客户端，不代表请求发往 Anthropic；决定真实提供方的是 `baseURL`、API Key 和模型名。

这也是适配器思想的一个简单例子：下游代码依赖稳定协议，上游供应商可以替换。

### `src/app/api/chat/route.ts`

Chat 的应用编排层，也是最值得重点准备的面试文件：

- 调用 `auth()` 验证用户身份。
- 用 Zod 校验请求，而不是信任浏览器输入。
- 创建或校验当前会话的归属关系。
- 持久化 user 消息，并创建空的 assistant 占位消息。
- 组织 system prompt 和最近的历史上下文。
- 调用 DeepSeek 流式接口。
- 将上游模型事件转换为项目自己的 SSE 事件协议。
- 流正常完成后保存完整 assistant 回答；失败时清理空占位。
- 通过 `AbortSignal` 尽量取消已无客户端消费的上游请求。

Route Handler 使用 Node.js runtime，因为 Prisma 和当前 SDK 都属于服务端依赖。`maxDuration = 60` 是一次请求的运行时间提示，但真正限制还取决于部署平台。

### `src/lib/services/conversation.service.ts`

会话领域服务和数据库访问层：

- `getChatBootstrap`：读取最近 20 个会话及消息，作为首屏数据。
- `getOrCreateConversation`：创建新会话，或同时使用 `conversationId + userId` 验证旧会话归属。
- `createConversationMessage`：写入消息并手动更新会话时间。
- `getModelContext`：只选最近 30 条、最多约 24,000 字符的有效消息，并保证截断后从 user 角色开始。
- `completeAssistantMessage`：在流完成后写入完整回答。
- `removeMessage`：请求失败时清理空 assistant 占位。

为什么不能只按 `conversationId` 查询？因为会产生 IDOR（不安全直接对象引用）漏洞：攻击者猜到别人的会话 ID 后可能读取或追加消息。查询条件同时带上 `userId` 才形成资源级授权。

### `src/lib/validators/chat.ts`

请求边界校验：

- 消息必须经过 `trim` 后非空。
- 单条消息最多 12,000 字符，避免异常大请求消耗内存和 token。
- `conversationId` 可选，新对话不传，继续对话时传入。

TypeScript 类型只在编译期存在，不能阻止外部请求传入恶意 JSON；Zod 才是运行时校验。

### `src/app/dashboard/chat/page.tsx`

Server Component：

- 服务端检查 Session，未登录则重定向。
- 直接调用 service 获取首屏数据。
- 把可序列化数据传给 `ChatWorkspace`。

这种设计避免浏览器首屏再发一次 API 请求，也不会把 Prisma、API Key 等服务端代码打进客户端 bundle。

### `src/app/dashboard/chat/components/ChatWorkspace.tsx`

Chat 的客户端控制器：

- 初始化 Zustand 状态。
- 管理输入框、错误信息和 `AbortController`。
- 使用 `fetch` POST 用户消息。
- 从响应头取得服务端生成的会话和消息 ID。
- 乐观地把 user 消息、assistant 空消息放入本地状态。
- 用 `ReadableStream.getReader()` 读取 SSE，并逐段追加模型文本。
- 停止生成时取消请求。

为什么不用 `EventSource`？原生 `EventSource` 主要用于 GET，不能方便地附带当前 POST 请求体；这里必须发送消息，所以选择 `fetch + ReadableStream` 手动解析 SSE。

`consumeSse` 里的 `buffer` 非常关键：一个网络 chunk 不等于一个 SSE 事件。事件可能被拆成多个 chunk，也可能一个 chunk 包含多个事件，所以必须按照空行边界组帧，不能每次 `reader.read()` 后直接 `JSON.parse`。

### `src/app/store/chat-store.ts`

Zustand 客户端状态层：

- 保存会话列表、当前会话 ID、每个会话的消息和生成状态。
- `appendToMessage` 把每个文本增量追加到指定 assistant 消息。
- `upsertConversation` 把有新消息的会话移到列表顶部。
- `reset` 防止单页应用切换用户后残留前一用户的状态。

数据库是最终事实来源，Zustand 只是当前浏览器页面的交互状态，不能把权限判断放在 Zustand 里。

### 展示组件

- `ConversationSidebar.tsx`：会话选择和新建入口。
- `ChatComposer.tsx`：输入、发送、停止生成和错误提示。
- `ChatMessages.tsx`：消息列表、自动滚动、Markdown 和代码高亮。
- `types.ts`：定义与具体模型供应商无关的领域类型和 SSE 可判别联合类型。

### `prisma/schema.prisma`

与 Chat 直接相关的是：

```text
User 1 ---- n Conversation 1 ---- n Message
```

- Conversation 必须属于一个 User。
- Message 必须属于一个 Conversation。
- 消息保存 `role`、`content` 和创建时间。
- `Conversation.updatedAt` 用来给最近会话排序。

## 4. 一次发送消息的完整数据流

1. 用户在 `ChatComposer` 输入内容，`ChatWorkspace.sendMessage()` 被调用。
2. 前端检查空内容和 `isStreaming`，创建 `AbortController`。
3. 浏览器发送 `POST /api/chat`，正文只有 `conversationId?` 和 `content`，不发送 userId。
4. Route Handler 从服务端 Session 获取 userId，避免客户端冒充其他用户。
5. Zod 校验 JSON。
6. `getDeepSeekClient()` 在任何数据库写入前检查 API Key。
7. service 创建新会话，或者验证旧会话属于当前用户。
8. 数据库先写 user 消息，再创建 assistant 空占位。
9. service 读取受数量和字符预算限制的历史消息。
10. Anthropic SDK 将 Messages 请求发送到 DeepSeek 官方兼容地址。
11. DeepSeek 返回 `content_block_delta/text_delta` 等流式事件。
12. Route Handler 只取文本增量，包装成 `data: {...}\n\n`。
13. 浏览器按 SSE 边界解析 `delta`，Zustand 把文本追加到对应消息。
14. 上游完成后，服务端一次性保存完整 assistant 文本并发送 `done`。
15. 客户端结束 streaming 状态，React Markdown 展示最终内容。

采用“流中增量只写内存，结束后一次写数据库”的原因是避免每个 token 都执行一次数据库 UPDATE。代价是服务器在流中途崩溃时，已经展示给用户但尚未完成的部分不会持久化。

## 5. DeepSeek 接入代码怎么讲

核心配置可以概括为：

```ts
new Anthropic({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com/anthropic",
});
```

模型请求当前还有三个重要控制项：

- `model: deepseek-v4-flash`：默认选择成本和速度更合适的模型。
- `thinking: { type: "disabled" }`：MVP 普通问答关闭思考模式，减少延迟和额外 token。
- `max_tokens: 1024`：限制单次最大输出，防止成本和等待时间失控。

不要把 API Key 放到 `NEXT_PUBLIC_DEEPSEEK_API_KEY`。带 `NEXT_PUBLIC_` 的环境变量会进入浏览器构建产物，任何用户都可能看到并盗用余额。

## 6. 高频面试问题与参考回答

### 为什么需要自己的 `/api/chat`，前端不能直接调用 DeepSeek？

直接调用会暴露 API Key，也绕过登录、限流、资源授权、审计和消息持久化。Route Handler 相当于 BFF，把第三方模型协议封装成项目自己的稳定接口。

### SSE、WebSocket 和普通 HTTP 怎么选？

模型生成主要是服务端单向推送，SSE 基于 HTTP、实现简单、代理支持通常更好。WebSocket 更适合高频双向通信。普通 JSON 必须等完整回答生成完，首字延迟和用户体验较差。

### 为什么这里用 fetch 读取 SSE？

请求需要 POST JSON，而原生 EventSource 不适合这个场景。fetch 可以提交正文，并从 `response.body` 读取流。

### 为什么一个网络 chunk 不能直接当成一个 token 或 SSE 事件？

TCP/HTTP 分块边界与业务消息边界无关。一次 read 可能拿到半个事件或多个事件，因此客户端需要 buffer，再根据 SSE 的空行分隔符拆帧。

### 为什么同时有 Server Component、Route Handler 和 Client Component？

Server Component 适合首屏认证和数据库读取；Route Handler 适合客户端发起的动态流式请求；Client Component 负责输入、状态、停止按钮和浏览器流读取。三者按运行环境分工。

### 如何保证用户只能操作自己的会话？

userId 只从服务端 Session 读取；复用会话时数据库条件同时包含 conversationId 和 userId。不能相信前端传入的 userId。

### TypeScript 已有类型，为什么还要 Zod？

TypeScript 在运行时会被擦除，HTTP 请求可能来自任何客户端。Zod 对真实输入做运行时解析，并能返回明确的 400 错误。

### 为什么先创建 assistant 空消息？

服务端先产生稳定 ID，前端可以把后续增量准确写入同一条消息。完成后再一次性持久化全文，减少数据库写放大。需要配套失败清理和崩溃恢复策略。

### 如何控制上下文和费用？

当前做了消息条数、字符数、单条输入长度和最大输出四层限制，并选用 Flash、关闭思考模式。字符数不是准确 token 数，生产环境应该使用 tokenizer 或供应商返回的 usage 做统计和配额。

### 为什么要把模型类型与 UI 类型分开？

UI 只认识 user/assistant 消息和 delta/done/error，不依赖 DeepSeek 或 Anthropic 的完整事件类型。以后换 OpenAI 接口时只改服务端 adapter，不必重写页面状态。

### 这已经是 Agent 了吗？

严格来说还不是。当前是带持久化的 LLM Chat。Agent 至少还需要模型选择工具、执行工具、把结果回填模型并循环到最终答案；知识库 Agent 还要增加检索、上下文拼装、引用和评估。

### 接入知识库后数据流怎样变化？

可以先做固定 RAG：问题 -> 向量/关键词检索 -> 权限过滤 -> 相关片段 -> system/context -> 模型。再升级为 Tool Calling：模型决定是否调用 `searchKnowledge`，服务端执行并回填 tool result，直到模型给出最终回答。

### 如何防止重复请求产生重复消息？

当前只有页面内的 `isStreaming` 防连点，不能覆盖刷新、重试和多标签页。生产方案应由客户端生成 idempotency key，并在数据库建立唯一约束或请求表，服务端识别重复请求。

## 7. 容易出 Bug 的地方

### 高优先级

1. **密钥错误或泄露**：`.env` 没配置会返回 503；如果误加 `NEXT_PUBLIC_` 则可能泄露。密钥还应定期轮换。
2. **兼容协议不等于完全相同**：DeepSeek 会忽略部分 Anthropic 字段，图片、文档等内容也可能不支持。升级功能前必须查 DeepSeek 兼容表。
3. **数据库不是一个事务**：创建会话、user 消息、assistant 占位是多次写入；中间失败会留下部分数据。正式版应使用事务或明确的消息状态字段。
4. **流中断的一致性**：断网时浏览器可能看过部分文本，但服务端最终删除空占位，刷新后内容消失。可以定期批量保存草稿，或增加 `STREAMING/COMPLETED/FAILED` 状态。
5. **幂等性不足**：浏览器超时后用户重试，第一次请求可能其实仍在服务端运行，导致重复消息和重复计费。
6. **并发请求**：`isStreaming` 只约束当前标签页；多标签页仍能同时向同一会话写入，消息顺序可能混乱。

### 流和部署相关

7. **代理缓冲**：Nginx、CDN 或 Serverless 平台可能缓存响应，导致用户最后一次性看到全文。当前设置了 `X-Accel-Buffering: no` 和 no-cache，但仍需验证部署平台。
8. **运行时间限制**：代码的 60 秒并不保证平台一定允许 60 秒，长答案可能被宿主强制终止。
9. **SSE 解析边界**：必须处理半帧、多帧、UTF-8 多字节字符和非法 JSON。目前 TextDecoder 处理了跨 chunk 字符，buffer 处理了半帧，但未来协议扩展要继续保持兼容。
10. **取消存在竞态**：浏览器 abort、上游结束和 controller.close 可能几乎同时发生，重复 enqueue/close 会抛异常，需要通过压力测试验证。

### 数据和上下文相关

11. **字符数不等于 token**：中文、代码和英文的 token 比例不同，24,000 字符只能作为粗略保护。
12. **上下文截断破坏角色顺序**：截断可能让第一条消息变成 assistant；当前已主动移除开头的 assistant，但更完善的实现应按完整对话轮次截断。
13. **首屏数据逐渐变大**：当前一次读取 20 个会话的全部消息。单个会话很长后，SSR 数据和查询都会变重，应改成会话分页与按需加载消息。
14. **消息角色是 String**：数据库允许写入任意 role。可以改成 Prisma enum，或者确保所有写入口都经过严格校验。
15. **标题只是截取字符串**：可能出现隐私内容、语义不完整或重复标题，后续可异步生成标题，但不要阻塞首次回答。

### 展示和安全相关

16. **Markdown 内容不可信**：当前没有启用 `rehype-raw`，模型输出的原始 HTML 不会直接执行，这是更安全的默认值。以后若允许 HTML，必须做严格消毒以防 XSS。
17. **错误消息泄露内部信息**：不能直接把 SDK 原始异常和堆栈发给浏览器。当前转换成了有限的用户提示，详细异常应只记服务端日志。
18. **没有应用级配额**：登录用户可以持续消耗账户余额。正式部署应增加用户级限流、每日 token 配额、告警和总预算熔断。

## 8. 建议掌握的知识点优先级

### 必须能讲清楚

- Next.js App Router：Server Component、Client Component、Route Handler 的边界。
- Cookie/JWT Session 与服务端认证、资源级授权的区别。
- HTTP 流、SSE 格式、fetch ReadableStream、TextDecoder 和 AbortController。
- LLM 的 system prompt、messages、上下文窗口、输入/输出 token 和流式事件。
- Prisma 一对多关系、事务、索引、分页和 `updatedAt`。
- TypeScript 编译期类型与 Zod 运行时校验的区别。
- Zustand 状态与数据库持久化状态的区别。

### 进阶加分项

- BFF 和供应商适配器模式。
- 幂等键、并发控制、消息状态机与最终一致性。
- 限流、超时、重试退避、熔断和可观测性。
- RAG 的 chunk、embedding、召回、rerank、引用与评估。
- Tool Calling 的请求—执行—结果回填循环，以及工具权限边界。
- Prompt injection：知识库文本也是不可信输入，不能让检索内容覆盖系统规则。

## 9. 面试时可以主动指出的下一步

按优先级建议这样说：

1. 为 Message 增加状态和 token usage，解决流式生成的一致性与成本统计。
2. 增加请求幂等键、用户级限流和预算熔断。
3. 把消息历史改成按会话懒加载和游标分页。
4. 抽象统一的 `LLMProvider` 接口，为模型切换和测试注入 fake provider。
5. 接入 Knowledge 检索和 Tool Calling，并对检索结果做 userId 权限过滤。
6. 增加单元测试、Route Handler 集成测试和断流/重试端到端测试。

这套回答能体现你不仅“调通了一个 API”，还理解安全边界、流式协议、数据一致性和从 Chat 走向 Agent 的工程路径。

## 10. 本地运行检查

在项目根目录创建 `.env`：

```env
DATABASE_URL="file:./dev.db"
AUTH_SECRET="请替换成长随机字符串"
DEEPSEEK_API_KEY="你的 DeepSeek API Key"
DEEPSEEK_MODEL="deepseek-v4-flash"
```

然后执行：

```bash
npm run dev
npm run lint
npx tsc --noEmit
npm run build
```

不提供真实 API Key 时，静态检查和构建仍可运行；真正发送消息时，`/api/chat` 会返回 503 配置错误。
