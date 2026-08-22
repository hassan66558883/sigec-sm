-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "caisseId" TEXT;

-- CreateTable
CREATE TABLE "CashRegister" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "arrondissementId" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openedById" TEXT NOT NULL,
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "expectedAmount" DOUBLE PRECISION,
    "declaredAmount" DOUBLE PRECISION,
    "discrepancy" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'OUVERTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashRegister_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Versement" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "caisseId" TEXT,
    "expectedAmount" DOUBLE PRECISION NOT NULL,
    "remittedAmount" DOUBLE PRECISION NOT NULL,
    "discrepancy" DOUBLE PRECISION NOT NULL,
    "justification" TEXT,
    "status" TEXT NOT NULL DEFAULT 'EN_ATTENTE',
    "validatedById" TEXT,
    "validatedAt" TIMESTAMP(3),
    "arrondissementId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Versement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MobileMoneyTransaction" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'MANUAL',
    "externalReference" TEXT,
    "phoneNumber" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'INITIATED',
    "providerResponse" JSONB,
    "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "confirmedById" TEXT,

    CONSTRAINT "MobileMoneyTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FraudAlert" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "agentId" TEXT,
    "paymentId" TEXT,
    "caisseId" TEXT,
    "arrondissementId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OUVERTE',
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FraudAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CashRegister_number_key" ON "CashRegister"("number");

-- CreateIndex
CREATE INDEX "CashRegister_agentId_idx" ON "CashRegister"("agentId");

-- CreateIndex
CREATE INDEX "CashRegister_arrondissementId_idx" ON "CashRegister"("arrondissementId");

-- CreateIndex
CREATE UNIQUE INDEX "Versement_number_key" ON "Versement"("number");

-- CreateIndex
CREATE INDEX "Versement_agentId_idx" ON "Versement"("agentId");

-- CreateIndex
CREATE INDEX "Versement_arrondissementId_idx" ON "Versement"("arrondissementId");

-- CreateIndex
CREATE UNIQUE INDEX "MobileMoneyTransaction_paymentId_key" ON "MobileMoneyTransaction"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "MobileMoneyTransaction_externalReference_key" ON "MobileMoneyTransaction"("externalReference");

-- CreateIndex
CREATE INDEX "FraudAlert_status_idx" ON "FraudAlert"("status");

-- CreateIndex
CREATE INDEX "FraudAlert_severity_idx" ON "FraudAlert"("severity");

-- CreateIndex
CREATE INDEX "FraudAlert_arrondissementId_idx" ON "FraudAlert"("arrondissementId");

-- CreateIndex
CREATE INDEX "Payment_caisseId_idx" ON "Payment"("caisseId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_caisseId_fkey" FOREIGN KEY ("caisseId") REFERENCES "CashRegister"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashRegister" ADD CONSTRAINT "CashRegister_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "AgentCollecteur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashRegister" ADD CONSTRAINT "CashRegister_arrondissementId_fkey" FOREIGN KEY ("arrondissementId") REFERENCES "Arrondissement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Versement" ADD CONSTRAINT "Versement_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "AgentCollecteur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Versement" ADD CONSTRAINT "Versement_caisseId_fkey" FOREIGN KEY ("caisseId") REFERENCES "CashRegister"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Versement" ADD CONSTRAINT "Versement_arrondissementId_fkey" FOREIGN KEY ("arrondissementId") REFERENCES "Arrondissement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobileMoneyTransaction" ADD CONSTRAINT "MobileMoneyTransaction_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FraudAlert" ADD CONSTRAINT "FraudAlert_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "AgentCollecteur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FraudAlert" ADD CONSTRAINT "FraudAlert_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FraudAlert" ADD CONSTRAINT "FraudAlert_caisseId_fkey" FOREIGN KEY ("caisseId") REFERENCES "CashRegister"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FraudAlert" ADD CONSTRAINT "FraudAlert_arrondissementId_fkey" FOREIGN KEY ("arrondissementId") REFERENCES "Arrondissement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

