-- Les 4 DROP INDEX generes automatiquement par Prisma ici ont ete retires :
-- ce sont les index trigram (pg_trgm) crees en SQL brut hors du schema
-- Prisma (migration 20260904153234_add_trgm_search_indexes), toujours
-- invisibles pour Prisma qui propose donc systematiquement de les supprimer
-- a chaque nouvelle migration (deja rencontre plusieurs fois).

-- CreateTable
CREATE TABLE "IntegrationWebhook" (
    "id" TEXT NOT NULL,
    "systemId" TEXT,
    "url" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "timeoutMs" INTEGER NOT NULL DEFAULT 5000,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationWebhook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationWebhookDelivery" (
    "id" TEXT NOT NULL,
    "webhookId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "responseStatus" INTEGER,
    "responseBody" TEXT,
    "nextRetryAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationWebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IntegrationWebhook_event_idx" ON "IntegrationWebhook"("event");

-- CreateIndex
CREATE INDEX "IntegrationWebhook_status_idx" ON "IntegrationWebhook"("status");

-- CreateIndex
CREATE INDEX "IntegrationWebhookDelivery_status_idx" ON "IntegrationWebhookDelivery"("status");

-- CreateIndex
CREATE INDEX "IntegrationWebhookDelivery_webhookId_idx" ON "IntegrationWebhookDelivery"("webhookId");

-- CreateIndex
CREATE INDEX "IntegrationWebhookDelivery_nextRetryAt_idx" ON "IntegrationWebhookDelivery"("nextRetryAt");

-- AddForeignKey
ALTER TABLE "IntegrationWebhook" ADD CONSTRAINT "IntegrationWebhook_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "IntegrationSystem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationWebhookDelivery" ADD CONSTRAINT "IntegrationWebhookDelivery_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "IntegrationWebhook"("id") ON DELETE CASCADE ON UPDATE CASCADE;
