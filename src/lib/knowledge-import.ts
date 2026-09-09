export const KNOWLEDGE_IMPORT_MAX_FILES = 3;
export const KNOWLEDGE_IMPORT_MAX_FILE_BYTES = 2 * 1024 * 1024;
export const KNOWLEDGE_IMPORT_MAX_TEXT_CHARACTERS = 80_000;
export const KNOWLEDGE_IMPORT_CHUNK_CHARACTERS = 6_000;
export const KNOWLEDGE_IMPORT_MAX_CHUNKS_PER_FILE = 20;

const ALLOWED_EXTENSIONS = new Set([".pdf", ".txt", ".md"]);
const TEXT_MIME_TYPES = new Set([
  "",
  "application/octet-stream",
  "text/markdown",
  "text/plain",
  "text/x-markdown",
]);
const PDF_MIME_TYPES = new Set(["", "application/octet-stream", "application/pdf"]);

export interface ImportFileLike {
  name: string;
  size: number;
  type: string;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface ParsedImportSection {
  text: string;
  page?: number;
}

export interface KnowledgeImportChunk {
  title: string;
  content: string;
  summary: string;
  tags: string;
  source: "upload";
}

export interface PreparedKnowledgeFile {
  fileName: string;
  characterCount: number;
  chunks: KnowledgeImportChunk[];
}

export class KnowledgeImportError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "KnowledgeImportError";
    this.status = status;
  }
}

function cleanFileName(value: string): string {
  const baseName = value.split(/[\\/]/u).at(-1) ?? "未命名文件";
  const cleaned = baseName.replace(/[\u0000-\u001f\u007f]/gu, "").trim();
  return (cleaned || "未命名文件").slice(0, 160);
}

function fileExtension(fileName: string): string {
  const dotIndex = fileName.lastIndexOf(".");
  return dotIndex >= 0 ? fileName.slice(dotIndex).toLocaleLowerCase() : "";
}

function normalizeText(value: string): string {
  return value
    .replace(/^\uFEFF/u, "")
    .replace(/\r\n?/gu, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu, "")
    .replace(/[ \t]+\n/gu, "\n")
    .replace(/\n{4,}/gu, "\n\n\n")
    .trim();
}

function splitOversizedText(value: string): string[] {
  const parts: string[] = [];
  let remaining = value.trim();

  while (remaining.length > KNOWLEDGE_IMPORT_CHUNK_CHARACTERS) {
    const minimumBoundary = Math.floor(KNOWLEDGE_IMPORT_CHUNK_CHARACTERS * 0.6);
    const window = remaining.slice(minimumBoundary, KNOWLEDGE_IMPORT_CHUNK_CHARACTERS + 1);
    const relativeBoundary = Math.max(
      window.lastIndexOf("\n"),
      window.lastIndexOf("。"),
      window.lastIndexOf("！"),
      window.lastIndexOf("？"),
      window.lastIndexOf(". "),
      window.lastIndexOf(" ")
    );
    const boundary =
      relativeBoundary >= 0
        ? minimumBoundary + relativeBoundary + 1
        : KNOWLEDGE_IMPORT_CHUNK_CHARACTERS;
    parts.push(remaining.slice(0, boundary).trim());
    remaining = remaining.slice(boundary).trim();
  }

  if (remaining) parts.push(remaining);
  return parts;
}

interface ChunkPart {
  text: string;
  page?: number;
}

interface InternalChunk {
  parts: ChunkPart[];
  length: number;
}

/**
 * 先尊重段落和 PDF 页边界，再在超长段落中寻找句号或空格切分。
 * 不做重叠分块，避免同一句话被导入多次并重复出现在 Agent 上下文中。
 */
export function chunkImportSections(sections: ParsedImportSection[]): Array<{
  content: string;
  pageFrom?: number;
  pageTo?: number;
}> {
  const parts: ChunkPart[] = [];
  for (const section of sections) {
    const normalized = normalizeText(section.text);
    if (!normalized) continue;
    const paragraphs = normalized.split(/\n{2,}/u).filter(Boolean);
    for (const paragraph of paragraphs) {
      for (const text of splitOversizedText(paragraph)) {
        parts.push({ text, page: section.page });
      }
    }
  }

  const chunks: InternalChunk[] = [];
  let current: InternalChunk = { parts: [], length: 0 };
  for (const part of parts) {
    const separatorLength = current.parts.length > 0 ? 2 : 0;
    if (
      current.parts.length > 0 &&
      current.length + separatorLength + part.text.length > KNOWLEDGE_IMPORT_CHUNK_CHARACTERS
    ) {
      chunks.push(current);
      current = { parts: [], length: 0 };
    }
    current.parts.push(part);
    current.length += (current.parts.length > 1 ? 2 : 0) + part.text.length;
  }
  if (current.parts.length > 0) chunks.push(current);

  return chunks.map((chunk) => {
    const pages = chunk.parts
      .map((part) => part.page)
      .filter((page): page is number => page !== undefined);
    return {
      content: chunk.parts.map((part) => part.text).join("\n\n"),
      ...(pages.length > 0 ? { pageFrom: Math.min(...pages), pageTo: Math.max(...pages) } : {}),
    };
  });
}

function normalizeTags(rawTags: string, extension: string): string {
  const tags = rawTags
    .split(/[,，]/u)
    .map((tag) => tag.trim())
    .filter(Boolean);
  const importedTags = ["文件导入", extension.slice(1).toLocaleUpperCase(), ...tags];
  return [...new Set(importedTags)].join(",").slice(0, 500);
}

function chunkTitle(fileName: string, index: number, total: number): string {
  if (total === 1) return fileName.slice(0, 100);
  const suffix = ` · 第 ${index}/${total} 段`;
  return `${fileName.slice(0, Math.max(1, 100 - suffix.length))}${suffix}`;
}

function chunkSummary(
  fileName: string,
  index: number,
  total: number,
  pageFrom?: number,
  pageTo?: number
): string {
  const pageLabel =
    pageFrom === undefined
      ? ""
      : pageFrom === pageTo
        ? `；PDF 第 ${pageFrom} 页`
        : `；PDF 第 ${pageFrom}-${pageTo} 页`;
  return `由文件“${fileName}”导入${pageLabel}；分块 ${index}/${total}`.slice(0, 1_000);
}

async function parsePdf(buffer: Uint8Array, fileName: string): Promise<ParsedImportSection[]> {
  const signature = new TextDecoder("ascii").decode(buffer.slice(0, 5));
  if (signature !== "%PDF-") {
    throw new KnowledgeImportError(`“${fileName}”不是有效的 PDF 文件`);
  }

  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.pages.map((page) => ({ page: page.num, text: page.text }));
  } catch (error: unknown) {
    console.warn(
      "PDF text extraction failed",
      error instanceof Error ? `${error.name}: ${error.message}` : "unknown parser error"
    );
    throw new KnowledgeImportError(`无法解析“${fileName}”，文件可能损坏或受密码保护`);
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

async function parseText(buffer: Uint8Array, fileName: string): Promise<ParsedImportSection[]> {
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    return [{ text }];
  } catch {
    throw new KnowledgeImportError(`“${fileName}”必须使用 UTF-8 编码`);
  }
}

export async function prepareKnowledgeFile(
  file: ImportFileLike,
  rawTags = ""
): Promise<PreparedKnowledgeFile> {
  const fileName = cleanFileName(file.name);
  const extension = fileExtension(fileName);
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    throw new KnowledgeImportError(`“${fileName}”格式不支持，只能上传 PDF、TXT 或 MD`);
  }
  if (file.size <= 0) throw new KnowledgeImportError(`“${fileName}”是空文件`);
  if (file.size > KNOWLEDGE_IMPORT_MAX_FILE_BYTES) {
    throw new KnowledgeImportError(`“${fileName}”超过 2 MB 限制`, 413);
  }
  if (extension === ".pdf" && !PDF_MIME_TYPES.has(file.type)) {
    throw new KnowledgeImportError(`“${fileName}”的文件类型与 PDF 扩展名不一致`);
  }
  if (extension !== ".pdf" && !TEXT_MIME_TYPES.has(file.type)) {
    throw new KnowledgeImportError(`“${fileName}”的文件类型与文本扩展名不一致`);
  }

  const buffer = new Uint8Array(await file.arrayBuffer());
  const sections =
    extension === ".pdf"
      ? await parsePdf(buffer, fileName)
      : await parseText(buffer, fileName);
  const characterCount = sections.reduce(
    (total, section) => total + normalizeText(section.text).length,
    0
  );
  if (characterCount === 0) {
    throw new KnowledgeImportError(
      `“${fileName}”没有可提取文字；扫描版 PDF 暂不支持 OCR`
    );
  }
  if (characterCount > KNOWLEDGE_IMPORT_MAX_TEXT_CHARACTERS) {
    throw new KnowledgeImportError(`“${fileName}”提取文字超过 80,000 字符限制`, 413);
  }

  const rawChunks = chunkImportSections(sections);
  if (rawChunks.length > KNOWLEDGE_IMPORT_MAX_CHUNKS_PER_FILE) {
    throw new KnowledgeImportError(`“${fileName}”分块过多，请拆分文件后重试`, 413);
  }
  const tags = normalizeTags(rawTags, extension);
  const chunks = rawChunks.map((chunk, chunkIndex) => ({
    title: chunkTitle(fileName, chunkIndex + 1, rawChunks.length),
    content: chunk.content,
    summary: chunkSummary(
      fileName,
      chunkIndex + 1,
      rawChunks.length,
      chunk.pageFrom,
      chunk.pageTo
    ),
    tags,
    source: "upload" as const,
  }));

  return { fileName, characterCount, chunks };
}

export async function prepareKnowledgeFiles(
  files: ImportFileLike[],
  rawTags = ""
): Promise<PreparedKnowledgeFile[]> {
  if (files.length === 0) throw new KnowledgeImportError("请选择要导入的文件");
  if (files.length > KNOWLEDGE_IMPORT_MAX_FILES) {
    throw new KnowledgeImportError(`每次最多导入 ${KNOWLEDGE_IMPORT_MAX_FILES} 个文件`);
  }
  if (rawTags.length > 300) throw new KnowledgeImportError("导入标签不能超过 300 个字符");

  const prepared: PreparedKnowledgeFile[] = [];
  // Render Free 资源有限，顺序解析可避免多个 PDF 同时占用内存。
  for (const file of files) prepared.push(await prepareKnowledgeFile(file, rawTags));
  return prepared;
}
