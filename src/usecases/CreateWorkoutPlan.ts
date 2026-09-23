import { Prisma, WeekDay } from "../generated/prisma/index.js";
import { prisma } from "../lib/db.js";

// Mantendo a nossa interface e renomeando o alias para InputDto se preferir,
// ou simplesmente mapeando a tipagem estrita aqui:
export interface CreateWorkoutPlanDTO {
  userId: string;
  name: string;
  workoutDays: Array<{
    name: string;
    weekDay: WeekDay;
    isRest: boolean;
    estimatedDurationInSeconds: number;
    exercises?: Array<{
      order: number;
      name: string;
      sets: number;
      reps: number;
      restTimeInSeconds: number;
    }>;
  }>;
}

export class CreateWorkoutPlan {
  // Usando a tipagem que criamos casando com a aula
  async execute(dto: CreateWorkoutPlanDTO) {
    // Busca se o usuário já possui algum plano de treino ativo
    const existingWorkoutPlan = await prisma.workoutPlan.findFirst({
      where: {
        userId: dto.userId,
        isActive: true,
      },
    });

    // Transação atômica idêntica à imagem
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      if (existingWorkoutPlan) {
        await tx.workoutPlan.update({
          where: { id: existingWorkoutPlan.id },
          data: { isActive: false },
        });
      }

      // Linha 42: Gravação salva na constante 'workoutPlan'
      const workoutPlan = await tx.workoutPlan.create({
        data: {
          name: dto.name,
          userId: dto.userId,
          isActive: true,
          workoutDays: {
            create: dto.workoutDays.map((workoutDay) => ({
              name: workoutDay.name,
              weekDay: workoutDay.weekDay,
              isRest: workoutDay.isRest,
              estimatedDurationInSeconds: workoutDay.estimatedDurationInSeconds,
              exercises:
                workoutDay.exercises && workoutDay.exercises.length > 0
                  ? {
                      create: workoutDay.exercises.map((exercise) => ({
                        name: exercise.name,
                        order: exercise.order,
                        sets: exercise.sets,
                        reps: exercise.reps,
                        restTimeInSeconds: exercise.restTimeInSeconds,
                      })),
                    }
                  : undefined,
            })) as any,
          },
        },
      });

      // Linha 66: Busca profunda com 'include' exatamente igual à foto da aula
      const result = await tx.workoutPlan.findUnique({
        where: { id: workoutPlan.id },
        include: {
          workoutDays: {
            include: {
              exercises: true,
            },
          },
        },
      });

      // Linha 76: Validação de segurança se o registro falhar
      if (!result) {
        throw new Error("Workout plan not found");
      }

      // Linha 79: Retorno do resultado completo populado
      return result;
    });
  }
}
