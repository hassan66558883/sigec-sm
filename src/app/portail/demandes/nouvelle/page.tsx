import { prisma } from "@/lib/db";
import { getCurrentCitizenAccount } from "@/lib/citizen-auth";
import { NewApplicationForm } from "./new-application-form";
import { PageHeading } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";

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
      <PageHeading title="Nouvelle demande" description="Demander une copie/extrait d'un acte qui vous concerne directement." />

      <Card>
        <NewApplicationForm
          birthRecordId={birthRecord?.id ?? null}
          marriages={marriages.map((m) => ({
            id: m.id,
            label: `Mariage avec ${m.husbandId === account.citizenId ? m.wife.firstName + " " + m.wife.lastName : m.husband.firstName + " " + m.husband.lastName} (${m.recordNumber})`,
          }))}
        />
      </Card>
    </div>
  );
}
