import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDeepSeekClient } from "@/lib/deepseek";
import {
  buildKnowledgeContextPrompt,
  buildKnowledgeSourcesMarkdown,
} from "@/lib/knowledge-search";
import {
  completeAssistantMessage,
  createConversationMessage,
  getModelContext,
  getOrCreateConversation,
  removeMessage,
} from "@/lib/services/conversation.service";
import { searchKnowledge } from "@/lib/services/knowledge-search.service";
import { sendChatSchema } from "@/lib/validators/chat";
import type { ChatStreamEvent } from "@/app/dashboard/chat/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM_PROMPT = `你是一个个人知识助手。请使用清晰、准确、友好的中文回答。
遇到不确定的信息要明确说明，不要编造来源。代码示例应尽量简洁，并解释关键设计。`;

function sseFrame(event: ChatStreamEvent): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
}

function publicDeepSeekError(error: unknown): string {
  const status =
    typeof error === "object" && error !== null && "status" in error
      ? (error as { status?: unknown }).status
      : undefined;

  if (status === 401) return "DeepSeek API Key 无效，请检查 .env 配置";
  if (status === 402) return "DeepSeek API 余额不足，请检查 DeepSeek 开放平台的账户余额";
  if (status === 429) return "DeepSeek 请求过于频繁，请稍后再试";

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes("credit") || message.includes("billing") || message.includes("balance")) {
      return "DeepSeek API 余额不足，请检查 DeepSeek 开放平台的账户余额";
    }
    if (message.includes("authentication") || message.includes("api_key")) {
      return "DeepSeek API Key 无效，请检查 .env 配置";
    }
    if (message.includes("rate")) return "DeepSeek 请求过于频繁，请稍后再试";
  }
  return "DeepSeek 暂时无法回复，请稍后再试";
}

/**
 * POST /api/chat
 *
 * 1. 认证和校验请求；2. 把用户消息写入数据库；3. 调用 DeepSeek；
 * 4. 用 SSE 把文本逐段发给浏览器；5. 完成后保存 DeepSeek 的完整回答。
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体必须是合法 JSON" }, { status: 400 });
  }

  const parsed = sendChatSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "消息格式不正确" },
      { status: 400 }
    );
  }

  // 在写入数据库前检查 Key，避免配置错误时留下空的会话记录。
  let deepSeek;
  try {
    deepSeek = getDeepSeekClient();
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "DeepSeek 配置不完整" },
      { status: 503 }
    );
  }

  let knowledgeResults;
  try {
    // 固定检索只使用服务端 Session 的 userId，浏览器无法指定要搜索谁的知识库。
    knowledgeResults = await searchKnowledge(session.user.id, parsed.data.content);
  } catch (error: unknown) {
    console.error("searchKnowledge failed", error);
    return NextResponse.json({ error: "知识库检索失败，请稍后再试" }, { status: 500 });
  }

  try {
    const knowledgePrompt = buildKnowledgeContextPrompt(knowledgeResults);
    const sourcesMarkdown = buildKnowledgeSourcesMarkdown(knowledgeResults);
    const conversation = await getOrCreateConversation(
      session.user.id,
      parsed.data.conversationId,
      parsed.data.content
    );
    const userMessage = await createConversationMessage(
      conversation.id,
      "user",
      parsed.data.content
    );
    // 先创建空的 assistant 消息，流结束后再一次性写入完整内容。
    const assistantMessage = await createConversationMessage(conversation.id, "assistant", "");
    const context = await getModelContext(conversation.id);
    const thinkingEnabled = parsed.data.thinkingMode === "enabled";

    let upstream: ReturnType<typeof deepSeek.messages.stream> | undefined;
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let fullText = "";

        try {
          upstream = deepSeek.messages.stream(
            {
              model: parsed.data.model,
              // DeepSeek 会忽略 budget_tokens，但 Anthropic SDK 的 enabled 类型要求提供该字段。
              thinking: thinkingEnabled
                ? { type: "enabled", budget_tokens: 2048 }
                : { type: "disabled" },
              // 思考会占用更多输出空间；普通模式继续使用更低上限控制成本。
              max_tokens: thinkingEnabled ? 4096 : 1024,
              system: `${SYSTEM_PROMPT}\n\n${knowledgePrompt}`,
              messages: context,
            },
            { signal: request.signal }
          );

          // 不把模型的内部思考过程展示给用户，只转发最终回答的文字增量。
          for await (const event of upstream) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              fullText += event.delta.text;
              controller.enqueue(sseFrame({ type: "delta", text: event.delta.text }));
            }
          }

          if (!fullText.trim()) throw new Error("DeepSeek 返回了空内容");
          if (sourcesMarkdown) {
            fullText += sourcesMarkdown;
            controller.enqueue(sseFrame({ type: "delta", text: sourcesMarkdown }));
          }
          await completeAssistantMessage(assistantMessage.id, fullText);
          controller.enqueue(sseFrame({ type: "done" }));
        } catch (error: unknown) {
          // 请求失败时删除空占位，用户下次打开历史记录不会看到一条空消息。
          await removeMessage(assistantMessage.id);
          if (!request.signal.aborted) {
            controller.enqueue(sseFrame({ type: "error", message: publicDeepSeekError(error) }));
          }
        } finally {
          // 流被浏览器取消后 controller 已关闭，不能再次 close。
          if (!request.signal.aborted) controller.close();
        }
      },
      cancel() {
        // 用户离开页面或主动中断请求时，同时取消上游 DeepSeek 请求，避免继续计费。
        upstream?.abort();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
        "X-Conversation-Id": conversation.id,
        "X-Conversation-Title": encodeURIComponent(conversation.title),
        "X-User-Message-Id": userMessage.id,
        "X-Assistant-Message-Id": assistantMessage.id,
        "X-Model": parsed.data.model,
        "X-Thinking-Mode": parsed.data.thinkingMode,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "创建会话失败";
    const status = message.includes("不存在") || message.includes("无权限") ? 404 : 500;
    const publicMessage = status === 404 ? message : "创建会话失败，请稍后再试";
    return NextResponse.json({ error: publicMessage }, { status });
  }
}
