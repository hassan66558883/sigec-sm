import { NextResponse } from "next/server";
import { getCurrentCitizenAccount } from "@/lib/citizen-auth";

export async function GET() {
  const account = await getCurrentCitizenAccount();
  if (!account) return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  return NextResponse.json({
    data: {
      email: account.email,
      citizen: {
        uniqueNumber: account.citizen.uniqueNumber,
        firstName: account.citizen.firstName,
        lastName: account.citizen.lastName,
        arrondissement: account.citizen.arrondissement.name,
      },
    },
  });
}
