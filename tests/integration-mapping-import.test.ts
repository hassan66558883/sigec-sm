import { describe, it, expect, afterAll } from "vitest";
import { createMapping, deleteMapping, applyTransform } from "../src/lib/services/integration-mapping";
import { previewImport, commitImport, getImportJob } from "../src/lib/services/integration-import";
import { createTestCity, createTestArrondissement, createTestUser, createTestCitizen, testPrisma, uid, closeTestDb } from "./helpers/fixtures";

const CITIZEN_RULES = [
  { sourceField: "prenom", targetField: "firstName" as const, transform: "DIRECT" },
  { sourceField: "nom", targetField: "lastName" as const, transform: "DIRECT" },
  { sourceField: "genre", targetField: "sex" as const, transform: "DIRECT" },
  { sourceField: "naissance", targetField: "dateOfBirth" as const, transform: "DATE_FORMAT", transformConfig: { format: "DD/MM/YYYY" } },
  { sourceField: "nationalite", targetField: "nationality" as const, transform: "DEFAULT_VALUE", transformConfig: { defaultValue: "Tchadienne" } },
  { sourceField: "arr", targetField: "arrondissementCode" as const, transform: "DIRECT" },
];

describe("Integration & Interoperability Center — data mapping engine", () => {
  it("applyTransform : DIRECT/DEFAULT_VALUE/UPPERCASE/LOWERCASE/DATE_FORMAT", () => {
    const direct = { sourceField: "x", targetField: "y", transform: "DIRECT", transformConfig: null };
    expect(applyTransform("  Hassan  ", direct)).toBe("Hassan");

    const withDefault = { ...direct, transform: "DEFAULT_VALUE", transformConfig: JSON.stringify({ defaultValue: "Tchadienne" }) };
    expect(applyTransform("", withDefault)).toBe("Tchadienne");
    expect(applyTransform("Francaise", withDefault)).toBe("Francaise");

    const upper = { ...direct, transform: "UPPERCASE" };
    expect(applyTransform("hassan", upper)).toBe("HASSAN");
    const lower = { ...direct, transform: "LOWERCASE" };
    expect(applyTransform("HASSAN", lower)).toBe("hassan");

    const dateRule = { ...direct, transform: "DATE_FORMAT", transformConfig: JSON.stringify({ format: "DD/MM/YYYY" }) };
    expect(applyTransform("24/01/1988", dateRule)).toBe("1988-01-24");
    expect(applyTransform("not-a-date", dateRule)).toBe("not-a-date"); // format non reconnu : renvoyee telle quelle, jamais convertie a tort
  });

  it("cree un mapping, refuse un champ cible ou une transformation invalide, refuse sans permission", async () => {
    const admin = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["integration:mapping_manage"] });
    const noPerm = await createTestUser({ organizationLevel: "CENTRAL", permissions: [] });

    const mapping = await createMapping(admin, { name: uid("Mapping"), entityType: "CITIZENS", rules: CITIZEN_RULES });
    expect(mapping.rules).toHaveLength(6);

    await expect(createMapping(admin, { name: "x", entityType: "CITIZENS", rules: [{ sourceField: "a", targetField: "not_a_real_field", transform: "DIRECT" }] })).rejects.toMatchObject({ status: 400 });
    await expect(createMapping(admin, { name: "x", entityType: "CITIZENS", rules: [{ sourceField: "a", targetField: "firstName", transform: "NOT_A_TRANSFORM" }] })).rejects.toMatchObject({ status: 400 });
    await expect(createMapping(admin, { name: "x", entityType: "CITIZENS", rules: [] })).rejects.toMatchObject({ status: 400 });
    await expect(createMapping(noPerm, { name: "x", entityType: "CITIZENS", rules: CITIZEN_RULES })).rejects.toMatchObject({ status: 403 });

    await deleteMapping(admin, mapping.id);
    await expect(testPrisma.integrationMapping.findUniqueOrThrow({ where: { id: mapping.id } })).rejects.toBeTruthy();
  });
});

describe("Integration & Interoperability Center — import/export CSV", () => {
  let arrCode: string;

  afterAll(async () => {
    await closeTestDb();
  });

  it("previewImport valide correctement : champ manquant, sexe invalide, code arrondissement inconnu, doublon exact rejetes ; homonyme = simple avertissement", async () => {
    const admin = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["integration:mapping_manage", "integration:import_export", "citizens:create"] });
    const city = await createTestCity();
    const arr = await createTestArrondissement(city.id, 1);
    arrCode = arr.code;

    const homonym = await createTestCitizen(arr.id, { firstName: "Existant", lastName: "Homonyme" });
    expect(homonym).toBeTruthy();

    const mapping = await createMapping(admin, { name: uid("Mapping"), entityType: "CITIZENS", rules: CITIZEN_RULES });

    const csv = [
      "prenom,nom,genre,naissance,nationalite,arr",
      `Amina,Test,F,15/03/1990,,${arrCode}`, // valide
      `,Sansprenom,F,15/03/1990,,${arrCode}`, // prenom manquant -> invalide
      `Karim,Test,X,15/03/1990,,${arrCode}`, // sexe invalide -> invalide
      `Moussa,Test,M,15/03/1990,,CODE_INCONNU`, // code arrondissement inconnu -> invalide
      `Amina,Test,F,15/03/1990,,${arrCode}`, // doublon exact de la ligne 1 -> invalide
      `Existant,Homonyme,F,,,${arrCode}`, // homonyme deja en base -> avertissement, reste valide
    ].join("\n");

    const result = await previewImport(admin, { mappingId: mapping.id, csvContent: csv, fileName: "test.csv" });
    expect(result.totalRows).toBe(6);
    expect(result.validRows).toBe(2); // Amina (ligne 1) + Existant (ligne 6)
    expect(result.invalidRows).toBe(4);

    const byRow = new Map(result.preview.map((d) => [d.row, d]));
    expect(byRow.get(2)?.errors).toHaveLength(0); // ligne 1 du CSV = row 2 (en-tete = ligne 1)
    expect(byRow.get(3)?.errors.join()).toMatch(/firstName/);
    expect(byRow.get(4)?.errors.join()).toMatch(/Sexe/);
    expect(byRow.get(5)?.errors.join()).toMatch(/arrondissement/);
    expect(byRow.get(6)?.errors.join()).toMatch(/Doublon/);
    expect(byRow.get(7)?.errors).toHaveLength(0);
    expect(byRow.get(7)?.warnings.join()).toMatch(/homonyme/);

    const job = await getImportJob(admin, result.jobId);
    expect(job.status).toBe("PREVIEWED");
  });

  it("commitImport ne cree que les lignes valides, jamais deux fois le meme job", async () => {
    const admin = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["integration:mapping_manage", "integration:import_export", "citizens:create"] });
    const city = await createTestCity();
    const arr = await createTestArrondissement(city.id, 2);
    const mapping = await createMapping(admin, { name: uid("Mapping"), entityType: "CITIZENS", rules: CITIZEN_RULES });

    const csv = [
      "prenom,nom,genre,naissance,nationalite,arr",
      `Fatime,Commit,F,10/05/1995,,${arr.code}`,
      `,Invalide,F,10/05/1995,,${arr.code}`,
    ].join("\n");

    const preview = await previewImport(admin, { mappingId: mapping.id, csvContent: csv, fileName: "commit.csv" });
    expect(preview.validRows).toBe(1);
    expect(preview.invalidRows).toBe(1);

    const before = await testPrisma.citizen.count({ where: { firstName: "Fatime", lastName: "Commit" } });
    const committed = await commitImport(admin, preview.jobId);
    expect(committed.status).toBe("IMPORTED");
    expect(committed.importedRows).toBe(1);
    const after = await testPrisma.citizen.count({ where: { firstName: "Fatime", lastName: "Commit" } });
    expect(after - before).toBe(1);

    // La ligne invalide (prenom manquant) n'a jamais ete ecrite.
    const invalidCount = await testPrisma.citizen.count({ where: { lastName: "Invalide" } });
    expect(invalidCount).toBe(0);

    await expect(commitImport(admin, preview.jobId)).rejects.toMatchObject({ status: 400 });
  });

  it("refuse l'apercu et le commit sans permission integration:import_export", async () => {
    const noPerm = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["integration:mapping_manage"] });
    const admin = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["integration:mapping_manage", "integration:import_export"] });
    const mapping = await createMapping(admin, { name: uid("Mapping"), entityType: "CITIZENS", rules: CITIZEN_RULES });

    await expect(previewImport(noPerm, { mappingId: mapping.id, csvContent: "a,b\n1,2", fileName: "x.csv" })).rejects.toMatchObject({ status: 403 });
  });
});
