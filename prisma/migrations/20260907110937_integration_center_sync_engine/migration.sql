-- Les 4 DROP INDEX generes automatiquement par Prisma ici ont ete retires :
-- ce sont les index trigram (pg_trgm) crees en SQL brut hors du schema
-- Prisma (migration 20260904153234_add_trgm_search_indexes), toujours
-- invisibles pour Prisma qui propose donc systematiquement de les supprimer
-- a chaque nouvelle migration (deja rencontre plusieurs fois).

-- CreateTable
CREATE TABLE "IntegrationSyncJob" (
    "id" TEXT NOT NULL,
    "systemId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL DEFAULT 'CITIZENS',
    "syncType" TEXT NOT NULL,
    "intervalMinutes" INTEGER,
    "endpointPath" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "lastSyncAt" TIMESTAMP(3),
    "nextSyncAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationSyncJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationSyncRun" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "recordsSent" INTEGER NOT NULL DEFAULT 0,
    "recordsFailed" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "errorMessage" TEXT,

    CONSTRAINT "IntegrationSyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IntegrationSyncJob_status_idx" ON "IntegrationSyncJob"("status");

-- CreateIndex
CREATE INDEX "IntegrationSyncJob_nextSyncAt_idx" ON "IntegrationSyncJob"("nextSyncAt");

-- CreateIndex
CREATE INDEX "IntegrationSyncRun_jobId_idx" ON "IntegrationSyncRun"("jobId");

-- CreateIndex
CREATE INDEX "IntegrationSyncRun_status_idx" ON "IntegrationSyncRun"("status");

-- AddForeignKey
ALTER TABLE "IntegrationSyncJob" ADD CONSTRAINT "IntegrationSyncJob_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "IntegrationSystem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationSyncRun" ADD CONSTRAINT "IntegrationSyncRun_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "IntegrationSyncJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
