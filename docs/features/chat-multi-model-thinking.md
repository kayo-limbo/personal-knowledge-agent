# Flash/Pro 多模型与思考模式功能讲解

关联功能提交：`06b44fc feat(chat): 增加Flash与Pro模型切换和深度思考模式选择`

## 1. 功能目标与结果

原来的聊天接口固定使用 `deepseek-v4-flash`，并且固定关闭思考模式。这个功能让用户在发送消息前自行选择：

| 模型 | 模式 | 适合场景 |
| --- | --- | --- |
| V4 Flash | 普通 | 日常问答，速度快、成本低 |
| V4 Flash | 深度思考 | 一般分析、代码解释 |
| V4 Pro | 普通 | 更看重回答质量的日常任务 |
| V4 Pro | 深度思考 | 复杂推理、方案设计、疑难问题 |

模型和模式按照“每次请求”生效。用户可以上一条使用 Flash，下一条切换到 Pro，历史上下文仍然以普通 user/assistant 文本传递给新模型。

## 2. 思考模式不等于 Agent

这是最容易混淆的概念。

思考模式只改变一次模型调用的推理配置：

```text
用户问题 -> DeepSeek 投入更多推理计算 -> 最终回答
```

Agent 则必须包含模型与外部工具的循环：

```text
用户问题
  -> 模型决定调用 searchKnowledge
  -> 服务端执行知识库检索
  -> 把工具结果返回模型
  -> 模型决定继续调用工具或生成最终答案
```

因此，这次完成的是 Chat 能力增强。等项目具备工具定义、工具执行、结果回填、最大循环次数和终止条件以后，才能称为知识库 Agent。

## 3. 涉及文件与职责

### `src/lib/deepseek-models.ts`

这是前后端共享的公开配置文件：

- `DEEPSEEK_MODELS`：服务端允许使用的模型白名单。
- `DeepSeekModel`：从白名单自动推导出的 TypeScript 联合类型。
- `DEFAULT_DEEPSEEK_MODEL`：没有指定模型时使用 Flash。
- `DEEPSEEK_MODEL_OPTIONS`：界面下拉框显示的名称和说明。
- `DEEPSEEK_THINKING_MODES`：只允许 `disabled` 和 `enabled`。
- `isDeepSeekModel`：检查环境变量是否属于合法模型。

这个文件不能放 API Key。因为它会被 Client Component 引用，其中的代码和数据可能进入浏览器 bundle。

### `src/lib/deepseek.ts`

这是服务端 DeepSeek 客户端模块：

- 通过 `server-only` 阻止浏览器代码引用。
- 从 `.env` 读取 `DEEPSEEK_API_KEY`。
- 从 `.env` 读取页面初始模型。
- 如果环境变量中的模型不在白名单中，自动回退到 Flash。
- 创建指向 DeepSeek 官方 Anthropic 兼容地址的 SDK 客户端。

这里的 `DEEPSEEK_MODEL` 环境变量只决定页面首次打开时的默认选择，不再强制所有请求使用同一个模型。

### `src/lib/validators/chat.ts`

在原来的消息校验基础上增加：

```ts
model: z.enum(DEEPSEEK_MODELS).default(DEFAULT_DEEPSEEK_MODEL),
thinkingMode: z.enum(DEEPSEEK_THINKING_MODES).default("disabled"),
```

前端下拉框只能提高正常用户的使用体验，不能作为安全措施。攻击者可以绕过页面，直接构造 HTTP 请求，所以 Route Handler 必须再次使用 Zod 白名单校验。

如果接口直接接受任意字符串作为模型名，可能产生以下问题：

- 请求一个不存在的模型，导致接口持续报错。
- 意外使用未来更昂贵的模型。
- 把供应商内部模型名称暴露成不受控制的输入。

### `src/app/dashboard/chat/components/ChatComposer.tsx`

输入区域增加两个原生 `select`：

- 模型：V4 Flash 或 V4 Pro。
- 回答模式：普通或深度思考。

开始生成后选择器会被禁用。否则用户在回答生成过程中切换选项，页面展示的“当前选择”可能与已经发出的请求不一致。

组件没有直接调用 API，只通过 props 把变化通知给 `ChatWorkspace`。这样展示组件不需要知道完整的网络请求过程。

### `src/app/dashboard/chat/components/ChatWorkspace.tsx`

这里是客户端聊天流程的控制器，新增两个状态：

```ts
const [model, setModel] = useState<DeepSeekModel>(initialModel);
const [thinkingMode, setThinkingMode] =
  useState<DeepSeekThinkingMode>("disabled");
```

发送请求时把它们与消息一起交给服务端：

```ts
body: JSON.stringify({
  conversationId,
  content,
  model,
  thinkingMode,
})
```

状态暂时只存在当前浏览器页面中，没有写入 Zustand 全局状态或数据库。这能让第一版保持简单，但刷新页面后会恢复默认选择。

### `src/app/dashboard/chat/page.tsx`

这个 Server Component 从服务端读取默认模型，然后通过 `initialModel` 传给 `ChatWorkspace`。

这样做的好处是 `.env` 仍能控制初始模型，同时 API Key 和其他服务端环境变量不会传入浏览器。传给浏览器的只有公开的模型名称。

### `src/app/api/chat/route.ts`

Route Handler 使用 Zod 解析后的选择，而不是原始请求数据：

```ts
model: parsed.data.model,
thinking: thinkingEnabled
  ? { type: "enabled", budget_tokens: 2048 }
  : { type: "disabled" },
max_tokens: thinkingEnabled ? 4096 : 1024,
```

几个重要取舍：

1. 普通模式限制为 1024 tokens，控制费用和等待时间。
2. 深度思考使用 4096 tokens，为推理和最终回答留出更多空间。
3. DeepSeek 会忽略 Anthropic 格式里的 `budget_tokens`，但 SDK 的 TypeScript 类型要求启用思考时提供它，因此保留兼容值。
4. 流处理只转发 `text_delta`，不展示模型内部思考过程。
5. 响应头返回 `X-Model` 和 `X-Thinking-Mode`，方便以后做日志、调试和用量统计。

## 4. 完整数据流

```text
用户选择模型和模式
  -> ChatComposer 触发 onModelChange/onThinkingModeChange
  -> ChatWorkspace 保存到 React state
  -> 用户发送消息
  -> POST /api/chat
  -> Zod 校验 model 和 thinkingMode 白名单
  -> Route Handler 计算 thinking 与 max_tokens
  -> Anthropic SDK 请求 DeepSeek 官方接口
  -> DeepSeek 返回流式事件
  -> 服务端只转发最终文字 SSE
  -> 浏览器逐段追加到 assistant 消息
  -> 完整回答写入 SQLite
```

模型选择不会改变数据库中的历史上下文格式。无论由 Flash 还是 Pro 生成，历史消息仍然保存成标准的 `user` 和 `assistant` 文本。

## 5. 为什么没有修改数据库

这一版的目标是让选择真正影响当前请求，所以暂时不需要 Prisma 迁移。

它的代价是历史记录不知道每条回答使用了什么配置。后续建议给 `Message` 增加：

```text
model             String?
thinkingEnabled   Boolean?
inputTokens       Int?
outputTokens      Int?
status            MessageStatus
```

增加这些字段后可以实现：

- 在历史消息旁显示 Flash/Pro。
- 统计每个用户的 Token 消耗。
- 分析思考模式是否真的提高了回答质量。
- 区分生成中、已完成和失败的消息。
- 对用户实施每日配额和费用保护。

## 6. 安全重点

### 为什么必须服务端校验模型

浏览器中的 TypeScript 类型和下拉选项都可以被绕过。只有 Route Handler 中的运行时校验能保护真实 API 调用。

### 为什么共享模型文件可以进入客户端

它只包含模型名称、标签和类型，没有 API Key。真正的 Key 只在带 `server-only` 的 `deepseek.ts` 中读取。

### 深度思考会不会修改文件

不会。思考模式只增加模型推理计算。当前 DeepSeek 请求没有文件系统、Shell、Git 或数据库工具，因此模型不能扫描目录或修改代码。

## 7. 容易出现的 Bug

1. **选择没有持久化**：刷新后恢复 `.env` 默认模型和普通模式。
2. **历史记录缺少模型信息**：切换模型后无法从旧消息判断当时使用了哪一种。
3. **费用增长**：Pro 和深度思考都可能增加 Token 消耗，当前还没有用户配额。
4. **长时间空白加载**：思考阶段没有普通文字增量，用户可能只看到加载动画，应考虑增加“正在深入思考”的提示。
5. **回答被截断**：即使上限提高到 4096，复杂问题仍可能达到最大输出长度。
6. **环境变量写错**：非法 `DEEPSEEK_MODEL` 会回退到 Flash，不会导致构建失败；生产环境可以考虑启动时直接报错，避免静默配置错误。
7. **原生 select 的类型断言**：代码假设选项只能来自固定列表；真正的安全仍由服务端 Zod 保证。
8. **模型切换影响风格**：同一会话中切换模型可能让回答风格发生变化，但不会破坏文本上下文。
9. **兼容协议变化**：DeepSeek 只兼容 Anthropic API 的一部分字段，升级 SDK 或加入新内容类型时必须重新查看官方兼容表。

## 8. 面试重点问题

### 为什么把模型列表抽到共享文件？

让前端选择器、TypeScript 类型、服务端 Zod 校验和环境变量检查使用同一事实来源，避免四处写字符串造成不一致。

### 前端已经是联合类型，为什么服务端还要 Zod？

TypeScript 只在编译期有效，HTTP 请求在运行时可能来自任何客户端。Zod 才能校验真实网络输入。

### 为什么不为每个模型创建一个客户端？

两个模型使用相同供应商、API Key、baseURL 和协议，只有请求中的 `model` 不同。复用一个客户端更简单，也避免重复连接配置。

### 思考模式为什么需要更大的 max_tokens？

思考会使用更多生成预算。如果仍限制为很小的值，模型可能在给出完整答案前就达到上限。

### 这个功能为什么还不算 Agent？

它没有工具选择、工具执行和结果回填循环。多模型选择和思考模式只改变一次 LLM 请求的配置。

### 如何继续优化模型选择？

可以增加自动路由：先根据问题长度、任务类型或一个低成本分类器判断难度，普通问题使用 Flash，复杂问题使用 Pro，同时保留用户手动覆盖能力。

## 9. 需要掌握的知识点

- TypeScript `as const` 和数组元素联合类型。
- 类型守卫 `value is DeepSeekModel`。
- Zod `enum` 运行时白名单校验。
- Server Component 向 Client Component 传递可序列化初始值。
- React 受控表单和 `useState`。
- 服务端环境变量与 `NEXT_PUBLIC_` 的安全边界。
- LLM 的模型选择、thinking、最大输出和 Token 成本。
- API 兼容层和供应商适配器思想。
- 为什么内部思考过程与最终回答要分开处理。

## 10. 验证方式

静态验证：

```bash
npm run lint
npx tsc --noEmit
npm run build
```

手工验证建议分别发送四次短问题：

1. Flash 普通模式。
2. Flash 深度思考。
3. Pro 普通模式。
4. Pro 深度思考。

检查内容：

- 选择器在生成过程中是否禁用。
- 四种组合是否都能正常返回。
- 深度思考是否有更长的首字等待时间。
- 点击停止是否能取消请求。
- 刷新后完整回答是否仍然存在。
- DeepSeek 控制台是否出现对应模型的 Token 消耗。

静态检查和构建不会消耗 DeepSeek Token，四种真实请求会产生少量费用。

## 11. 后续改进顺序

1. 持久化每条回答的模型、模式、状态和 Token usage。
2. 增加用户配额、限流和费用告警。
3. 实现只读且按 userId 隔离的 `searchKnowledge`。
4. 再将检索封装成 Tool Calling，形成有限 Agent 循环。
5. 最后增加文件解析、向量检索、联网搜索、MCP 和 Multi-Agent。
