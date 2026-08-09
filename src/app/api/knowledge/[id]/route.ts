import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  deleteKnowledge,
  getKnowledgeById,
  updateKnowledge,
} from "@/lib/services/knowledge.service";
import {
  firstValidationError,
  knowledgeUpdateSchema,
} from "@/lib/validators/knowledge";

interface KnowledgeRouteContext {
  // Next.js 16 的动态路由参数是 Promise，使用前必须 await。
  params: Promise<{ id: string }>;
}

async function requireKnowledgeUser() {
  const session = await auth();
  if (!session?.user?.id) return { error: "未登录", status: 401 } as const;
  if (session.user.role === "GUEST") return { error: "没有管理知识库的权限", status: 403 } as const;
  return { userId: session.user.id } as const;
}

export async function GET(_request: Request, context: KnowledgeRouteContext) {
  const identity = await requireKnowledgeUser();
  if ("error" in identity) {
    return NextResponse.json({ error: identity.error }, { status: identity.status });
  }

  const { id } = await context.params;
  const document = await getKnowledgeById(id, identity.userId);
  if (!document) {
    return NextResponse.json({ error: "知识条目不存在" }, { status: 404 });
  }
  return NextResponse.json(document);
}

export async function PUT(request: Request, context: KnowledgeRouteContext) {
  const identity = await requireKnowledgeUser();
  if ("error" in identity) {
    return NextResponse.json({ error: identity.error }, { status: identity.status });
  }

  try {
    const body: unknown = await request.json();
    const parsed = knowledgeUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: firstValidationError(parsed.error) },
        { status: 400 }
      );
    }

    const { id } = await context.params;
    const document = await updateKnowledge(id, identity.userId, parsed.data);
    return NextResponse.json(document);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "更新知识条目失败";
    const status = message.includes("不存在") || message.includes("无权限") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_request: Request, context: KnowledgeRouteContext) {
  const identity = await requireKnowledgeUser();
  if ("error" in identity) {
    return NextResponse.json({ error: identity.error }, { status: identity.status });
  }

  try {
    const { id } = await context.params;
    await deleteKnowledge(id, identity.userId);
    return new Response(null, { status: 204 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "删除知识条目失败";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
