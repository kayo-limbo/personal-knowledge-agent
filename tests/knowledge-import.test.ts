import assert from "node:assert/strict";
import test from "node:test";
import {
  KNOWLEDGE_IMPORT_CHUNK_CHARACTERS,
  KNOWLEDGE_IMPORT_MAX_FILES,
  KnowledgeImportError,
  chunkImportSections,
  prepareKnowledgeFile,
  prepareKnowledgeFiles,
  type ImportFileLike,
} from "../src/lib/knowledge-import.ts";

function textFile(
  name: string,
  content: string,
  type = "text/plain"
): ImportFileLike {
  const bytes = new TextEncoder().encode(content);
  return {
    name,
    type,
    size: bytes.byteLength,
    arrayBuffer: async () => bytes.buffer,
  };
}

function minimalPdfFile(): ImportFileLike {
  const stream = "BT /F1 18 Tf 72 720 Td (Imported PDF knowledge) Tj ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let source = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(new TextEncoder().encode(source).byteLength);
    source += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = new TextEncoder().encode(source).byteLength;
  source += `xref\n0 ${objects.length + 1}\n`;
  source += "0000000000 65535 f \n";
  source += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("");
  source += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  const bytes = new TextEncoder().encode(source);
  return {
    name: "sample.pdf",
    type: "application/pdf",
    size: bytes.byteLength,
    arrayBuffer: async () => bytes.buffer,
  };
}

test("Markdown 文件会清洗、分块并补充可追溯元数据", async () => {
  const prepared = await prepareKnowledgeFile(
    textFile("project.md", "# 星河项目\r\n\r\n部署方式：Docker Compose。", "text/markdown"),
    "验收，项目文档"
  );

  assert.equal(prepared.fileName, "project.md");
  assert.equal(prepared.chunks.length, 1);
  assert.equal(prepared.chunks[0]?.source, "upload");
  assert.equal(prepared.chunks[0]?.content, "# 星河项目\n\n部署方式：Docker Compose。");
  assert.equal(prepared.chunks[0]?.tags, "文件导入,MD,验收,项目文档");
  assert.match(prepared.chunks[0]?.summary ?? "", /project\.md/);
});

test("长文本按边界切开且每个知识分块不超过预算", () => {
  const chunks = chunkImportSections([
    { text: Array.from({ length: 500 }, (_, index) => `第 ${index} 段：部署说明。`).join("\n\n") },
  ]);

  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => chunk.content.length <= KNOWLEDGE_IMPORT_CHUNK_CHARACTERS));
});

test("PDF 页码会保留在分块摘要所需的范围中", () => {
  const chunks = chunkImportSections([
    { page: 3, text: "第三页内容" },
    { page: 4, text: "第四页内容" },
  ]);

  assert.deepEqual(chunks, [
    { content: "第三页内容\n\n第四页内容", pageFrom: 3, pageTo: 4 },
  ]);
});

test("导入拒绝不支持的格式、非法 UTF-8 和过多文件", async () => {
  await assert.rejects(prepareKnowledgeFile(textFile("script.exe", "bad")), KnowledgeImportError);

  const invalidUtf8 = new Uint8Array([0xc3, 0x28]);
  await assert.rejects(
    prepareKnowledgeFile({
      name: "broken.txt",
      type: "text/plain",
      size: invalidUtf8.byteLength,
      arrayBuffer: async () => invalidUtf8.buffer,
    }),
    /UTF-8/
  );

  const files = Array.from({ length: KNOWLEDGE_IMPORT_MAX_FILES + 1 }, (_, index) =>
    textFile(`${index}.txt`, "内容")
  );
  await assert.rejects(prepareKnowledgeFiles(files), /最多导入/);
});

test("伪造扩展名的 PDF 在加载解析器前即被魔数校验拒绝", async () => {
  await assert.rejects(
    prepareKnowledgeFile(textFile("fake.pdf", "not a pdf", "application/pdf")),
    /不是有效的 PDF/
  );
});

test("真实 PDF 解析链路会提取页内文字并记录页码", async () => {
  const prepared = await prepareKnowledgeFile(minimalPdfFile());

  assert.equal(prepared.chunks.length, 1);
  assert.match(prepared.chunks[0]?.content ?? "", /Imported PDF knowledge/);
  assert.match(prepared.chunks[0]?.summary ?? "", /PDF 第 1 页/);
});
