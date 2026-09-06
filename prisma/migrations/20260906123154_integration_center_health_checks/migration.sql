-- Les 4 DROP INDEX generes automatiquement par Prisma ici ont ete retires :
-- ce sont les index trigram (pg_trgm) crees en SQL brut hors du schema
-- Prisma (migration 20260904153234_add_trgm_search_indexes), toujours
-- invisibles pour Prisma qui propose donc systematiquement de les supprimer
-- a chaque nouvelle migration (deja rencontre plusieurs fois).

-- CreateTable
CREATE TABLE "IntegrationHealthCheck" (
    "id" TEXT NOT NULL,
    "systemId" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "latencyMs" INTEGER,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationHealthCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IntegrationHealthCheck_systemId_idx" ON "IntegrationHealthCheck"("systemId");

-- CreateIndex
CREATE INDEX "IntegrationHealthCheck_createdAt_idx" ON "IntegrationHealthCheck"("createdAt");

-- AddForeignKey
ALTER TABLE "IntegrationHealthCheck" ADD CONSTRAINT "IntegrationHealthCheck_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "IntegrationSystem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
