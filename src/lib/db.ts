import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { PrismaClient } from "../generated/prisma/index.js";

// 1. Cria a piscina de conexões nativa do Linux para o PostgreSQL do Docker
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);

// 2. Instancia o cliente do Prisma v7 passando o adaptador obrigatório
export const prisma = new PrismaClient({ adapter });
