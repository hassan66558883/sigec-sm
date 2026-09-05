-- Les 4 DROP INDEX generes automatiquement par Prisma ici ont ete retires :
-- ce sont les index trigram (pg_trgm) crees en SQL brut hors du schema
-- Prisma (migration 20260904153234_add_trgm_search_indexes), que Prisma ne
-- "voit" pas et propose donc de supprimer a chaque nouvelle migration —
-- comportement recurrent deja rencontre plusieurs fois, jamais une
-- suppression voulue.

-- CreateTable
CREATE TABLE "IntegrationSystem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "organization" TEXT,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "baseUrl" TEXT,
    "authType" TEXT NOT NULL DEFAULT 'API_KEY',
    "environment" TEXT NOT NULL DEFAULT 'DEVELOPMENT',
    "status" TEXT NOT NULL DEFAULT 'TESTING',
    "contact" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "rateLimitPerMinute" INTEGER NOT NULL DEFAULT 100,
    "lastTestAt" TIMESTAMP(3),
    "lastTestOk" BOOLEAN,
    "lastTestMessage" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationSystem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationCredential" (
    "id" TEXT NOT NULL,
    "systemId" TEXT NOT NULL,
    "clientId" TEXT,
    "clientSecret" TEXT,
    "oauthConfig" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationApiKey" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "systemId" TEXT,
    "keyPrefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "IntegrationApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationLog" (
    "id" TEXT NOT NULL,
    "systemId" TEXT,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "responseTimeMs" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL,
    "errorMessage" TEXT,
    "ipAddress" TEXT,
    "correlationId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationError" (
    "id" TEXT NOT NULL,
    "systemId" TEXT,
    "endpoint" TEXT NOT NULL,
    "errorType" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,

    CONSTRAINT "IntegrationError_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationSystem_code_key" ON "IntegrationSystem"("code");

-- CreateIndex
CREATE INDEX "IntegrationSystem_status_idx" ON "IntegrationSystem"("status");

-- CreateIndex
CREATE INDEX "IntegrationSystem_enabled_idx" ON "IntegrationSystem"("enabled");

-- CreateIndex
CREATE INDEX "IntegrationSystem_type_idx" ON "IntegrationSystem"("type");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationCredential_systemId_key" ON "IntegrationCredential"("systemId");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationApiKey_keyPrefix_key" ON "IntegrationApiKey"("keyPrefix");

-- CreateIndex
CREATE INDEX "IntegrationApiKey_status_idx" ON "IntegrationApiKey"("status");

-- CreateIndex
CREATE INDEX "IntegrationLog_systemId_idx" ON "IntegrationLog"("systemId");

-- CreateIndex
CREATE INDEX "IntegrationLog_createdAt_idx" ON "IntegrationLog"("createdAt");

-- CreateIndex
CREATE INDEX "IntegrationLog_correlationId_idx" ON "IntegrationLog"("correlationId");

-- CreateIndex
CREATE INDEX "IntegrationLog_success_idx" ON "IntegrationLog"("success");

-- CreateIndex
CREATE INDEX "IntegrationError_status_idx" ON "IntegrationError"("status");

-- CreateIndex
CREATE INDEX "IntegrationError_systemId_idx" ON "IntegrationError"("systemId");

-- AddForeignKey
ALTER TABLE "IntegrationCredential" ADD CONSTRAINT "IntegrationCredential_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "IntegrationSystem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationApiKey" ADD CONSTRAINT "IntegrationApiKey_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "IntegrationSystem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationLog" ADD CONSTRAINT "IntegrationLog_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "IntegrationSystem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationError" ADD CONSTRAINT "IntegrationError_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "IntegrationSystem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
