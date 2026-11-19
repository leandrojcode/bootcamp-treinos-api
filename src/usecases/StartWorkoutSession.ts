import { prisma } from "../lib/db.js";
import {
  NotFoundError,
  WorkoutPlanNotActiveError,
  ConflictError,
} from "../errors/index.js";

export interface StartWorkoutSessionDTO {
  userId: string;
  workoutPlanId: string;
  workoutDayId: string;
}

export class StartWorkoutSession {
  execute = async (dto: StartWorkoutSessionDTO) => {
    // 1. Verifica se o WorkoutPlan existe e busca o dono
    const workoutPlan = await prisma.workoutPlan.findUnique({
      where: { id: dto.workoutPlanId },
    });

    if (!workoutPlan) {
      throw new NotFoundError("Plano de treino nao encontrado.");
    }

    // 2. Regra de Autenticacao: O usuario precisa ser o dono do plano
    if (workoutPlan.userId !== dto.userId) {
      throw new NotFoundError(
        "Plano de treino nao encontrado para este usuario.",
      );
    }

    // 3. Requisito Tecnico: Se nao estiver ativo, lanca WorkoutPlanNotActiveError
    if (!workoutPlan.isActive) {
      throw new WorkoutPlanNotActiveError();
    }

    // 4. Verifica se o dia de treino pertence a esse plano
    const workoutDay = await prisma.workoutDay.findFirst({
      where: {
        id: dto.workoutDayId,
        workoutPlanId: dto.workoutPlanId,
      },
    });

    if (!workoutDay) {
      throw new NotFoundError("Dia de treino nao encontrado neste plano.");
    }

    // 5. Regra de Negocio: Se ja tiver uma sessao iniciada hoje (startedAt presente), retorna 409
    const existingSession = await prisma.workoutSession.findFirst({
      where: {
        workoutDayId: dto.workoutDayId,
        // Checa se ja existe sessao aberta ou finalizada para esse dia (ajuste conforme seu schema)
        startedAt: { lte: new Date() },
      },
    });

    if (existingSession) {
      throw new ConflictError(
        "Este dia de treino ja possui uma sessao iniciada.",
      );
    }

    // 6. Cria a nova sessao no banco de dados (Note: Permite dia de descanso normalmente!)
    const session = await prisma.workoutSession.create({
      data: {
        workoutDayId: dto.workoutDayId,
        startedAt: new Date(),
      },
    });

    return {
      userWorkoutSessionId: session.id,
    };
  };
}
