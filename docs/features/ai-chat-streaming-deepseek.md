# AI 流式对话与 DeepSeek API 模块讲解

关联功能提交：

- `1bc5dca feat(chat): 接入DeepSeek官方API，实现SSE流式对话、历史上下文和会话持久化`
- `06b44fc feat(chat): 增加Flash与Pro模型切换和深度思考模式选择`

这份文档讲解完整 AI 对话模块。阅读目标不是记住某几行代码，而是能够从用户点击发送开始，解释数据怎样经过浏览器、Next.js、数据库和 DeepSeek，最后逐段显示并持久化。

多模型选择的细节可以配合阅读 [`chat-multi-model-thinking.md`](chat-multi-model-thinking.md)。

## 1. 完成了什么

当前 Chat 模块已经支持：

- 登录用户才能访问聊天页和聊天接口。
- 新建会话和选择最近会话。
- 多轮上下文。
- DeepSeek V4 Flash/Pro 选择。
- 普通模式和深度思考模式。
- POST 请求下的 SSE 流式回答。
- 停止生成。
- Markdown、列表、引用和代码高亮。
- Conversation 和 Message 持久化。
- 刷新页面后恢复历史记录。
- API Key、模型名、输入长度和资源权限校验。

当前还不是完整 Agent，因为尚未接入 `searchKnowledge`、Tool Calling 和工具循环。它的准确定位是“带认证和持久化的多模型流式 LLM Chat”。

## 2. 总体架构

```text
浏览器
  ├── ChatComposer：输入、模型、模式、发送、停止
  ├── ChatWorkspace：请求编排和 SSE 解析
  ├── Zustand：会话与消息状态
  └── ChatMessages：Markdown 展示
          |
          | POST /api/chat
          | { conversationId?, content, model, thinkingMode }
          v
Next.js Route Handler
  ├── auth()：身份认证
  ├── Zod：运行时输入校验
  ├── Conversation Service：权限、上下文、持久化
  └── DeepSeek Client：调用官方 Anthropic 兼容接口
          |
          | content_block_delta / text_delta
          v
项目 SSE 协议
  ├── delta：文本增量
  ├── done：生成完成
  └── error：可公开错误
          |
          v
浏览器逐帧解析并追加文本
```

这里有两个不同的“流”：

1. **DeepSeek 上游流**：DeepSeek 按 Anthropic 事件格式返回很多事件类型。
2. **项目下游 SSE**：Route Handler 只挑选最终回答的文字，转换成项目自己的 `delta/done/error`。

这种转换把供应商协议隔离在服务端。未来改用 OpenAI 风格接口时，浏览器不需要理解新的供应商事件。

## 3. 目录与文件职责

```text
src/app/dashboard/chat/
├── page.tsx                         # 服务端认证和首屏历史数据
├── types.ts                        # Chat 领域类型和 SSE 事件类型
└── components/
    ├── ChatWorkspace.tsx           # 客户端总控制器
    ├── ChatComposer.tsx            # 输入、模型、模式、发送和停止
    ├── ChatMessages.tsx            # 消息与 Markdown 展示
    └── ConversationSidebar.tsx     # 最近会话与新对话

src/app/api/chat/route.ts           # Chat HTTP/SSE 编排层
src/app/store/chat-store.ts         # Zustand 客户端状态
src/lib/deepseek.ts                 # DeepSeek 服务端客户端
src/lib/deepseek-models.ts          # 可公开的模型白名单和类型
src/lib/validators/chat.ts          # 请求运行时校验
src/lib/services/conversation.service.ts
                                      # 会话数据库业务逻辑
prisma/schema.prisma                # Conversation/Message 数据模型
```

## 4. 数据库模型

Chat 使用以下关系：

```text
User 1 ---- n Conversation 1 ---- n Message
```

### Conversation

- `id`：会话唯一标识。
- `title`：当前由第一条问题截取生成。
- `createdAt`：创建时间。
- `updatedAt`：最近消息时间，用于最近会话排序。
- `userId`：会话所属用户，是资源权限检查的关键。

### Message

- `id`：消息唯一标识。
- `role`：当前用 String 保存 `user/assistant/system`。
- `content`：完整消息文本。
- `conversationId`：所属会话。
- `createdAt`：消息创建时间。

数据库是历史记录的最终事实来源，Zustand 只是浏览器当前页面的临时交互状态。

## 5. 首次打开聊天页的数据流

入口是 `src/app/dashboard/chat/page.tsx`。

```ts
const session = await auth();
if (!session?.user?.id) redirect("/login");

const bootstrap = await getChatBootstrap(session.user.id);
return <ChatWorkspace bootstrap={bootstrap} initialModel={DEEPSEEK_DEFAULT_MODEL} />;
```

完整流程：

```text
浏览器请求 /dashboard/chat
  -> ChatPage Server Component
  -> auth() 读取服务端 Session
  -> getChatBootstrap(userId)
  -> Prisma 查询当前用户最近 20 个会话
  -> Date 转成可序列化 ISO 字符串
  -> 数据作为 props 传给 ChatWorkspace
  -> ChatWorkspace 初始化 Zustand
```

### 为什么 page.tsx 保持 Server Component

- 可以直接调用 `auth()` 和 Prisma service。
- API Key、数据库客户端不会进入浏览器 bundle。
- 首屏不需要浏览器额外请求一次历史 API。
- 传给 Client Component 的数据已经是可序列化普通对象。

### 为什么 Date 要转成字符串

数据库返回的是 JavaScript `Date`，而 Client Component props 应保持可序列化。Service 使用 `toISOString()` 转成稳定的字符串，客户端需要显示时再创建 Date。

## 6. Chat 领域类型

`src/app/dashboard/chat/types.ts` 定义 UI 和接口共享的领域类型。

### ChatMessage

```ts
interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  isStreaming?: boolean;
}
```

`isStreaming` 只负责前端打字状态，不写数据库。数据库关心业务数据，浏览器关心交互状态，两者不必完全相同。

### ChatStreamEvent

```ts
type ChatStreamEvent =
  | { type: "delta"; text: string }
  | { type: "done" }
  | { type: "error"; message: string };
```

这是可判别联合类型。客户端先判断 `event.type`，TypeScript 就能知道当前事件拥有哪些字段。

浏览器不直接依赖 Anthropic SDK 的事件类型，这降低了更换模型供应商的成本。

## 7. Zustand 状态层

`src/app/store/chat-store.ts` 保存：

```text
conversations              会话列表
activeConversationId       当前会话
messagesByConversation     每个会话的消息
isStreaming                是否正在生成
```

消息按会话 id 分组：

```ts
Record<string, ChatMessage[]>
```

相比把所有消息放在一个数组里，这种结构切换会话时不需要反复筛选整个数组。

### upsertConversation

新会话插入列表开头；旧会话有新消息时也移到开头，形成“最近使用”排序。

### appendToMessage

每收到一个 SSE 文本增量，只修改指定 assistant 消息：

```ts
m.id === messageId ? { ...m, content: m.content + delta } : m
```

它不会把增量直接写入数据库。否则模型每返回一个小片段就执行一次 UPDATE，会产生大量数据库写入。

### reset

Zustand 是模块级全局状态。在单页应用里切换账号或重新进入页面时，如果不清理，可能短暂看到上一个用户的状态。因此 ChatWorkspace 初始化时先 `reset()`，再装载服务端数据。

## 8. ChatWorkspace：客户端请求总控制器

`ChatWorkspace.tsx` 是客户端最核心的文件，负责连接 UI、状态和网络请求。

### 本地状态

```text
input           输入框文本
error           当前错误
model           Flash 或 Pro
thinkingMode    普通或深度思考
abortRef        当前请求的 AbortController
```

### sendMessage 的完整步骤

1. `trim` 输入，阻止空消息。
2. 检查 `isStreaming`，防止页面内重复发送。
3. 创建 `AbortController`。
4. 清空输入框，显示生成状态。
5. POST `/api/chat`。
6. 检查 HTTP 状态。
7. 从响应头读取服务端生成的会话和消息 id。
8. 在 Zustand 添加 user 消息和空 assistant 消息。
9. 读取响应流。
10. 收到 `delta` 时追加文本。
11. 收到 `error` 时显示错误。
12. 最终关闭 streaming 状态。

发送的请求体：

```json
{
  "conversationId": "已有会话时才传",
  "content": "用户问题",
  "model": "deepseek-v4-flash",
  "thinkingMode": "disabled"
}
```

请求体不包含 `userId`。身份必须由服务端 Session 决定，不能信任浏览器声称自己是谁。

### 为什么先从响应头取得 id

Conversation 和 Message id 由数据库生成。客户端必须拿到真实 id，才能：

- 把 SSE 增量追加到正确消息。
- 后续复用正确会话。
- 避免前端临时 id 与数据库 id 不一致。

响应头包含：

```text
X-Conversation-Id
X-Conversation-Title
X-User-Message-Id
X-Assistant-Message-Id
X-Model
X-Thinking-Mode
```

## 9. 为什么 POST SSE 不使用 EventSource

浏览器原生 `EventSource` 适合 GET 长连接，不方便携带当前消息 JSON。

Chat 必须提交：

- 会话 id。
- 用户消息。
- 模型。
- 思考模式。

因此代码使用：

```text
fetch POST
  + response.body
  + ReadableStream reader
  + TextDecoder
```

这仍然是 SSE 格式，只是由 fetch 手动读取。

## 10. SSE 帧解析为什么需要 buffer

服务端发送一帧：

```text
data: {"type":"delta","text":"你好"}

```

SSE 使用两个换行表示一帧结束。但一次 `reader.read()` 得到的是网络 chunk，不是业务事件。

可能出现：

```text
第一次 read：data: {"type":"del
第二次 read：ta","text":"你好"}\n\n
```

也可能一次 read 得到多个事件。所以 `consumeSse` 必须：

1. 用 `TextDecoder` 正确处理跨 chunk 的 UTF-8 字节。
2. 把新文本追加到 `buffer`。
3. 查找 `\n\n` 边界。
4. 只解析完整帧。
5. 把剩余半帧留给下一次 read。

如果每次 `reader.read()` 后直接 `JSON.parse`，真实网络环境下会随机出现 JSON 解析失败。

## 11. ChatComposer：输入与操作区

职责包括：

- 受控 textarea。
- Enter 发送、Shift + Enter 换行。
- 12,000 字符前端限制。
- Flash/Pro 选择。
- 普通/深度思考选择。
- 发送和停止按钮切换。
- 展示可访问的错误区域。

选择器在生成时禁用，避免已经发出的请求使用旧配置，但页面又显示新配置。

前端 `maxLength` 只是体验优化。攻击者可以直接调用 API，所以服务端 Zod 仍必须重复校验。

## 12. ChatMessages 与 ConversationSidebar

### ChatMessages

- 区分 user 和 assistant 布局。
- 空消息且 `isStreaming` 时显示跳动圆点。
- 使用 `react-markdown` 渲染模型回答。
- 使用 `remark-gfm` 支持表格、任务列表等 GFM。
- 使用 `rehype-highlight` 高亮代码。
- 消息变化后滚动到底部。

当前没有启用 `rehype-raw`，模型输出的原始 HTML 不会直接当成页面 HTML 执行，这比允许任意 HTML 更安全。

### ConversationSidebar

- 显示最近会话。
- 选择历史会话。
- 新建空白会话状态。
- 生成期间禁用切换，避免一个流的增量写到另一个会话 UI。

当前侧边栏还没有删除、重命名和分页功能。

## 13. DeepSeek 模型公共配置

`src/lib/deepseek-models.ts` 可以被浏览器和服务器共同引用，因为它不包含任何秘密。

```ts
export const DEEPSEEK_MODELS = [
  "deepseek-v4-flash",
  "deepseek-v4-pro",
] as const;
```

`as const` 让 TypeScript 把数组元素推导为字面量，而不是普通 string，从而得到：

```ts
type DeepSeekModel =
  | "deepseek-v4-flash"
  | "deepseek-v4-pro";
```

同一份白名单用于：

- UI 下拉选项。
- TypeScript 类型。
- 环境变量检查。
- Zod 服务端校验。

这样可以避免前端支持 Pro、后端却忘记允许 Pro 的配置漂移。

## 14. DeepSeek 服务端客户端

`src/lib/deepseek.ts` 顶部包含：

```ts
import "server-only";
```

如果 Client Component 意外导入这个模块，Next.js 会在构建阶段报错，避免 API Key 相关代码进入客户端依赖树。

客户端创建代码：

```ts
return new Anthropic({
  apiKey,
  baseURL: "https://api.deepseek.com/anthropic",
});
```

### 为什么包名还是 Anthropic

`@anthropic-ai/sdk` 是协议客户端。DeepSeek 官方提供 Anthropic Messages 兼容接口，所以改变以下三项后，请求实际发往 DeepSeek：

```text
baseURL  -> DeepSeek 官方地址
apiKey   -> DeepSeek Key
model    -> deepseek-v4-flash/pro
```

它不代表仍然调用 Claude。

### 环境变量

真实 `.env`：

```env
DEEPSEEK_API_KEY="真实 Key"
DEEPSEEK_MODEL="deepseek-v4-flash"
```

`.env.example` 只能放占位符，不能放真实 Key。Key 不能添加 `NEXT_PUBLIC_` 前缀。

`DEEPSEEK_MODEL` 只控制页面初始模型。每次请求的模型仍由用户选择并经过服务端白名单校验。

## 15. Zod 请求校验

`sendChatSchema` 校验：

```text
conversationId   可选、非空字符串
content          trim 后非空、最多 12000 字符
model            只能是 Flash/Pro
thinkingMode     只能是 enabled/disabled
```

TypeScript 不能代替 Zod：

- TypeScript 类型只存在于开发和编译阶段。
- HTTP 请求可能来自浏览器控制台、脚本或攻击者。
- `request.json()` 的真实类型是 unknown。
- Zod 才能在运行时拒绝非法输入并返回 400。

## 16. `/api/chat` 服务端编排

Route Handler 是整个对话模块的应用层入口。

### 第一步：认证

```ts
const session = await auth();
if (!session?.user?.id) return 401;
```

Proxy 可以提前保护路由，但 Route Handler 自己仍要认证。安全不能只依赖页面是否隐藏入口。

### 第二步：解析与校验

- 非法 JSON 返回 400。
- Zod 不通过返回 400 和第一条可理解错误。

### 第三步：提前检查 DeepSeek 配置

在写数据库前调用 `getDeepSeekClient()`。如果 Key 缺失，直接返回 503，避免留下没有意义的新会话和空消息。

### 第四步：创建或验证会话

```ts
getOrCreateConversation(
  session.user.id,
  conversationId,
  content
)
```

已有会话查询同时使用：

```text
conversationId + userId
```

这防止 IDOR：攻击者即使猜到别人的 conversationId，也不能向其中写入消息。

### 第五步：写入消息占位

顺序是：

```text
保存 user 消息
  -> 创建 content="" 的 assistant 消息
  -> 生成完成后更新 assistant 完整内容
```

空 assistant 消息提供稳定数据库 id，浏览器可以用这个 id 接收所有增量。

### 第六步：准备历史上下文

`getModelContext`：

- 只读取 user/assistant。
- 忽略空占位。
- 最多 30 条。
- 最多约 24,000 字符。
- 从新到旧优先保留最新消息。
- 最后恢复时间正序。
- 删除截断后开头的 assistant，保证从 user 开始。

限制上下文可以控制延迟和费用。但字符数不等于 token 数，这是 MVP 的粗略保护。

### 第七步：调用 DeepSeek

普通模式：

```text
thinking.type = disabled
max_tokens = 1024
```

深度思考：

```text
thinking.type = enabled
budget_tokens = 2048（SDK 类型兼容值）
max_tokens = 4096
```

system prompt 规定：

- 使用清晰中文。
- 不确定时说明。
- 不编造来源。
- 代码示例解释设计。

当前 system prompt 没有包含 Knowledge 检索结果，也没有声明任何工具，所以模型无法访问项目知识库或互联网。

### 第八步：转换上游事件

DeepSeek 兼容流有很多事件。项目只处理：

```text
content_block_delta
  + text_delta
```

内部 thinking 增量不会展示。每个文本增量：

1. 追加到服务端 `fullText`。
2. 包装为项目 `delta` SSE。
3. 立刻发送浏览器。

### 第九步：完成持久化

流正常结束后：

```text
completeAssistantMessage(fullText)
  -> 发送 done
  -> 关闭 SSE
```

服务端不是每个 token 都更新数据库，而是在完成后一次写入全文。这减少写放大，但服务器中途崩溃时，已经显示的部分文本可能不会保存。

### 第十步：失败清理

如果上游失败：

- 删除空 assistant 占位。
- 未被用户主动取消时发送公开 error 事件。
- 不把原始堆栈或内部异常直接发送浏览器。

## 17. 错误处理

`publicDeepSeekError` 将上游错误转换成用户可以理解的提示：

| 情况 | HTTP/特征 | 用户提示 |
| --- | --- | --- |
| Key 无效 | 401 | 检查 `.env` |
| 余额不足 | 402/balance | 检查开放平台余额 |
| 请求过快 | 429/rate | 稍后再试 |
| 其他错误 | 其他 | DeepSeek 暂时无法回复 |

原始错误应该记录在服务端日志中，但不能直接返回给浏览器，因为其中可能包含供应商响应、内部实现或敏感信息。

## 18. 停止生成的数据流

用户点击停止：

```text
ChatComposer onStop
  -> ChatWorkspace.stopGenerating
  -> AbortController.abort()
  -> fetch 被取消
  -> 服务端 request.signal 变为 aborted
  -> 上游 DeepSeek 请求取消
  -> 避免继续生成和计费
```

Route Handler 的 ReadableStream 还定义了 `cancel()`，在浏览器停止消费下游流时调用 `upstream.abort()`。

取消是分布式竞态过程：浏览器、Next.js 和 DeepSeek 的状态变化不一定完全同步，因此正式版本还需要消息状态和更强的中断测试。

## 19. 为什么现在还不是 Agent

当前模型只收到：

```text
system prompt
+ 历史对话
+ 当前问题
```

它没有：

- Knowledge 查询工具。
- 联网搜索工具。
- 文件系统工具。
- Shell 工具。
- 工具结果回填循环。

因此 DeepSeek 不能读取项目文件、修改代码、查询 Knowledge 或自动联网。

下一阶段的关键变化是：

```text
模型返回 tool_use
  -> 服务端识别工具名和参数
  -> 执行 searchKnowledge
  -> 返回 tool_result
  -> 再次调用模型
  -> 直到最终回答或达到最大轮数
```

## 20. 当前设计取舍

### 选择 SSE，而不是 WebSocket

模型回答主要是服务端向浏览器单向发送文本。SSE 基于 HTTP、实现简单、调试方便，适合这个场景。WebSocket 更适合高频双向实时通信。

### 选择 Server Component 首屏加载

减少一次客户端 API 往返，并让认证和数据库读取留在服务端。

### 选择 Zustand

ChatWorkspace、消息列表和侧边栏共享状态，使用 Zustand 比层层传递所有消息操作更清晰。它也比为这个规模引入更重的数据状态框架简单。

### 流结束后一次保存

减少数据库写入。代价是中途崩溃时部分回答丢失，后续用消息状态和定期草稿保存改进。

### 字符预算代替精确 token

实现成本低，适合 MVP。缺点是中文、英文和代码的 token 比例不同，无法精确计费。

## 21. 容易出现的 Bug

### 数据一致性

1. 创建 Conversation、user Message 和 assistant Message 是多次数据库操作，中间失败会留下部分数据。
2. 流中断时浏览器看过部分回答，但数据库可能没有保存。
3. SSE error 在前端追加为提示文本，但服务端已经删除 assistant，占位状态与刷新后历史可能不一致。
4. 请求重试没有幂等键，可能重复保存消息和重复扣费。

### 并发

5. `isStreaming` 只能阻止当前页面重复发送，多标签页仍能同时写入同一会话。
6. 生成期间切换会话被禁用，但异常情况下仍需确认增量不会写错会话。
7. abort、上游结束和 controller.close 可能同时发生，存在关闭流竞态。

### 上下文与费用

8. 字符数不是 token 数，成本保护只是估算。
9. 按 30 条截断可能切断完整问答轮次；当前只修复了 assistant 开头问题。
10. 深度思考和 Pro 会增加成本，但 Message 没有保存 token usage。
11. 历史会话一次读取其全部消息，长会话会让首屏数据变大。

### 部署

12. Nginx、CDN 或负载均衡缓冲会让 SSE 最后一次性显示。
13. 部署平台最大执行时间可能截断长回答。
14. 多实例部署时内存状态、Next.js 缓存和 Server Action 密钥需要协调。

### 安全

15. 真实 Key 放进 `.env.example` 或 `NEXT_PUBLIC_` 会泄露。
16. 只检查 conversationId、不检查 userId 会产生越权漏洞。
17. 未来启用原始 HTML Markdown 可能引入 XSS。
18. 没有用户限流时，登录用户可以消耗大量 API 余额。

## 22. 调试排查表

| 现象 | 优先检查 |
| --- | --- |
| 点击发送立即 401 | Session、Cookie、Proxy、`auth()` |
| 返回 503 | `.env` 是否有 `DEEPSEEK_API_KEY`，是否重启 dev server |
| Key 无效 | Key 是否粘贴完整、是否已经撤销 |
| 余额不足 | DeepSeek 开放平台余额与用量 |
| 页面最后一次性出现回答 | Nginx/CDN 缓冲、`X-Accel-Buffering` |
| 回答一直空白 | 上游是否只有 thinking 事件、max_tokens、服务端日志 |
| JSON.parse 随机失败 | SSE buffer 是否按 `\n\n` 拆帧 |
| 历史出现空消息 | 占位清理、服务器中途退出、bootstrap 空内容过滤 |
| 刷新后回答消失 | 流是否完整结束、assistant UPDATE 是否成功 |
| 切换会话越权 | 查询是否同时包含 conversationId 和 userId |
| 对话越来越贵 | 上下文条数、字符预算、思考模式、模型选择 |

## 23. 高频面试问题与参考回答

### 为什么不让浏览器直接调用 DeepSeek？

会暴露 API Key，也无法统一完成认证、权限、限流、消息持久化和供应商错误转换。`/api/chat` 是面向前端的 BFF 层。

### 为什么 Route Handler 和页面都要认证？

页面认证负责用户体验，接口认证负责真正的安全边界。攻击者不需要经过页面就能直接请求 API。

### 为什么用 fetch 读取 SSE，而不是 EventSource？

因为发送聊天消息需要 POST JSON，EventSource 主要面向 GET；fetch 既能提交请求体，也能读取 Response Stream。

### 为什么网络 chunk 不能直接 JSON.parse？

网络分块与 SSE 业务边界无关，一个事件可能被拆成多块，也可能一块包含多个事件，所以必须缓冲并按空行分帧。

### 为什么先创建空 assistant 消息？

提前获得稳定数据库 id，前端可以把所有增量准确追加到同一条消息；结束时一次写入全文，避免每个 token 更新数据库。

### 如何防止访问他人会话？

userId 只来自服务端 Session，查询已有会话时同时使用 `conversationId + userId`。隐藏侧边栏入口不是权限控制。

### TypeScript 已经定义类型，为什么还用 Zod？

TypeScript 在运行时被擦除，HTTP 输入可能来自任何客户端。Zod 负责验证真实 unknown 数据。

### SDK 是 Anthropic，为什么实际调用 DeepSeek？

SDK 只是 Anthropic Messages 协议客户端，`baseURL` 指向 DeepSeek，Key 和 model 也都是 DeepSeek，所以请求实际发送给 DeepSeek 官方接口。

### 如何控制费用？

限制单条输入、上下文消息数、上下文字符数和最大输出；默认 Flash 普通模式。生产版还要记录 usage、增加用户配额、限流和总预算熔断。

### 为什么思考模式不是 Agent？

思考只是一次模型调用投入更多推理。Agent 必须让模型选择工具、服务端执行工具、回填结果并有限循环。

### 如果部署后流式输出失效怎么办？

先确认服务端本地是否逐段输出，再逐层检查 Nginx、负载均衡和 CDN 是否缓冲，保证整条链路支持 chunked/HTTP 流。

### 如何迁移到其他模型供应商？

保留浏览器的 `delta/done/error` 协议，实现新的服务端 Provider Adapter，把新供应商事件转换成相同下游事件；UI 和 Zustand 不需要理解上游差异。

### 当前一致性最薄弱的地方是什么？

Conversation、user 消息和 assistant 占位不是事务；流中回答只在结束时保存；请求没有幂等键。可以通过事务、消息状态、requestId 和定期草稿保存改进。

## 24. 建议学习顺序

第一遍只理解主链路：

1. `prisma/schema.prisma`
2. `chat/page.tsx`
3. `ChatWorkspace.tsx`
4. `api/chat/route.ts`
5. `conversation.service.ts`

第二遍理解前端细节：

1. `types.ts`
2. `chat-store.ts`
3. `ChatComposer.tsx`
4. `ChatMessages.tsx`
5. `ConversationSidebar.tsx`

第三遍理解模型和安全：

1. `deepseek-models.ts`
2. `deepseek.ts`
3. `validators/chat.ts`
4. `auth()` 与 conversationId + userId 权限检查

每一遍都尝试不用看文档画出数据流图。如果画不出来，说明还停留在记文件名，没有理解模块协作。

## 25. 自测问题

学习完后应能独立回答：

1. 页面首屏历史为什么不通过客户端 API 获取？
2. API Key 为什么不会进入浏览器？
3. `server-only` 解决什么问题？
4. 为什么模型白名单前后端共享，但 Key 模块不能共享？
5. 一次用户消息在数据库里产生了哪些写操作？
6. 为什么创建空 assistant 消息？
7. 为什么不能把每次 `reader.read()` 当成一个 SSE 事件？
8. 浏览器点击停止后，请求怎样传递到 DeepSeek？
9. 为什么必须使用 conversationId + userId 查询？
10. 为什么普通模式和思考模式使用不同 max_tokens？
11. DeepSeek SDK 事件为什么要转换成项目事件？
12. 当前项目为什么还不是 Agent？
13. Nginx 为什么可能破坏 SSE？
14. 当前实现在哪些情况下会出现数据库和页面不一致？
15. 如果换成另一个模型供应商，哪些文件必须改，哪些不需要改？

## 26. 验证清单

静态检查：

```bash
npm run lint
npx tsc --noEmit
npm run build
```

手工检查：

1. 未登录访问聊天页是否跳到登录页。
2. Flash 普通模式是否能流式回答。
3. Pro 普通模式是否能流式回答。
4. Flash/Pro 深度思考是否能给出最终回答。
5. 生成时选择器和会话切换是否禁用。
6. 点击停止是否结束生成。
7. 刷新后完整消息是否存在。
8. 新问题是否能够使用上一轮上下文。
9. 非法模型名是否返回 400。
10. 空消息、超长消息是否被拒绝。
11. 退出登录后 `/api/chat` 是否返回 401。
12. DeepSeek Key 错误和余额不足是否显示可理解提示。

真实模型请求会消耗少量 Token，lint、类型检查和构建不会消耗 DeepSeek Token。

## 27. 下一步怎样演进

按照暑期验收规划，Chat 模块学习完成后的默认下一步不是立刻做复杂部署，而是：

1. 固定 `searchKnowledge` 检索。
2. 将知识片段注入上下文并显示引用。
3. 再升级成 DeepSeek Tool Calling Agent。
4. 复用工具循环增加联网搜索。
5. 核心 Agent 闭环稳定后迁移 PostgreSQL，并完成最小 Docker 部署。

这样可以先完成项目最有辨识度的功能，再投入部署学习时间。

## 28. 编辑器类型飘红的排查记录

如果 `ChatWorkspace.tsx` 对 `ChatBootstrap`、`ChatStreamEvent` 或由它们推导出来的变量连续报错，先运行项目自己的 TypeScript 编译器：

```powershell
.\node_modules\.bin\tsc.cmd --noEmit
```

本项目曾在 `ChatWorkspace.tsx` 第 8、72、86、141 行附近连续飘红。运行 TypeScript 检查后发现，这不是四处独立的组件错误，而是共享类型契约被删减引发的连锁错误：

- `chat/types.ts` 缺少 `ChatBootstrap`、`ChatStreamEvent` 和 `ChatConversation.createdAt`。
- `chat-store.ts` 缺少 `upsertConversation` 的类型声明与实现。

补回共享契约后，`Object.entries` 可以推导出 `ChatMessage[]`，会话对象也重新拥有完整时间字段，组件中的后续错误会一起消失。这个案例说明：同一文件突然出现多处相关红线时，应先检查最上游的 import 和领域类型，不要逐行使用类型断言掩盖症状。

为降低这类问题，Chat 类型现在遵循两个约定：

1. 所有 `import type` 放在类型文件顶部，再声明和导出领域类型。
2. 跨目录引用统一使用 `@/app/dashboard/chat/types`，避免相对路径层级变化或编辑器缓存造成解析不一致。

修复后应再次运行命令行检查。如果命令行已经为 0，但编辑器没有立即恢复，可以在 VS Code 命令面板执行 `TypeScript: Restart TS Server`，并确认编辑器使用工作区内的 TypeScript 版本。不要通过增加 `any` 或删除类型来隐藏红线，因为那会失去真正的类型保护。
