-- AlterTable
ALTER TABLE "Payment" ALTER COLUMN "collectedById" DROP NOT NULL;

-- CreateTable
CREATE TABLE "QrCode" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedById" TEXT,
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,
    "revokedReason" TEXT,
    "replacesId" TEXT,
    "installedAt" TIMESTAMP(3),
    "installedById" TEXT,
    "installGpsLat" DOUBLE PRECISION,
    "installGpsLng" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QrCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QrCodeEvent" (
    "id" TEXT NOT NULL,
    "qrCodeId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "actorId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QrCodeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QrCode_token_key" ON "QrCode"("token");

-- CreateIndex
CREATE UNIQUE INDEX "QrCode_replacesId_key" ON "QrCode"("replacesId");

-- CreateIndex
CREATE INDEX "QrCode_entityType_entityId_idx" ON "QrCode"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "QrCode_status_idx" ON "QrCode"("status");

-- CreateIndex
CREATE INDEX "QrCodeEvent_qrCodeId_idx" ON "QrCodeEvent"("qrCodeId");

-- CreateIndex
CREATE INDEX "QrCodeEvent_event_idx" ON "QrCodeEvent"("event");

-- AddForeignKey
ALTER TABLE "QrCode" ADD CONSTRAINT "QrCode_replacesId_fkey" FOREIGN KEY ("replacesId") REFERENCES "QrCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QrCodeEvent" ADD CONSTRAINT "QrCodeEvent_qrCodeId_fkey" FOREIGN KEY ("qrCodeId") REFERENCES "QrCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
