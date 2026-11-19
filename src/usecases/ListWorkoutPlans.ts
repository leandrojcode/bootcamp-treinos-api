import { prisma } from "../lib/db.js";

export interface ListWorkoutPlansDTO {
  userId: string;
  active?: boolean;
}

export class ListWorkoutPlans {
  execute = async (dto: ListWorkoutPlansDTO) => {
    const whereCondition: any = {
      userId: dto.userId,
    };

    if (dto.active !== undefined) {
      whereCondition.isActive = dto.active;
    }

    const workoutPlans = await prisma.workoutPlan.findMany({
      where: whereCondition,
      include: {
        workoutDays: {
          include: {
            exercises: {
              orderBy: {
                order: "asc",
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return {
      workoutPlans: workoutPlans.map((plan) => ({
        id: plan.id,
        name: plan.name,
        isActive: plan.isActive,
        workoutDays: plan.workoutDays.map((day) => ({
          id: day.id,
          name: day.name,
          weekDay: day.weekDay,
          isRest: day.isRest,
          coverImageUrl: day.coverImageUrl ?? undefined,
          estimatedDurationSeconds: day.estimatedDurationSeconds,
          exercises: day.exercises.map((ex) => ({
            id: ex.id,
            name: ex.name,
            sets: ex.sets,
            reps: ex.reps,
            order: ex.order,
            restTimeInSeconds: ex.restTimeInSeconds,
          })),
        })),
      })),
    };
  };
}
