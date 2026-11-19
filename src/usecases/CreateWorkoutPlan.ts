import { Prisma, WeekDay } from "../generated/prisma/index.js";
import { prisma } from "../lib/db.js";

export interface CreateWorkoutPlanDTO {
  userId: string;
  name: string;
  workoutDays: Array<{
    name: string;
    coverImageUrl?: string | null;
    weekDay: WeekDay;
    isRest: boolean;
    estimatedDurationSeconds: number;
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
  execute = async (dto: CreateWorkoutPlanDTO) => {
    const existingWorkoutPlan = await prisma.workoutPlan.findFirst({
      where: {
        userId: dto.userId,
        isActive: true,
      },
    });

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      if (existingWorkoutPlan) {
        await tx.workoutPlan.update({
          where: { id: existingWorkoutPlan.id },
          data: { isActive: false },
        });
      }

      const workoutPlan = await tx.workoutPlan.create({
        data: {
          name: dto.name,
          userId: dto.userId,
          isActive: true,
          workoutDays: {
            create: dto.workoutDays.map((workoutDay) => ({
              name: workoutDay.name,
              coverImageUrl: workoutDay.coverImageUrl,
              weekDay: workoutDay.weekDay,
              isRest: workoutDay.isRest,
              estimatedDurationSeconds: workoutDay.estimatedDurationSeconds,
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
            })),
          },
        },
      });

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

      if (!result) {
        throw new Error("Workout plan not found");
      }

      return result;
    });
  };
}
