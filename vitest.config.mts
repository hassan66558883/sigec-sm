import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    globalSetup: ["./tests/global-setup.ts"],
    setupFiles: ["./tests/setup.ts"],
    testTimeout: 20_000,
    hookTimeout: 30_000,
    // Sequentiel : les tests partagent la meme base Postgres de test et
    // certaines assertions (ex. agregation des recettes) supposent un
    // etat connu au moment ou elles s'executent.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
});
