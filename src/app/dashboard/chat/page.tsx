import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { DEEPSEEK_MODEL } from "@/lib/deepseek";
import { getChatBootstrap } from "@/lib/services/conversation.service";
import { ChatWorkspace } from "./components/ChatWorkspace";

/**
 * Page 保持为 Server Component：认证和数据库读取留在服务器，
 * 只有真正需要交互的 ChatWorkspace 才进入浏览器 bundle。
 */
export default async function ChatPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const bootstrap = await getChatBootstrap(session.user.id);
  return <ChatWorkspace bootstrap={bootstrap} model={DEEPSEEK_MODEL} />;
}
