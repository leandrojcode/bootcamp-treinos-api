import { NotFoundError } from "../errors/index.js";
import { prisma } from "../lib/db.js";

export interface GetWorkoutPlanDTO {
  userId: string;
  workoutPlanId: string;
}

export class GetWorkoutPlan {
  execute = async (dto: GetWorkoutPlanDTO) => {
    // 1. Busca o plano garantindo que ele pertença ao usuário logado
    const workoutPlan = await prisma.workoutPlan.findFirst({
      where: {
        id: dto.workoutPlanId,
        userId: dto.userId,
      },
      include: {
        workoutDays: {
          include: {
            _count: {
              select: { exercises: true },
            },
          },
        },
      },
    });

    // 2. Se não encontrar o plano ou não for do usuário, lança erro de NotFound por segurança
    if (!workoutPlan) {
      throw new NotFoundError("Plano de treino não encontrado.");
    }

    // 3. Formata o retorno ocultando a lista de exercícios e expondo apenas o contador
    return {
      id: workoutPlan.id,
      name: workoutPlan.name,
      workoutDays: workoutPlan.workoutDays.map((day) => ({
        id: day.id,
        weekDay: day.weekDay,
        name: day.name,
        isRest: day.isRest,
        coverImageUrl: day.coverImageUrl ?? undefined,
        estimatedDurationInSeconds: day.estimatedDurationSeconds,
        exercisesCount: day._count.exercises,
      })),
    };
  };
}
