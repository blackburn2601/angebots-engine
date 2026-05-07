-- CreateTable
CREATE TABLE "ApiLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "status_code" INTEGER,
    "duration_ms" INTEGER,
    "request_headers" TEXT,
    "request_body" TEXT,
    "response_body" TEXT,
    "ip" TEXT,
    "user_id" TEXT,
    "api_key_id" TEXT,
    "error" TEXT,
    "zeitstempel" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "WebhookUrl" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "description" TEXT,
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "erstellt_am" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "updated_at" DATETIME NOT NULL,
    "updated_by" TEXT
);

-- CreateIndex
CREATE INDEX "ApiLog_zeitstempel_idx" ON "ApiLog"("zeitstempel");

-- CreateIndex
CREATE INDEX "ApiLog_path_idx" ON "ApiLog"("path");

-- CreateIndex
CREATE INDEX "ApiLog_status_code_idx" ON "ApiLog"("status_code");
