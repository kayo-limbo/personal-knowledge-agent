import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { DEEPSEEK_DEFAULT_MODEL } from "@/lib/deepseek";
import { getChatBootstrap } from "@/lib/services/conversation.service";
import { ChatWorkspace } from "./components/ChatWorkspace";
import { listChatPrompts } from "@/lib/services/prompt.service";

/**
 * Page 保持为 Server Component：认证和数据库读取留在服务器，
 * 只有真正需要交互的 ChatWorkspace 才进入浏览器 bundle。
 */
interface ChatPageProps {
  searchParams: Promise<{ conversation?: string }>;
}

export default async function ChatPage({ searchParams }: ChatPageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { conversation } = await searchParams;
  const bootstrap = await getChatBootstrap(session.user.id, conversation);
  const prompts = session.user.role === "GUEST" ? [] : await listChatPrompts(session.user.id);
  const initialConversationId = bootstrap.conversations.some((item) => item.id === conversation)
    ? conversation
    : undefined;
  return (
    <ChatWorkspace
      bootstrap={bootstrap}
      prompts={prompts}
      initialModel={DEEPSEEK_DEFAULT_MODEL}
      initialConversationId={initialConversationId}
    />
  );
}
