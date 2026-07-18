import { prisma } from "@/lib/prisma";
import type { KnowledgeDoc } from "@/app/dashboard/knowledge/types"
import type {
  KnowledgeFormValues,
  KnowledgeListItem,
  KnowledgeFilters,
  KnowledgeSource,
} from "@/app/dashboard/knowledge/types";
import { KNOWLEDGE_PAGE_SIZE } from "@/app/dashboard/knowledge/constants";

// ---- tags 映射: 存储是逗号字符串, 展示/表单是数组或原始字符串 ----
function parseTags(tags: string | null): string[] {
  if (!tags) return [];
  return tags.split(",").map((t) => t.trim()).filter(Boolean);
}

// 把表单传来的原始逗号字符串清洗成规范存储格式
function normalizeTagsInput(raw?: string): string | null {
  if (!raw) return null;
  const cleaned = raw.split(",").map((t) => t.trim()).filter(Boolean);
  return cleaned.length > 0 ? cleaned.join(",") : null;
}

function toListItem(doc: KnowledgeDoc): KnowledgeListItem {
  return {
    id: doc.id,
    title: doc.title,
    summary: doc.summary,
    tags: parseTags(doc.tags),
    source: (doc.source as KnowledgeSource | null) ?? null,
    updatedAt: doc.updatedAt,
  };
}

interface ListParams extends KnowledgeFilters {
  userId: string;
  page?: number;
}

export async function listKnowledge({
  userId,
  query,
  tag,
  source,
  page = 1,
}: ListParams) {
  const where = {
    userId,
    ...(query
      ? { OR: [{ title: { contains: query } }, { content: { contains: query } }] }
      : {}),
    ...(source ? { source } : {}),
    ...(tag ? { tags: { contains: tag } } : {}), // V1: 字符串字段做简单包含匹配
  };

  const [docs, total] = await Promise.all([
    prisma.knowledgeDoc.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * KNOWLEDGE_PAGE_SIZE,
      take: KNOWLEDGE_PAGE_SIZE,
    }),
    prisma.knowledgeDoc.count({ where }),
  ]);

  return { items: docs.map(toListItem), total, page, pageSize: KNOWLEDGE_PAGE_SIZE };
}

export async function getKnowledgeById(id: string, userId: string): Promise<KnowledgeDoc | null> {
  const doc = await prisma.knowledgeDoc.findUnique({ where: { id } });
  if (!doc || doc.userId !== userId) return null; // 非本人数据直接当不存在,不暴露"存在但无权限"
  return doc;
}

export async function createKnowledge(userId: string, input: KnowledgeFormValues): Promise<KnowledgeDoc> {
  return prisma.knowledgeDoc.create({
    data: {
      title: input.title,
      content: input.content,
      summary: input.summary || null,
      tags: normalizeTagsInput(input.tags),
      source: input.source ?? "manual",
      userId,
    },
  });
}

export async function updateKnowledge(
  id: string,
  userId: string,
  input: Partial<KnowledgeFormValues>
): Promise<KnowledgeDoc> {
  const existing = await getKnowledgeById(id, userId);
  if (!existing) throw new Error("知识条目不存在或无权限");

  return prisma.knowledgeDoc.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.content !== undefined ? { content: input.content } : {}),
      ...(input.summary !== undefined ? { summary: input.summary || null } : {}),
      ...(input.tags !== undefined ? { tags: normalizeTagsInput(input.tags) } : {}),
      ...(input.source !== undefined ? { source: input.source } : {}),
    },
  });
}

export async function deleteKnowledge(id: string, userId: string): Promise<void> {
  const existing = await getKnowledgeById(id, userId);
  if (!existing) throw new Error("知识条目不存在或无权限");
  await prisma.knowledgeDoc.delete({ where: { id } });
}