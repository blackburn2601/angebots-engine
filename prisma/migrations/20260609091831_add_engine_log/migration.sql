-- CreateTable
CREATE TABLE "EngineLog" (
    "id" TEXT NOT NULL,
    "domain_id" TEXT NOT NULL,
    "domain_name" TEXT NOT NULL,
    "inputs" TEXT NOT NULL,
    "outputs" TEXT NOT NULL,
    "trace" TEXT NOT NULL,
    "duration_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EngineLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EngineLog_domain_id_created_at_idx" ON "EngineLog"("domain_id", "created_at");

-- CreateIndex
CREATE INDEX "EngineLog_created_at_idx" ON "EngineLog"("created_at");
