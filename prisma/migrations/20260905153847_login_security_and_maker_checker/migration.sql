-- AlterTable
ALTER TABLE "DeathRecord" ADD COLUMN     "createdById" TEXT;

-- AlterTable
ALTER TABLE "Divorce" ADD COLUMN     "createdById" TEXT;

-- AlterTable
ALTER TABLE "Marriage" ADD COLUMN     "createdById" TEXT;

-- AlterTable
ALTER TABLE "Recognition" ADD COLUMN     "createdById" TEXT;

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "success" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LoginAttempt_email_createdAt_idx" ON "LoginAttempt"("email", "createdAt");

-- Immutabilite du journal d'audit au niveau base de donnees (module
-- securite, section 6) : jusqu'ici l'absence d'UPDATE/DELETE sur AuditLog
-- n'etait qu'une convention applicative (aucune route ne le fait), pas une
-- garantie reelle — un bug futur ou un acces direct a la base aurait pu
-- silencieusement modifier l'historique. Ce trigger refuse categoriquement
-- toute tentative d'UPDATE ou DELETE, quel que soit l'appelant (y compris
-- un compte applicatif compromis), sans dependre du nom du role de connexion.
CREATE OR REPLACE FUNCTION prevent_audit_log_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog est immuable (insertion seule) — operation % refusee.', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_immutable
BEFORE UPDATE OR DELETE ON "AuditLog"
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();
