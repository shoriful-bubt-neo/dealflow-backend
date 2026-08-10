import "dotenv/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);

/** Always create a fresh client — avoids stale DMMF after `prisma generate`. */
const prisma = new PrismaClient({
  adapter,
  log: ["error", "warn"],
});

export default prisma;