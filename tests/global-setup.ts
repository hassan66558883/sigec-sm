// Execute une seule fois avant toute la suite : applique les migrations
// existantes a la base de test (jamais de --reset ici pour rester rapide
// et idempotent ; les fixtures generent des identifiants aleatoires pour
// eviter toute collision entre executions successives).
import { execSync } from "node:child_process";
import { config } from "dotenv";

export default function globalSetup() {
  config({ path: ".env.test", quiet: true });
  const env = { ...process.env, DATABASE_URL: process.env.DATABASE_URL };

  execSync("npx prisma migrate deploy", { stdio: "inherit", env });

  // Reutilise le seed reel (idempotent, upsert) plutot que de dupliquer la
  // liste des referentiels (types de certificats, regimes, taxes...) dans
  // les fixtures de test — evite toute derive entre les deux.
  execSync("npx tsx prisma/seed.ts", { stdio: "inherit", env });
}
