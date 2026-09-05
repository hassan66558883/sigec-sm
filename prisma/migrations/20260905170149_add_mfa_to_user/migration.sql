-- Les 4 DROP INDEX generes automatiquement par Prisma ci-dessus dans la
-- version brute de cette migration ont ete retires : ce sont les index
-- trigram (pg_trgm) crees via SQL brut hors du schema Prisma (voir migration
-- 20260904153234_add_trgm_search_indexes), que Prisma ne "voit" pas et
-- propose donc systematiquement de supprimer a chaque nouvelle migration —
-- comportement recurrent deja rencontre, jamais une suppression voulue.

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "mfaBackupCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mfaEnabledAt" TIMESTAMP(3),
ADD COLUMN     "mfaSecret" TEXT;
