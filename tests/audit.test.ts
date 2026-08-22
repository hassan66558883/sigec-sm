import { describe, it, expect, afterAll } from "vitest";
import * as auditModule from "../src/lib/audit";
import { logAudit } from "../src/lib/audit";
import { createTestUser, closeTestDb, testPrisma } from "./helpers/fixtures";

describe("journal d'audit (section 22/38)", () => {
  afterAll(async () => {
    await closeTestDb();
  });

  it("enregistre une entree complete avec avant/apres", async () => {
    const agent = await createTestUser({ permissions: [] });

    await logAudit({
      user: agent,
      action: "UPDATE",
      module: "territorial",
      entityType: "Arrondissement",
      entityId: "test-entity-id",
      oldValue: { isActive: true },
      newValue: { isActive: false },
      ipAddress: "203.0.113.7",
    });

    const entry = await testPrisma.auditLog.findFirst({
      where: { entityType: "Arrondissement", entityId: "test-entity-id" },
      orderBy: { createdAt: "desc" },
    });

    expect(entry).not.toBeNull();
    expect(entry?.userId).toBe(agent.id);
    expect(entry?.userName).toBe(agent.name);
    expect(entry?.action).toBe("UPDATE");
    expect(entry?.oldValue).toEqual({ isActive: true });
    expect(entry?.newValue).toEqual({ isActive: false });
    expect(entry?.ipAddress).toBe("203.0.113.7");
    expect(entry?.result).toBe("SUCCESS");
  });

  it("accepte un acteur systeme (user: null) sans lever d'erreur", async () => {
    await expect(
      logAudit({ user: null, action: "LOGIN_FAILED", module: "auth", result: "FAILURE" }),
    ).resolves.not.toThrow();

    const entry = await testPrisma.auditLog.findFirst({
      where: { action: "LOGIN_FAILED", module: "auth" },
      orderBy: { createdAt: "desc" },
    });
    expect(entry?.userName).toBe("Systeme");
    expect(entry?.result).toBe("FAILURE");
  });

  it("n'expose aucune fonction de modification/suppression — ecriture au seul travers de logAudit()", () => {
    const exportedNames = Object.keys(auditModule);
    expect(exportedNames).toContain("logAudit");
    expect(exportedNames).not.toContain("updateAuditLog");
    expect(exportedNames).not.toContain("deleteAuditLog");
  });
});
