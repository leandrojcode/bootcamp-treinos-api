import { prisma } from "../lib/auth.js";

interface InputDto {
  userId: string;
  weightInGrams: number;
  heightInCentimeters: number;
  age: number;
  bodyFatPercentage: number;
}

export class UpsertUserTrainData {
  async execute(input: InputDto) {
    // Atualiza os dados físicos do usuário no banco
    const updatedUser = await prisma.user.update({
      where: {
        id: input.userId,
      },
      data: {
        weightInGrams: input.weightInGrams,
        heightInCentimeters: input.heightInCentimeters,
        age: input.age,
        bodyFatPercentage: input.bodyFatPercentage,
      },
    });

    // Retorna os dados garantindo a tipagem para o TypeScript
    return {
      userId: updatedUser.id,
      weightInGrams: updatedUser.weightInGrams ?? input.weightInGrams,
      heightInCentimeters:
        updatedUser.heightInCentimeters ?? input.heightInCentimeters,
      age: updatedUser.age ?? input.age,
      bodyFatPercentage:
        updatedUser.bodyFatPercentage ?? input.bodyFatPercentage,
    };
  }
}
