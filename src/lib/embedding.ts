import { createHash } from "node:crypto";
import { z } from "zod";

export const EMBEDDING_DIMENSIONS = 1024;
export const EMBEDDING_CHUNK_SIZE = 1000;
export const EMBEDDING_CHUNK_OVERLAP = 150;
export const EMBEDDING_BATCH_SIZE = 10;

export interface EmbeddingConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  modelKey: string;
  minSimilarity: number;
}

/** 环境变量只由服务端入口传入；没有 Key 时保持原有文本检索。 */
export function readEmbeddingConfig(env: Record<string, string | undefined>): EmbeddingConfig | null {
  const apiKey = env.EMBEDDING_API_KEY?.trim();
  if (!apiKey) return null;
  const baseUrl = env.EMBEDDING_BASE_URL?.trim().replace(/\/+$/, "");
  if (!baseUrl) throw new Error("请配置 EMBEDDING_BASE_URL");
  const url = new URL(baseUrl);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new Error("EMBEDDING_BASE_URL 必须是无凭据和查询参数的 HTTPS 地址");
  }
  const model = env.EMBEDDING_MODEL?.trim() || "text-embedding-v4";
  const minSimilarity = Number(env.EMBEDDING_MIN_SIMILARITY ?? "0.35");
  if (!Number.isFinite(minSimilarity) || minSimilarity < 0 || minSimilarity > 1) {
    throw new Error("EMBEDDING_MIN_SIMILARITY 必须在 0 到 1 之间");
  }
  // 切换服务、模型或分块策略后必须重建；同维度不代表同一个语义空间。
  const modelKey = createHash("sha256")
    .update(JSON.stringify([baseUrl, model, EMBEDDING_DIMENSIONS, "chunk-1000-150-v1"]))
    .digest("hex");
  return { apiKey, baseUrl, model, modelKey, minSimilarity };
}

export interface EmbeddingDocument {
  title: string;
  content: string;
  summary: string | null;
  tags: string | null;
}

export function embeddingDocumentHash(doc: EmbeddingDocument): string {
  return createHash("sha256").update(JSON.stringify([doc.title, doc.content, doc.summary, doc.tags])).digest("hex");
}

/** 以 Unicode 码点分块，避免把 emoji 的代理对切开；引用阶段仍单独执行字符预算。 */
export function createEmbeddingChunks(doc: EmbeddingDocument): { content: string; input: string }[] {
  const characters = Array.from(doc.content.trim());
  const chunks: { content: string; input: string }[] = [];
  for (let start = 0; start < characters.length; start += EMBEDDING_CHUNK_SIZE - EMBEDDING_CHUNK_OVERLAP) {
    const content = characters.slice(start, start + EMBEDDING_CHUNK_SIZE).join("");
    chunks.push({ content, input: `标题：${doc.title}\n标签：${doc.tags ?? ""}\n摘要：${doc.summary ?? ""}\n正文：${content}` });
    if (start + EMBEDDING_CHUNK_SIZE >= characters.length) break;
  }
  return chunks;
}

const responseSchema = z.object({
  data: z.array(z.object({
    index: z.number().int().nonnegative(),
    embedding: z.array(z.number().finite()).length(EMBEDDING_DIMENSIONS),
  })),
});

export function parseEmbeddingResponse(payload: unknown, count: number): number[][] {
  const { data } = responseSchema.parse(payload);
  const sorted = [...data].sort((a, b) => a.index - b.index);
  if (sorted.length !== count || sorted.some((row, index) => row.index !== index || !row.embedding.some((value) => value !== 0))) {
    throw new Error("Embedding 响应数量、索引或向量无效");
  }
  return sorted.map((row) => row.embedding);
}

export async function requestEmbeddings(
  config: EmbeddingConfig,
  inputs: string[],
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<number[][]> {
  if (!inputs.length || inputs.length > EMBEDDING_BATCH_SIZE || inputs.some((input) => !input.trim() || input.length > 8000)) {
    throw new Error("Embedding 输入超出批次或字符限制");
  }
  signal.throwIfAborted();
  const response = await fetcher(`${config.baseUrl}/embeddings`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: config.model, input: inputs, dimensions: EMBEDDING_DIMENSIONS, encoding_format: "float" }),
    signal,
    redirect: "error",
    cache: "no-store",
  });
  // 不把供应商原始错误（可能回显正文/凭据）写入日志或传给浏览器。
  if (!response.ok) throw new Error(`Embedding 请求失败（HTTP ${response.status}）`);
  return parseEmbeddingResponse(await response.json(), inputs.length);
}
