import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  KNOWLEDGE_IMPORT_MAX_FILE_BYTES,
  KNOWLEDGE_IMPORT_MAX_FILES,
  KnowledgeImportError,
  prepareKnowledgeFiles,
} from "@/lib/knowledge-import";
import { savePreparedKnowledgeFiles } from "@/lib/services/knowledge-import.service";

export const runtime = "nodejs";

const MAX_MULTIPART_BYTES =
  KNOWLEDGE_IMPORT_MAX_FILES * KNOWLEDGE_IMPORT_MAX_FILE_BYTES + 256 * 1024;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  if (session.user.role === "GUEST") {
    return NextResponse.json({ error: "访客没有管理知识库的权限" }, { status: 403 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_MULTIPART_BYTES) {
    return NextResponse.json({ error: "上传内容超过本次导入限制" }, { status: 413 });
  }

  try {
    const formData = await request.formData();
    const files = formData
      .getAll("files")
      .filter((entry): entry is File => entry instanceof File);
    const tagsEntry = formData.get("tags");
    const tags = typeof tagsEntry === "string" ? tagsEntry.trim() : "";
    const prepared = await prepareKnowledgeFiles(files, tags);
    const result = await savePreparedKnowledgeFiles(session.user.id, prepared);
    return NextResponse.json(result, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof KnowledgeImportError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Knowledge file import failed", error);
    return NextResponse.json({ error: "文件导入失败，请稍后重试" }, { status: 500 });
  }
}
