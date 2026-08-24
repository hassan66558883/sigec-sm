-- CreateTable
CREATE TABLE "ObligationReminder" (
    "id" TEXT NOT NULL,
    "obligationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notified" BOOLEAN NOT NULL DEFAULT false,
    "smsSent" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ObligationReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ObligationReminder_obligationId_type_key" ON "ObligationReminder"("obligationId", "type");

-- AddForeignKey
ALTER TABLE "ObligationReminder" ADD CONSTRAINT "ObligationReminder_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "ObligationPaiement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

