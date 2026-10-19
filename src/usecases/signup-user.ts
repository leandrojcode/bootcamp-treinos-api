import { randomUUID } from "node:crypto";

import { ConflictError } from "../errors/index.js";
import { prisma } from "../lib/db.js";

export interface SignupUserDTO {
  name: string;
  email: string;
}

export class SignupUser {
  execute = async (dto: SignupUserDTO) => {
    const existingUser = await prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictError("Já existe um usuário cadastrado com este e-mail.");
    }

    const now = new Date();

    return prisma.user.create({
      data: {
        id: randomUUID(),
        name: dto.name,
        email: dto.email,
        emailVerified: false,
        createdAt: now,
        updatedAt: now,
      },
    });
  };
}
