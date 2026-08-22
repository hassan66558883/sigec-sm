-- CreateTable
CREATE TABLE "Citizen" (
    "id" TEXT NOT NULL,
    "uniqueNumber" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "sex" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "placeOfBirth" TEXT,
    "nationality" TEXT NOT NULL DEFAULT 'Tchadienne',
    "maritalStatus" TEXT NOT NULL DEFAULT 'SINGLE',
    "phone" TEXT,
    "address" TEXT,
    "photoUrl" TEXT,
    "isDeceased" BOOLEAN NOT NULL DEFAULT false,
    "arrondissementId" TEXT NOT NULL,
    "quartierId" TEXT,
    "sectorId" TEXT,
    "householdId" TEXT,
    "fatherId" TEXT,
    "motherId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Citizen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Family" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "headCitizenId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Family_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Household" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "familyId" TEXT,
    "headCitizenId" TEXT,
    "address" TEXT,
    "arrondissementId" TEXT NOT NULL,
    "quartierId" TEXT,
    "sectorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Household_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BirthRecord" (
    "id" TEXT NOT NULL,
    "recordNumber" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "fatherId" TEXT,
    "motherId" TEXT,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "placeOfBirth" TEXT NOT NULL,
    "declarantName" TEXT NOT NULL,
    "declarantRelation" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DECLARED',
    "arrondissementId" TEXT NOT NULL,
    "createdById" TEXT,
    "registeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BirthRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recognition" (
    "id" TEXT NOT NULL,
    "recordNumber" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "parentRole" TEXT NOT NULL,
    "declarationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'DECLARED',
    "arrondissementId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recognition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarriageRegime" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "MarriageRegime_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Marriage" (
    "id" TEXT NOT NULL,
    "recordNumber" TEXT NOT NULL,
    "husbandId" TEXT NOT NULL,
    "wifeId" TEXT NOT NULL,
    "marriageDate" TIMESTAMP(3) NOT NULL,
    "marriagePlace" TEXT NOT NULL,
    "regimeId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'VALID',
    "arrondissementId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Marriage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarriageWitness" (
    "id" TEXT NOT NULL,
    "marriageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,

    CONSTRAINT "MarriageWitness_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Divorce" (
    "id" TEXT NOT NULL,
    "recordNumber" TEXT NOT NULL,
    "marriageId" TEXT NOT NULL,
    "decisionReference" TEXT,
    "divorceDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DECLARED',
    "arrondissementId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Divorce_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeathRecord" (
    "id" TEXT NOT NULL,
    "recordNumber" TEXT NOT NULL,
    "deceasedId" TEXT NOT NULL,
    "dateOfDeath" TIMESTAMP(3) NOT NULL,
    "placeOfDeath" TEXT NOT NULL,
    "cause" TEXT,
    "declarantName" TEXT NOT NULL,
    "declarantRelation" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DECLARED',
    "arrondissementId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeathRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CertificateType" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CertificateType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Certificate" (
    "id" TEXT NOT NULL,
    "documentNumber" TEXT NOT NULL,
    "qrToken" TEXT NOT NULL,
    "certificateTypeId" TEXT NOT NULL,
    "citizenId" TEXT,
    "birthRecordId" TEXT,
    "recognitionId" TEXT,
    "marriageId" TEXT,
    "divorceId" TEXT,
    "deathRecordId" TEXT,
    "arrondissementId" TEXT NOT NULL,
    "authority" TEXT NOT NULL DEFAULT 'Mairie de N''Djamena',
    "status" TEXT NOT NULL DEFAULT 'VALID',
    "issuedById" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,
    "revokedReason" TEXT,

    CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Citizen_uniqueNumber_key" ON "Citizen"("uniqueNumber");

-- CreateIndex
CREATE INDEX "Citizen_arrondissementId_idx" ON "Citizen"("arrondissementId");

-- CreateIndex
CREATE INDEX "Citizen_lastName_firstName_idx" ON "Citizen"("lastName", "firstName");

-- CreateIndex
CREATE UNIQUE INDEX "Household_code_key" ON "Household"("code");

-- CreateIndex
CREATE INDEX "Household_arrondissementId_idx" ON "Household"("arrondissementId");

-- CreateIndex
CREATE UNIQUE INDEX "BirthRecord_recordNumber_key" ON "BirthRecord"("recordNumber");

-- CreateIndex
CREATE UNIQUE INDEX "BirthRecord_childId_key" ON "BirthRecord"("childId");

-- CreateIndex
CREATE INDEX "BirthRecord_arrondissementId_idx" ON "BirthRecord"("arrondissementId");

-- CreateIndex
CREATE UNIQUE INDEX "Recognition_recordNumber_key" ON "Recognition"("recordNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Recognition_childId_key" ON "Recognition"("childId");

-- CreateIndex
CREATE INDEX "Recognition_arrondissementId_idx" ON "Recognition"("arrondissementId");

-- CreateIndex
CREATE UNIQUE INDEX "MarriageRegime_code_key" ON "MarriageRegime"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Marriage_recordNumber_key" ON "Marriage"("recordNumber");

-- CreateIndex
CREATE INDEX "Marriage_arrondissementId_idx" ON "Marriage"("arrondissementId");

-- CreateIndex
CREATE UNIQUE INDEX "Divorce_recordNumber_key" ON "Divorce"("recordNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Divorce_marriageId_key" ON "Divorce"("marriageId");

-- CreateIndex
CREATE INDEX "Divorce_arrondissementId_idx" ON "Divorce"("arrondissementId");

-- CreateIndex
CREATE UNIQUE INDEX "DeathRecord_recordNumber_key" ON "DeathRecord"("recordNumber");

-- CreateIndex
CREATE UNIQUE INDEX "DeathRecord_deceasedId_key" ON "DeathRecord"("deceasedId");

-- CreateIndex
CREATE INDEX "DeathRecord_arrondissementId_idx" ON "DeathRecord"("arrondissementId");

-- CreateIndex
CREATE UNIQUE INDEX "CertificateType_code_key" ON "CertificateType"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_documentNumber_key" ON "Certificate"("documentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_qrToken_key" ON "Certificate"("qrToken");

-- CreateIndex
CREATE INDEX "Certificate_arrondissementId_idx" ON "Certificate"("arrondissementId");

-- CreateIndex
CREATE INDEX "Certificate_status_idx" ON "Certificate"("status");

-- AddForeignKey
ALTER TABLE "Citizen" ADD CONSTRAINT "Citizen_arrondissementId_fkey" FOREIGN KEY ("arrondissementId") REFERENCES "Arrondissement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Citizen" ADD CONSTRAINT "Citizen_quartierId_fkey" FOREIGN KEY ("quartierId") REFERENCES "Quartier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Citizen" ADD CONSTRAINT "Citizen_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Citizen" ADD CONSTRAINT "Citizen_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Citizen" ADD CONSTRAINT "Citizen_fatherId_fkey" FOREIGN KEY ("fatherId") REFERENCES "Citizen"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Citizen" ADD CONSTRAINT "Citizen_motherId_fkey" FOREIGN KEY ("motherId") REFERENCES "Citizen"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Family" ADD CONSTRAINT "Family_headCitizenId_fkey" FOREIGN KEY ("headCitizenId") REFERENCES "Citizen"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Household" ADD CONSTRAINT "Household_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Household" ADD CONSTRAINT "Household_headCitizenId_fkey" FOREIGN KEY ("headCitizenId") REFERENCES "Citizen"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Household" ADD CONSTRAINT "Household_arrondissementId_fkey" FOREIGN KEY ("arrondissementId") REFERENCES "Arrondissement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Household" ADD CONSTRAINT "Household_quartierId_fkey" FOREIGN KEY ("quartierId") REFERENCES "Quartier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Household" ADD CONSTRAINT "Household_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BirthRecord" ADD CONSTRAINT "BirthRecord_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Citizen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BirthRecord" ADD CONSTRAINT "BirthRecord_arrondissementId_fkey" FOREIGN KEY ("arrondissementId") REFERENCES "Arrondissement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recognition" ADD CONSTRAINT "Recognition_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Citizen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recognition" ADD CONSTRAINT "Recognition_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Citizen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recognition" ADD CONSTRAINT "Recognition_arrondissementId_fkey" FOREIGN KEY ("arrondissementId") REFERENCES "Arrondissement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Marriage" ADD CONSTRAINT "Marriage_husbandId_fkey" FOREIGN KEY ("husbandId") REFERENCES "Citizen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Marriage" ADD CONSTRAINT "Marriage_wifeId_fkey" FOREIGN KEY ("wifeId") REFERENCES "Citizen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Marriage" ADD CONSTRAINT "Marriage_regimeId_fkey" FOREIGN KEY ("regimeId") REFERENCES "MarriageRegime"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Marriage" ADD CONSTRAINT "Marriage_arrondissementId_fkey" FOREIGN KEY ("arrondissementId") REFERENCES "Arrondissement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarriageWitness" ADD CONSTRAINT "MarriageWitness_marriageId_fkey" FOREIGN KEY ("marriageId") REFERENCES "Marriage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Divorce" ADD CONSTRAINT "Divorce_marriageId_fkey" FOREIGN KEY ("marriageId") REFERENCES "Marriage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Divorce" ADD CONSTRAINT "Divorce_arrondissementId_fkey" FOREIGN KEY ("arrondissementId") REFERENCES "Arrondissement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeathRecord" ADD CONSTRAINT "DeathRecord_deceasedId_fkey" FOREIGN KEY ("deceasedId") REFERENCES "Citizen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeathRecord" ADD CONSTRAINT "DeathRecord_arrondissementId_fkey" FOREIGN KEY ("arrondissementId") REFERENCES "Arrondissement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_certificateTypeId_fkey" FOREIGN KEY ("certificateTypeId") REFERENCES "CertificateType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_citizenId_fkey" FOREIGN KEY ("citizenId") REFERENCES "Citizen"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_birthRecordId_fkey" FOREIGN KEY ("birthRecordId") REFERENCES "BirthRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_recognitionId_fkey" FOREIGN KEY ("recognitionId") REFERENCES "Recognition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_marriageId_fkey" FOREIGN KEY ("marriageId") REFERENCES "Marriage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_divorceId_fkey" FOREIGN KEY ("divorceId") REFERENCES "Divorce"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_deathRecordId_fkey" FOREIGN KEY ("deathRecordId") REFERENCES "DeathRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_arrondissementId_fkey" FOREIGN KEY ("arrondissementId") REFERENCES "Arrondissement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
