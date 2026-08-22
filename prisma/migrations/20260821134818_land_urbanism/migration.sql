-- AlterTable
ALTER TABLE "Certificate" ADD COLUMN     "urbanPlanningCaseId" TEXT;

-- CreateTable
CREATE TABLE "Subdivision" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "zone" TEXT,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "arrondissementId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subdivision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LandParcel" (
    "id" TEXT NOT NULL,
    "parcelNumber" TEXT NOT NULL,
    "arrondissementId" TEXT NOT NULL,
    "quartierId" TEXT,
    "sectorId" TEXT,
    "subdivisionId" TEXT,
    "area" DOUBLE PRECISION,
    "location" TEXT,
    "ownerCitizenId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LandParcel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LandTitle" (
    "id" TEXT NOT NULL,
    "titleNumber" TEXT NOT NULL,
    "parcelId" TEXT NOT NULL,
    "holderId" TEXT NOT NULL,
    "issuedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'VALID',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LandTitle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UrbanPlanningCase" (
    "id" TEXT NOT NULL,
    "caseNumber" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "parcelId" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "arrondissementId" TEXT NOT NULL,
    "inspectedAt" TIMESTAMP(3),
    "inspectionNotes" TEXT,
    "decisionAt" TIMESTAMP(3),
    "decisionById" TEXT,
    "decisionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UrbanPlanningCase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Subdivision_arrondissementId_idx" ON "Subdivision"("arrondissementId");

-- CreateIndex
CREATE UNIQUE INDEX "LandParcel_parcelNumber_key" ON "LandParcel"("parcelNumber");

-- CreateIndex
CREATE INDEX "LandParcel_arrondissementId_idx" ON "LandParcel"("arrondissementId");

-- CreateIndex
CREATE UNIQUE INDEX "LandTitle_titleNumber_key" ON "LandTitle"("titleNumber");

-- CreateIndex
CREATE UNIQUE INDEX "LandTitle_parcelId_key" ON "LandTitle"("parcelId");

-- CreateIndex
CREATE UNIQUE INDEX "UrbanPlanningCase_caseNumber_key" ON "UrbanPlanningCase"("caseNumber");

-- CreateIndex
CREATE INDEX "UrbanPlanningCase_arrondissementId_idx" ON "UrbanPlanningCase"("arrondissementId");

-- CreateIndex
CREATE INDEX "UrbanPlanningCase_status_idx" ON "UrbanPlanningCase"("status");

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_urbanPlanningCaseId_fkey" FOREIGN KEY ("urbanPlanningCaseId") REFERENCES "UrbanPlanningCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subdivision" ADD CONSTRAINT "Subdivision_arrondissementId_fkey" FOREIGN KEY ("arrondissementId") REFERENCES "Arrondissement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandParcel" ADD CONSTRAINT "LandParcel_arrondissementId_fkey" FOREIGN KEY ("arrondissementId") REFERENCES "Arrondissement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandParcel" ADD CONSTRAINT "LandParcel_quartierId_fkey" FOREIGN KEY ("quartierId") REFERENCES "Quartier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandParcel" ADD CONSTRAINT "LandParcel_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandParcel" ADD CONSTRAINT "LandParcel_subdivisionId_fkey" FOREIGN KEY ("subdivisionId") REFERENCES "Subdivision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandParcel" ADD CONSTRAINT "LandParcel_ownerCitizenId_fkey" FOREIGN KEY ("ownerCitizenId") REFERENCES "Citizen"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandTitle" ADD CONSTRAINT "LandTitle_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "LandParcel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandTitle" ADD CONSTRAINT "LandTitle_holderId_fkey" FOREIGN KEY ("holderId") REFERENCES "Citizen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UrbanPlanningCase" ADD CONSTRAINT "UrbanPlanningCase_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "LandParcel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UrbanPlanningCase" ADD CONSTRAINT "UrbanPlanningCase_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "Citizen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UrbanPlanningCase" ADD CONSTRAINT "UrbanPlanningCase_arrondissementId_fkey" FOREIGN KEY ("arrondissementId") REFERENCES "Arrondissement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
