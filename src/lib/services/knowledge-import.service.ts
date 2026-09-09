import "server-only";

import { prisma } from "@/lib/prisma";
import type { PreparedKnowledgeFile } from "@/lib/knowledge-import";

/** 解析全部成功后再一次性落库，避免只导入请求中的一部分文件。 */
export async function savePreparedKnowledgeFiles(
  userId: string,
  files: PreparedKnowledgeFile[]
): Promise<{ fileCount: number; chunkCount: number; characterCount: number }> {
  const rows = files.flatMap((file) =>
    file.chunks.map((chunk) => ({ ...chunk, userId }))
  );

  await prisma.knowledgeDoc.createMany({ data: rows });
  return {
    fileCount: files.length,
    chunkCount: rows.length,
    characterCount: files.reduce((total, file) => total + file.characterCount, 0),
  };
}
