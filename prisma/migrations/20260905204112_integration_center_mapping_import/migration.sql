-- Les 4 DROP INDEX generes automatiquement par Prisma ici ont ete retires :
-- ce sont les index trigram (pg_trgm) crees en SQL brut hors du schema
-- Prisma (migration 20260904153234_add_trgm_search_indexes), toujours
-- invisibles pour Prisma qui propose donc systematiquement de les supprimer
-- a chaque nouvelle migration (deja rencontre plusieurs fois).

-- CreateTable
CREATE TABLE "IntegrationMapping" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "entityType" TEXT NOT NULL DEFAULT 'CITIZENS',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationMappingRule" (
    "id" TEXT NOT NULL,
    "mappingId" TEXT NOT NULL,
    "sourceField" TEXT NOT NULL,
    "targetField" TEXT NOT NULL,
    "transform" TEXT NOT NULL DEFAULT 'DIRECT',
    "transformConfig" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "IntegrationMappingRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationImportJob" (
    "id" TEXT NOT NULL,
    "mappingId" TEXT,
    "entityType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "totalRows" INTEGER NOT NULL,
    "validRows" INTEGER NOT NULL,
    "invalidRows" INTEGER NOT NULL,
    "importedRows" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PREVIEWED',
    "validatedRows" TEXT,
    "errors" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "importedAt" TIMESTAMP(3),

    CONSTRAINT "IntegrationImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IntegrationMapping_entityType_idx" ON "IntegrationMapping"("entityType");

-- CreateIndex
CREATE INDEX "IntegrationMappingRule_mappingId_idx" ON "IntegrationMappingRule"("mappingId");

-- CreateIndex
CREATE INDEX "IntegrationImportJob_status_idx" ON "IntegrationImportJob"("status");

-- AddForeignKey
ALTER TABLE "IntegrationMappingRule" ADD CONSTRAINT "IntegrationMappingRule_mappingId_fkey" FOREIGN KEY ("mappingId") REFERENCES "IntegrationMapping"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationImportJob" ADD CONSTRAINT "IntegrationImportJob_mappingId_fkey" FOREIGN KEY ("mappingId") REFERENCES "IntegrationMapping"("id") ON DELETE SET NULL ON UPDATE CASCADE;
