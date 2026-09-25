// @ts-nocheck
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { openAPI } from "better-auth/plugins";

// Drivers necessários para o Prisma v7
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

// Importação do client principal
import { PrismaClient } from "../generated/prisma/index.js";

// Instancia uma piscina de conexões nativa do Node/Linux para o Postgres
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

// Passa o adaptador físico validando as exigências do motor do Prisma v7
const prisma = new PrismaClient({ adapter });

export const auth = betterAuth({
  trustedOrigins: ["http://localhost:3000"],

  emailAndPassword: {
    enable: true,
  },
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  plugins: [openAPI()],
});
