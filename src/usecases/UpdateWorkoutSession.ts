import { NotFoundError } from "../errors/index.js";
import { prisma } from "../lib/db.js";

export interface UpdateWorkoutSessionDTO {
  userId: string;
  workoutPlanId: string;
  workoutDayId: string;
  workoutSessionId: string;
  completedAt: string;
}

export class UpdateWorkoutSession {
  execute = async (dto: UpdateWorkoutSessionDTO) => {
    // 1. Verifica se o WorkoutPlan existe e se pertence ao usuário
    const workoutPlan = await prisma.workoutPlan.findUnique({
      where: { id: dto.workoutPlanId },
    });

    if (!workoutPlan || workoutPlan.userId !== dto.userId) {
      throw new NotFoundError("Plano de treino não encontrado.");
    }

    // 2. Verifica se a sessão existe e pertence ao dia/plano corretos
    const session = await prisma.workoutSession.findUnique({
      where: { id: dto.workoutSessionId },
      include: {
        workoutDay: true,
      },
    });

    if (
      !session ||
      session.workoutDayId !== dto.workoutDayId ||
      session.workoutDay.workoutPlanId !== dto.workoutPlanId
    ) {
      throw new NotFoundError("Sessão de treino não encontrada.");
    }

    // 3. Atualiza a sessão preenchendo o campo completedAt/finishedAt
    const updatedSession = await prisma.workoutSession.update({
      where: { id: dto.workoutSessionId },
      data: {
        // Mapeie aqui para a sua coluna exata do banco (ex: completedAt ou finishedAt)
        completedAt: new Date(dto.completedAt),
      },
    });

    return {
      id: updatedSession.id,
      completedAt: updatedSession.completedAt!.toISOString(),
      startedAt: updatedSession.startedAt.toISOString(),
    };
  };
}
