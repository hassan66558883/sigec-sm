import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // electron/** : processus principal Electron, CommonJS pur (pas de
  // "type":"module" dans package.json — c'est la convention attendue par
  // Electron pour main.js/preload.js), hors du perimetre TypeScript/ESM de
  // l'app Next.js que ce eslint-config-next est cense verifier.
  globalIgnores([".next/**", "out/**", "build/**", "release/**", "next-env.d.ts", "electron/**"]),
]);

export default eslintConfig;
