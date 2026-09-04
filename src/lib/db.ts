import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  pgPool?: Pool;
};

// `max: 10` etait trop bas pour la charge visee (500-2000 utilisateurs
// concurrents) : plusieurs pages font 3-5 requetes paralleles via
// Promise.all, saturant le pool bien avant meme d'atteindre une charge
// elevee (voir audit performance 2026-09-02). Configurable via
// DATABASE_POOL_MAX pour l'ajuster au deploiement (budget de connexions
// Postgres reel, ou PgBouncer en amont) sans toucher au code.
const pool =
  globalForPrisma.pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL!,
    max: Number(process.env.DATABASE_POOL_MAX) || 25,
    idleTimeoutMillis: 60_000,
    connectionTimeoutMillis: 30_000,
  });

if (!globalForPrisma.pgPool) {
  pool.on("error", (err) => {
    console.error("[pg pool] idle client error (connection recycled):", err.message);
  });
}

const adapter = new PrismaPg(pool);

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.pgPool = pool;
}
