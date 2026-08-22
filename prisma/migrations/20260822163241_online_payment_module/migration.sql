-- AlterTable
ALTER TABLE "MobileMoneyTransaction" ADD COLUMN     "callbackReceivedAt" TIMESTAMP(3),
ADD COLUMN     "channel" TEXT NOT NULL DEFAULT 'AGENT',
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'XAF',
ADD COLUMN     "failureReason" TEXT,
ADD COLUMN     "internalReference" TEXT,
ADD COLUMN     "verifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ObligationPaiement" ADD COLUMN     "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "penaltyAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "TarifMunicipal" ADD COLUMN     "arrondissementId" TEXT,
ADD COLUMN     "unit" TEXT;

-- CreateTable
CREATE TABLE "PaymentRefund" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'INITIATED',
    "providerReference" TEXT,
    "requestedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "PaymentRefund_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRefund_paymentId_key" ON "PaymentRefund"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "MobileMoneyTransaction_internalReference_key" ON "MobileMoneyTransaction"("internalReference");

-- CreateIndex
CREATE INDEX "TarifMunicipal_arrondissementId_idx" ON "TarifMunicipal"("arrondissementId");

-- AddForeignKey
ALTER TABLE "TarifMunicipal" ADD CONSTRAINT "TarifMunicipal_arrondissementId_fkey" FOREIGN KEY ("arrondissementId") REFERENCES "Arrondissement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRefund" ADD CONSTRAINT "PaymentRefund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

