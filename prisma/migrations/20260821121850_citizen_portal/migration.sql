-- AlterTable
ALTER TABLE "Marriage" ALTER COLUMN "status" SET DEFAULT 'DECLARED';

-- CreateTable
CREATE TABLE "CitizenAccount" (
    "id" TEXT NOT NULL,
    "citizenId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CitizenAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "applicationNumber" TEXT NOT NULL,
    "citizenAccountId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "birthRecordId" TEXT,
    "marriageId" TEXT,
    "deathRecordId" TEXT,
    "arrondissementId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "notes" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "resultCertificateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "citizenAccountId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CitizenAccount_citizenId_key" ON "CitizenAccount"("citizenId");

-- CreateIndex
CREATE UNIQUE INDEX "CitizenAccount_email_key" ON "CitizenAccount"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Application_applicationNumber_key" ON "Application"("applicationNumber");

-- CreateIndex
CREATE INDEX "Application_arrondissementId_idx" ON "Application"("arrondissementId");

-- CreateIndex
CREATE INDEX "Application_citizenAccountId_idx" ON "Application"("citizenAccountId");

-- CreateIndex
CREATE INDEX "Application_status_idx" ON "Application"("status");

-- CreateIndex
CREATE INDEX "Notification_citizenAccountId_idx" ON "Notification"("citizenAccountId");

-- AddForeignKey
ALTER TABLE "CitizenAccount" ADD CONSTRAINT "CitizenAccount_citizenId_fkey" FOREIGN KEY ("citizenId") REFERENCES "Citizen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_citizenAccountId_fkey" FOREIGN KEY ("citizenAccountId") REFERENCES "CitizenAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_birthRecordId_fkey" FOREIGN KEY ("birthRecordId") REFERENCES "BirthRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_marriageId_fkey" FOREIGN KEY ("marriageId") REFERENCES "Marriage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_deathRecordId_fkey" FOREIGN KEY ("deathRecordId") REFERENCES "DeathRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_arrondissementId_fkey" FOREIGN KEY ("arrondissementId") REFERENCES "Arrondissement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_resultCertificateId_fkey" FOREIGN KEY ("resultCertificateId") REFERENCES "Certificate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_citizenAccountId_fkey" FOREIGN KEY ("citizenAccountId") REFERENCES "CitizenAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
