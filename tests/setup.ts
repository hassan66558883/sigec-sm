// Charge .env.test avant chaque fichier de test (globalSetup ne partage pas
// son environnement process avec les workers de test).
import { config } from "dotenv";

config({ path: ".env.test", quiet: true });
