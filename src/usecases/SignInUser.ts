import { z } from "zod";
import { prisma } from "../lib/db.js";
import { NotFoundError } from "../errors/index.js";

// Usando Interface e Named Export seguindo a regra typescript.md
export interface SignInUserDTO {
  email: string;
}

export class SignInUser {
  // Obrigatoriamente usando Arrow Function exigida no curso
  execute = async (dto: SignInUserDTO) => {
    // Verifica se o usuário de fato existe no banco do Docker
    const user = await prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new NotFoundError("Usuário não encontrado com o e-mail informado.");
    }

    return user;
  };
}
