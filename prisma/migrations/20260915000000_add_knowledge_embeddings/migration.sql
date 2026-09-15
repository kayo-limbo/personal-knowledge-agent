CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE "KnowledgeEmbeddingIndex" (
  "documentId" TEXT PRIMARY KEY REFERENCES "KnowledgeDoc"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "modelKey" TEXT NOT NULL,
  "sourceHash" TEXT NOT NULL,
  "status" TEXT NOT NULL CHECK ("status" IN ('indexing', 'ready', 'failed')),
  "claimToken" TEXT NOT NULL,
  "leaseUntil" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "KnowledgeEmbeddingChunk" (
  "documentId" TEXT NOT NULL REFERENCES "KnowledgeEmbeddingIndex"("documentId") ON DELETE CASCADE ON UPDATE CASCADE,
  "position" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  "embedding" vector(1024) NOT NULL,
  PRIMARY KEY ("documentId", "position")
);

-- 所有写入入口（包括脚本和 SQL）更新知识时立即使旧索引失效。
CREATE FUNCTION invalidate_knowledge_embedding() RETURNS trigger AS $$
BEGIN
  DELETE FROM "KnowledgeEmbeddingIndex" WHERE "documentId" = NEW."id";
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER knowledge_embedding_changed
AFTER UPDATE OF "title", "content", "summary", "tags" ON "KnowledgeDoc"
FOR EACH ROW
WHEN (OLD."title" IS DISTINCT FROM NEW."title" OR OLD."content" IS DISTINCT FROM NEW."content"
  OR OLD."summary" IS DISTINCT FROM NEW."summary" OR OLD."tags" IS DISTINCT FROM NEW."tags")
EXECUTE FUNCTION invalidate_knowledge_embedding();
