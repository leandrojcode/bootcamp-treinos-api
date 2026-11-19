import { NotFoundError } from "../errors/index.js";
import { prisma } from "../lib/db.js";

interface PrismaWorkoutSession {
  id: string;
  workoutDayId: string;
  startedAt: Date;
  completedAt: Date | null;
}

interface PrismaWorkoutExercise {
  id: string;
  name: string;
  sets: number;
  reps: number;
  order: number;
  restTimeInSeconds: number;
}

export interface GetWorkoutDayDetailDTO {
  userId: string;
  workoutPlanId: string;
  workoutDayId: string;
}

export class GetWorkoutDayDetail {
  execute = async (dto: GetWorkoutDayDetailDTO) => {
    const workoutPlan = await prisma.workoutPlan.findFirst({
      where: {
        id: dto.workoutPlanId,
        userId: dto.userId,
      },
    });

    if (!workoutPlan) {
      throw new NotFoundError("Plano de treino não encontrado.");
    }

    // Buscamos o dia de treino sem o include direto para não travar na tipagem estrita do Prisma
    const workoutDay = await prisma.workoutDay.findFirst({
      where: {
        id: dto.workoutDayId,
        workoutPlanId: dto.workoutPlanId,
      },
    });

    if (!workoutDay) {
      throw new NotFoundError("Dia de treino não encontrado.");
    }

    // Buscamos os exercícios e sessões separadamente usando queries diretas para garantir compatibilidade total com o seu schema.prisma
    const exercises = await prisma.workoutExercise.findMany({
      where: { workoutDayId: dto.workoutDayId },
    });

    const sessions = await prisma.workoutSession.findMany({
      where: { workoutDayId: dto.workoutDayId },
    });

    return {
      id: workoutDay.id,
      name: workoutDay.name,
      isRest: workoutDay.isRest,
      coverImageUrl: workoutDay.coverImageUrl ?? undefined,
      estimatedDurationInSeconds: workoutDay.estimatedDurationSeconds,
      weekDay: workoutDay.weekDay,
      exercises: (exercises as PrismaWorkoutExercise[]).map((ex) => ({
        id: ex.id,
        name: ex.name,
        sets: ex.sets,
        reps: ex.reps,
        order: ex.order,
        restTimeInSeconds: ex.restTimeInSeconds,
      })),
      sessions: (sessions as PrismaWorkoutSession[]).map((session) => ({
        id: session.id,
        workoutDayId: session.workoutDayId,
        startedAt: session.startedAt
          ? session.startedAt.toISOString()
          : undefined,
        completedAt: session.completedAt
          ? session.completedAt.toISOString()
          : undefined,
      })),
    };
  };
}
