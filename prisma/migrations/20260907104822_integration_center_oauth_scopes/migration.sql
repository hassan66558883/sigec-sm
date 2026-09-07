-- Les 4 DROP INDEX generes automatiquement par Prisma ici ont ete retires :
-- ce sont les index trigram (pg_trgm) crees en SQL brut hors du schema
-- Prisma (migration 20260904153234_add_trgm_search_indexes), toujours
-- invisibles pour Prisma qui propose donc systematiquement de les supprimer
-- a chaque nouvelle migration (deja rencontre plusieurs fois).

-- AlterTable
ALTER TABLE "IntegrationCredential" ADD COLUMN     "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[];
