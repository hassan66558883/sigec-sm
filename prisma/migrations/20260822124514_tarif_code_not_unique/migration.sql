-- DropIndex
DROP INDEX "TarifMunicipal_code_key";

-- CreateIndex
CREATE INDEX "TarifMunicipal_code_idx" ON "TarifMunicipal"("code");

