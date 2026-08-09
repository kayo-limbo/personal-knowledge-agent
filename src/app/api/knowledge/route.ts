import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createKnowledge, listKnowledge } from "@/lib/services/knowledge.service";
import {
  firstValidationError,
  knowledgeInputSchema,
  knowledgeSourceSchema,
} from "@/lib/validators/knowledge";

/**
 * API 不能相信浏览器传来的 userId，因此始终从服务端 Session 中取得当前用户。
 * 这个 API 适合将来给移动端或 Tool Calling 使用；网页表单目前使用 Server Action。
 */
async function requireKnowledgeUser() {
  const session = await auth();
  if (!session?.user?.id) return { error: "未登录", status: 401 } as const;
  if (session.user.role === "GUEST") return { error: "没有管理知识库的权限", status: 403 } as const;
  return { userId: session.user.id } as const;
}

export async function GET(request: Request) {
  const identity = await requireKnowledgeUser();
  if ("error" in identity) {
    return NextResponse.json({ error: identity.error }, { status: identity.status });
  }

  const searchParams = new URL(request.url).searchParams;
  const rawPage = Number(searchParams.get("page") ?? "1");
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const parsedSource = knowledgeSourceSchema.safeParse(searchParams.get("source") ?? undefined);

  const result = await listKnowledge({
    userId: identity.userId,
    query: searchParams.get("query") || undefined,
    tag: searchParams.get("tag") || undefined,
    source: parsedSource.success ? parsedSource.data : undefined,
    page,
  });

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const identity = await requireKnowledgeUser();
  if ("error" in identity) {
    return NextResponse.json({ error: identity.error }, { status: identity.status });
  }

  try {
    const body: unknown = await request.json();
    const parsed = knowledgeInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: firstValidationError(parsed.error) },
        { status: 400 }
      );
    }

    const document = await createKnowledge(identity.userId, parsed.data);
    return NextResponse.json(document, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof SyntaxError ? "请求体必须是合法 JSON" : "创建知识条目失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
