-- CreateTable
CREATE TABLE "Association" (
    "id" TEXT NOT NULL,
    "registrationNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "leaderId" TEXT,
    "arrondissementId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REGISTERED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Association_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Complaint" (
    "id" TEXT NOT NULL,
    "caseNumber" TEXT NOT NULL,
    "citizenAccountId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "arrondissementId" TEXT NOT NULL,
    "assignedToId" TEXT,
    "resolutionNotes" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Complaint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplaintUpdate" (
    "id" TEXT NOT NULL,
    "complaintId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplaintUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Infrastructure" (
    "id" TEXT NOT NULL,
    "reportNumber" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "location" TEXT,
    "status" TEXT NOT NULL DEFAULT 'REPORTED',
    "arrondissementId" TEXT NOT NULL,
    "reportedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Infrastructure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Association_registrationNumber_key" ON "Association"("registrationNumber");

-- CreateIndex
CREATE INDEX "Association_arrondissementId_idx" ON "Association"("arrondissementId");

-- CreateIndex
CREATE UNIQUE INDEX "Complaint_caseNumber_key" ON "Complaint"("caseNumber");

-- CreateIndex
CREATE INDEX "Complaint_arrondissementId_idx" ON "Complaint"("arrondissementId");

-- CreateIndex
CREATE INDEX "Complaint_status_idx" ON "Complaint"("status");

-- CreateIndex
CREATE INDEX "ComplaintUpdate_complaintId_idx" ON "ComplaintUpdate"("complaintId");

-- CreateIndex
CREATE UNIQUE INDEX "Infrastructure_reportNumber_key" ON "Infrastructure"("reportNumber");

-- CreateIndex
CREATE INDEX "Infrastructure_arrondissementId_idx" ON "Infrastructure"("arrondissementId");

-- CreateIndex
CREATE INDEX "Infrastructure_status_idx" ON "Infrastructure"("status");

-- AddForeignKey
ALTER TABLE "Association" ADD CONSTRAINT "Association_leaderId_fkey" FOREIGN KEY ("leaderId") REFERENCES "Citizen"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Association" ADD CONSTRAINT "Association_arrondissementId_fkey" FOREIGN KEY ("arrondissementId") REFERENCES "Arrondissement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_citizenAccountId_fkey" FOREIGN KEY ("citizenAccountId") REFERENCES "CitizenAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_arrondissementId_fkey" FOREIGN KEY ("arrondissementId") REFERENCES "Arrondissement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplaintUpdate" ADD CONSTRAINT "ComplaintUpdate_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "Complaint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Infrastructure" ADD CONSTRAINT "Infrastructure_arrondissementId_fkey" FOREIGN KEY ("arrondissementId") REFERENCES "Arrondissement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Infrastructure" ADD CONSTRAINT "Infrastructure_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "CitizenAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
