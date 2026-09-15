import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { readEmbeddingConfig } from "@/lib/embedding";
import { getEmbeddingStatus, rebuildKnowledgeEmbeddings } from "@/lib/knowledge-embedding-index";

export const runtime = "nodejs";
export const maxDuration = 60;

async function handle(request: Request, rebuild: boolean) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "未登录" }, { status: 401 });
  if (session.user.role === "GUEST") return Response.json({ error: "访客无权管理知识索引" }, { status: 403 });
  if (rebuild && request.headers.get("origin") !== new URL(request.url).origin) {
    return Response.json({ error: "请求来源无效" }, { status: 403 });
  }
  try {
    const config = readEmbeddingConfig(process.env);
    if (!config) return Response.json({ enabled: false, message: "尚未配置语义检索服务，当前使用文本检索" });
    const status = rebuild
      ? await rebuildKnowledgeEmbeddings(prisma, session.user.id, config, AbortSignal.any([request.signal, AbortSignal.timeout(25_000)]))
      : await getEmbeddingStatus(prisma, session.user.id, config);
    return Response.json({ enabled: true, ...status });
  } catch {
    return Response.json({ error: "语义索引暂不可用，请检查服务配置和数据库迁移；文本检索仍可使用" }, { status: 503 });
  }
}

export function GET(request: Request) { return handle(request, false); }
export function POST(request: Request) { return handle(request, true); }
