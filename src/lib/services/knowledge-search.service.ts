import "server-only";
import { prisma } from "@/lib/prisma";
import { retrieveKnowledge } from "@/lib/knowledge-retrieval";
import { searchKnowledgeSemantic } from "./knowledge-embedding.service";
import { getDeepSeekClient } from "@/lib/deepseek";
import { KNOWLEDGE_EVIDENCE_TIMEOUT_MS, verifyKnowledgeEvidence } from "@/lib/knowledge-evidence";

/** userId 必须来自 Session；业务和评测使用同一条检索管线。 */
export async function searchKnowledge(userId: string, query: string, signal: AbortSignal = AbortSignal.timeout(9_000), evidenceQuery = query) {
  const candidates = (await retrieveKnowledge(prisma, userId, query, () => searchKnowledgeSemantic(userId, query, signal))).hybrid;
  if (!candidates.length) return [];
  return verifyKnowledgeEvidence(getDeepSeekClient(), evidenceQuery, candidates,
    AbortSignal.any([signal, AbortSignal.timeout(KNOWLEDGE_EVIDENCE_TIMEOUT_MS)]));
}
