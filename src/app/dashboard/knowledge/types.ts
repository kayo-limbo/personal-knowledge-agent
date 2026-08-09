import type { KnowledgeDoc as PrismaKnowledgeDoc } from "@/generated/prisma/client";

/**
 * 知识来源目前只有三种。
 * 使用联合类型后，TypeScript 会阻止我们意外传入 "unknown" 之类的无效值。
 */
export type KnowledgeSource = "conversation" | "upload" | "manual";

/** 数据库返回的完整知识条目。这里复用 Prisma 生成的类型，避免重复维护字段。 */
export type KnowledgeDoc = PrismaKnowledgeDoc;

/** 新建、编辑表单真正允许用户提交的字段。userId 必须从 Session 获取，不能由前端传入。 */
export interface KnowledgeFormValues {
  title: string;
  content: string;
  summary?: string;
  tags?: string;
  source?: KnowledgeSource;
}

/** 列表页只需要展示这些字段，不必把正文等大字段都传给客户端。 */
export interface KnowledgeListItem {
  id: string;
  title: string;
  summary: string | null;
  tags: string[];
  source: KnowledgeSource | null;
  updatedAt: Date;
}

/** URL 查询参数会被转换成这个对象后再交给 Service 层。 */
export interface KnowledgeFilters {
  query?: string;
  tag?: string;
  source?: KnowledgeSource;
}

/**
 * Server Action 的统一返回格式。
 * 客户端先判断 success，TypeScript 就能知道 data 或 error 哪一个存在。
 */
export type KnowledgeActionResult =
  | { success: true; data: KnowledgeDoc }
  | { success: false; error: string };
