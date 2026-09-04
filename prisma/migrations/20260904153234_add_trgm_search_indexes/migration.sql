-- Index trigram (pg_trgm) pour les recherches par sous-chaine (WHERE ...
-- contains, mode "insensitive") qu'aucun index btree standard ne peut
-- accelerer : Postgres retombe sur un scan sequentiel sur ces colonnes
-- malgre les index @unique/@@index deja presents dans le schema (voir audit
-- performance 2026-09-02 pour le detail des requetes concernees :
-- src/lib/services/citizens.ts:listCitizens/listCitizensPage,
-- src/lib/services/payments.ts:listPayments/listPaymentsPage).
-- Purement additif : aucune donnee touchee, aucun risque pour les migrations
-- existantes.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Citizen_firstName_trgm_idx" ON "Citizen" USING GIN ("firstName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Citizen_lastName_trgm_idx" ON "Citizen" USING GIN ("lastName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Citizen_uniqueNumber_trgm_idx" ON "Citizen" USING GIN ("uniqueNumber" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Payment_receiptNumber_trgm_idx" ON "Payment" USING GIN ("receiptNumber" gin_trgm_ops);
