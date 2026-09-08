-- CreateTable
CREATE TABLE "ChatQuota" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "usageDate" DATE NOT NULL,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatQuota_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChatQuota_scope_subjectId_usageDate_key"
ON "ChatQuota"("scope", "subjectId", "usageDate");

-- CreateIndex
CREATE INDEX "ChatQuota_usageDate_idx" ON "ChatQuota"("usageDate");
