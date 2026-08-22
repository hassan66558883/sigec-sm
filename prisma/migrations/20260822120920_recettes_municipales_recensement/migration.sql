-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "activityId" TEXT,
ADD COLUMN     "category" TEXT,
ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "code" TEXT,
ADD COLUMN     "gpsLat" DOUBLE PRECISION,
ADD COLUMN     "gpsLng" DOUBLE PRECISION,
ADD COLUMN     "openedAt" TIMESTAMP(3),
ADD COLUMN     "photoUrl" TEXT,
ADD COLUMN     "sequence" SERIAL NOT NULL;

-- AlterTable
ALTER TABLE "Market" ADD COLUMN     "address" TEXT,
ADD COLUMN     "code" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "gpsLat" DOUBLE PRECISION,
ADD COLUMN     "gpsLng" DOUBLE PRECISION,
ADD COLUMN     "photoUrl" TEXT,
ADD COLUMN     "responsibleName" TEXT,
ADD COLUMN     "sequence" SERIAL NOT NULL,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "MarketStall" ADD COLUMN     "type" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "agentId" TEXT,
ADD COLUMN     "gpsLat" DOUBLE PRECISION,
ADD COLUMN     "gpsLng" DOUBLE PRECISION,
ADD COLUMN     "obligationId" TEXT;

-- CreateTable
CREATE TABLE "ActiviteEconomique" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActiviteEconomique_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TarifMunicipal" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" TEXT,
    "activityId" TEXT,
    "emplacementType" TEXT NOT NULL,
    "periodicity" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIF',
    "legalReference" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TarifMunicipal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObligationPaiement" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "citizenId" TEXT NOT NULL,
    "businessId" TEXT,
    "marketStallId" TEXT,
    "tarifId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "initialAmount" DOUBLE PRECISION NOT NULL,
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'A_PAYER',
    "arrondissementId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ObligationPaiement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentCollecteur" (
    "id" TEXT NOT NULL,
    "matricule" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phone" TEXT,
    "photoUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIF',
    "arrondissementId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentCollecteur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentAffectation" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "zoneType" TEXT NOT NULL,
    "quartierId" TEXT,
    "marketId" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentAffectation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Receipt" (
    "id" TEXT NOT NULL,
    "sequence" SERIAL NOT NULL,
    "number" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "qrToken" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'VALIDE',
    "voidedAt" TIMESTAMP(3),
    "voidedById" TEXT,
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentCancellation" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "cancelledById" TEXT NOT NULL,
    "cancelledByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentCancellation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ActiviteEconomique_code_key" ON "ActiviteEconomique"("code");

-- CreateIndex
CREATE UNIQUE INDEX "TarifMunicipal_code_key" ON "TarifMunicipal"("code");

-- CreateIndex
CREATE INDEX "TarifMunicipal_emplacementType_idx" ON "TarifMunicipal"("emplacementType");

-- CreateIndex
CREATE INDEX "TarifMunicipal_status_idx" ON "TarifMunicipal"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ObligationPaiement_number_key" ON "ObligationPaiement"("number");

-- CreateIndex
CREATE INDEX "ObligationPaiement_arrondissementId_idx" ON "ObligationPaiement"("arrondissementId");

-- CreateIndex
CREATE INDEX "ObligationPaiement_status_idx" ON "ObligationPaiement"("status");

-- CreateIndex
CREATE INDEX "ObligationPaiement_citizenId_idx" ON "ObligationPaiement"("citizenId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentCollecteur_matricule_key" ON "AgentCollecteur"("matricule");

-- CreateIndex
CREATE UNIQUE INDEX "AgentCollecteur_userId_key" ON "AgentCollecteur"("userId");

-- CreateIndex
CREATE INDEX "AgentCollecteur_arrondissementId_idx" ON "AgentCollecteur"("arrondissementId");

-- CreateIndex
CREATE INDEX "AgentAffectation_agentId_idx" ON "AgentAffectation"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_sequence_key" ON "Receipt"("sequence");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_number_key" ON "Receipt"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_paymentId_key" ON "Receipt"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_qrToken_key" ON "Receipt"("qrToken");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentCancellation_paymentId_key" ON "PaymentCancellation"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "Business_sequence_key" ON "Business"("sequence");

-- CreateIndex
CREATE UNIQUE INDEX "Business_code_key" ON "Business"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Market_sequence_key" ON "Market"("sequence");

-- CreateIndex
CREATE UNIQUE INDEX "Market_code_key" ON "Market"("code");

-- CreateIndex
CREATE INDEX "Payment_obligationId_idx" ON "Payment"("obligationId");

-- CreateIndex
CREATE INDEX "Payment_agentId_idx" ON "Payment"("agentId");

-- AddForeignKey
ALTER TABLE "Business" ADD CONSTRAINT "Business_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "ActiviteEconomique"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "ObligationPaiement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "AgentCollecteur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TarifMunicipal" ADD CONSTRAINT "TarifMunicipal_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "ActiviteEconomique"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObligationPaiement" ADD CONSTRAINT "ObligationPaiement_citizenId_fkey" FOREIGN KEY ("citizenId") REFERENCES "Citizen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObligationPaiement" ADD CONSTRAINT "ObligationPaiement_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObligationPaiement" ADD CONSTRAINT "ObligationPaiement_marketStallId_fkey" FOREIGN KEY ("marketStallId") REFERENCES "MarketStall"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObligationPaiement" ADD CONSTRAINT "ObligationPaiement_tarifId_fkey" FOREIGN KEY ("tarifId") REFERENCES "TarifMunicipal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObligationPaiement" ADD CONSTRAINT "ObligationPaiement_arrondissementId_fkey" FOREIGN KEY ("arrondissementId") REFERENCES "Arrondissement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentCollecteur" ADD CONSTRAINT "AgentCollecteur_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentCollecteur" ADD CONSTRAINT "AgentCollecteur_arrondissementId_fkey" FOREIGN KEY ("arrondissementId") REFERENCES "Arrondissement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentAffectation" ADD CONSTRAINT "AgentAffectation_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "AgentCollecteur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentAffectation" ADD CONSTRAINT "AgentAffectation_quartierId_fkey" FOREIGN KEY ("quartierId") REFERENCES "Quartier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentAffectation" ADD CONSTRAINT "AgentAffectation_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentCancellation" ADD CONSTRAINT "PaymentCancellation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

