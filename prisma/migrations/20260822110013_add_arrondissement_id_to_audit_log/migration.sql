-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "arrondissementId" TEXT;

-- CreateIndex
CREATE INDEX "AuditLog_arrondissementId_createdAt_idx" ON "AuditLog"("arrondissementId", "createdAt");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_arrondissementId_fkey" FOREIGN KEY ("arrondissementId") REFERENCES "Arrondissement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
