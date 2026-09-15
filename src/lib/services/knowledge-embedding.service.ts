import "server-only";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { readEmbeddingConfig } from "@/lib/embedding";
import { rebuildKnowledgeEmbeddings, searchKnowledgeVectors } from "@/lib/knowledge-embedding-index";

export function scheduleKnowledgeEmbedding(userId: string, documentIds: string[]) {
  if (!process.env.EMBEDDING_API_KEY?.trim() || !documentIds.length) return;
  after(async () => {
    try {
      const config = readEmbeddingConfig(process.env);
      if (config) await rebuildKnowledgeEmbeddings(prisma, userId, config, AbortSignal.timeout(25_000), documentIds);
    } catch {
      console.warn("知识向量索引未完成，可在知识库页面重试");
    }
  });
}

export async function searchKnowledgeSemantic(userId: string, query: string) {
  try {
    const config = readEmbeddingConfig(process.env);
    if (!config || !query.trim()) return [];
    // 给已有 5 秒工具预算留出文本检索与数据库时间。
    return await searchKnowledgeVectors(prisma, userId, query, config, AbortSignal.timeout(2_500));
  } catch {
    console.warn("语义检索不可用，本次使用文本检索");
    return [];
  }
}
