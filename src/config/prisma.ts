import "dotenv/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

const globalForPrisma = global as unknown as {
    prisma: PrismaClient;
};

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
}

const pool = new pg.Pool({ connectionString });

const adapter = new PrismaPg(pool);

let prisma: PrismaClient;

if (globalForPrisma.prisma) {
    prisma = globalForPrisma.prisma;
} else {
    prisma = new PrismaClient({
        adapter,
        log: ["error", "warn"],
    });
    
    if (process.env.NODE_ENV !== "production") {
        globalForPrisma.prisma = prisma;
    }
}

export default prisma;