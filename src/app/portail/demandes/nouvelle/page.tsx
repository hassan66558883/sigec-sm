import { prisma } from "@/lib/db";
import { getCurrentCitizenAccount } from "@/lib/citizen-auth";
import { NewApplicationForm } from "./new-application-form";

export default async function NewApplicationPage() {
  const account = await getCurrentCitizenAccount();
  if (!account) return null;

  const [birthRecord, marriages] = await Promise.all([
    prisma.birthRecord.findFirst({ where: { childId: account.citizenId, status: "REGISTERED" } }),
    prisma.marriage.findMany({
      where: { OR: [{ husbandId: account.citizenId }, { wifeId: account.citizenId }], status: "VALID" },
      include: { husband: true, wife: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[var(--color-text)]">Nouvelle demande</h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          Demander une copie/extrait d&apos;un acte qui vous concerne directement.
        </p>
      </div>

      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm">
        <NewApplicationForm
          birthRecordId={birthRecord?.id ?? null}
          marriages={marriages.map((m) => ({
            id: m.id,
            label: `Mariage avec ${m.husbandId === account.citizenId ? m.wife.firstName + " " + m.wife.lastName : m.husband.firstName + " " + m.husband.lastName} (${m.recordNumber})`,
          }))}
        />
      </div>
    </div>
  );
}
