import "server-only";
import { prisma } from "@/lib/prisma";
import { retrieveKnowledge } from "@/lib/knowledge-retrieval";
import { searchKnowledgeSemantic } from "./knowledge-embedding.service";

/** userId 必须来自 Session；业务和评测使用同一条检索管线。 */
export async function searchKnowledge(userId: string, query: string) {
  return (await retrieveKnowledge(prisma, userId, query, () => searchKnowledgeSemantic(userId, query))).hybrid;
}
