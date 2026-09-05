-- AlterTable
ALTER TABLE "Complaint" ADD COLUMN     "address" TEXT,
ADD COLUMN     "assignedAt" TIMESTAMP(3),
ADD COLUMN     "assignedDepartmentId" TEXT,
ADD COLUMN     "categoryId" TEXT,
ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "dueAt" TIMESTAMP(3),
ADD COLUMN     "landmark" TEXT,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "mergedIntoId" TEXT,
ADD COLUMN     "priority" TEXT NOT NULL DEFAULT 'NORMAL',
ADD COLUMN     "problemAt" TIMESTAMP(3),
ADD COLUMN     "quartierId" TEXT,
ADD COLUMN     "receivedAt" TIMESTAMP(3),
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "sequence" SERIAL NOT NULL,
ADD COLUMN     "slaHours" INTEGER,
ADD COLUMN     "startedAt" TIMESTAMP(3),
ADD COLUMN     "subcategoryId" TEXT,
ADD COLUMN     "supervisorId" TEXT,
ADD COLUMN     "title" TEXT,
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'PLAINTE',
ADD COLUMN     "validatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ComplaintCategory" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplaintCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplaintSubcategory" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ComplaintSubcategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplaintAttachment" (
    "id" TEXT NOT NULL,
    "complaintId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedByCitizenAccountId" TEXT,
    "uploadedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplaintAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplaintComment" (
    "id" TEXT NOT NULL,
    "complaintId" TEXT NOT NULL,
    "authorType" TEXT NOT NULL,
    "authorUserId" TEXT,
    "authorCitizenId" TEXT,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplaintComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplaintSatisfaction" (
    "id" TEXT NOT NULL,
    "complaintId" TEXT NOT NULL,
    "wasResolved" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplaintSatisfaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplaintEscalation" (
    "id" TEXT NOT NULL,
    "complaintId" TEXT NOT NULL,
    "fromLevel" TEXT NOT NULL,
    "toLevel" TEXT NOT NULL,
    "reason" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplaintEscalation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ComplaintCategory_code_key" ON "ComplaintCategory"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ComplaintSubcategory_categoryId_code_key" ON "ComplaintSubcategory"("categoryId", "code");

-- CreateIndex
CREATE INDEX "ComplaintAttachment_complaintId_idx" ON "ComplaintAttachment"("complaintId");

-- CreateIndex
CREATE INDEX "ComplaintComment_complaintId_idx" ON "ComplaintComment"("complaintId");

-- CreateIndex
CREATE UNIQUE INDEX "ComplaintSatisfaction_complaintId_key" ON "ComplaintSatisfaction"("complaintId");

-- CreateIndex
CREATE INDEX "ComplaintEscalation_complaintId_idx" ON "ComplaintEscalation"("complaintId");

-- CreateIndex
CREATE INDEX "Complaint_priority_idx" ON "Complaint"("priority");

-- CreateIndex
CREATE INDEX "Complaint_categoryId_idx" ON "Complaint"("categoryId");

-- CreateIndex
CREATE INDEX "Complaint_assignedToId_idx" ON "Complaint"("assignedToId");

-- CreateIndex
CREATE INDEX "Complaint_dueAt_idx" ON "Complaint"("dueAt");

-- AddForeignKey
ALTER TABLE "ComplaintSubcategory" ADD CONSTRAINT "ComplaintSubcategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ComplaintCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_quartierId_fkey" FOREIGN KEY ("quartierId") REFERENCES "Quartier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ComplaintCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "ComplaintSubcategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_assignedDepartmentId_fkey" FOREIGN KEY ("assignedDepartmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "Complaint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplaintAttachment" ADD CONSTRAINT "ComplaintAttachment_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "Complaint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplaintComment" ADD CONSTRAINT "ComplaintComment_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "Complaint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplaintSatisfaction" ADD CONSTRAINT "ComplaintSatisfaction_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "Complaint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplaintEscalation" ADD CONSTRAINT "ComplaintEscalation_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "Complaint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill : seed les 6 categories historiques codees en dur dans
-- complaints.ts (CATEGORIES) pour que `Complaint.categoryId` puisse etre
-- renseigne sans perte sur les plaintes deja existantes. cuid-like id
-- genere via gen_random_uuid() (extension pgcrypto, deja disponible sur
-- Postgres 13+ sans CREATE EXTENSION explicite ici car md5/uuid suffisent).
INSERT INTO "ComplaintCategory" ("id", "code", "name", "isActive", "createdAt")
VALUES
  (md5(random()::text || clock_timestamp()::text), 'VOIRIE', 'Voirie', true, CURRENT_TIMESTAMP),
  (md5(random()::text || clock_timestamp()::text), 'PROPRETE', 'Proprete', true, CURRENT_TIMESTAMP),
  (md5(random()::text || clock_timestamp()::text), 'ECLAIRAGE', 'Eclairage public', true, CURRENT_TIMESTAMP),
  (md5(random()::text || clock_timestamp()::text), 'EAU', 'Eau / assainissement', true, CURRENT_TIMESTAMP),
  (md5(random()::text || clock_timestamp()::text), 'SECURITE', 'Securite', true, CURRENT_TIMESTAMP),
  (md5(random()::text || clock_timestamp()::text), 'AUTRE', 'Autre', true, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- Backfill : relie chaque plainte existante a la categorie correspondante
-- via l'ancien champ texte libre `category`.
UPDATE "Complaint" c
SET "categoryId" = cc."id"
FROM "ComplaintCategory" cc
WHERE c."category" = cc."code" AND c."categoryId" IS NULL;
