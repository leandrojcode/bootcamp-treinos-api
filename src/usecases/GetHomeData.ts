import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import { prisma } from "../lib/db.js";

dayjs.extend(utc);

export interface GetHomeDataDTO {
  userId: string;
  date: string; // Formato YYYY-MM-DD
}

export class GetHomeData {
  execute = async (dto: GetHomeDataDTO) => {
    const targetDate = dayjs.utc(dto.date).startOf("day");

    // 1. Calcular o início (domingo) e fim (sábado) da semana correspondente em UTC
    const startOfWeek = targetDate.startOf("week"); // Domingo 00:00:00
    const endOfWeek = targetDate.endOf("week"); // Sábado 23:59:59

    // 2. Buscar o plano de treino ativo do usuário
    const activePlan = await prisma.workoutPlan.findFirst({
      where: {
        userId: dto.userId,
        isActive: true,
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

    if (!activePlan) {
      return {
        activeWorkoutPlanId: "",
        todayWorkoutDay: null,
        workoutStreak: 0,
        consistencyByDay: {},
      };
    }

    // 3. Procurar o dia correspondente à data atual (baseado no dia da semana: "SUNDAY", "MONDAY", etc.)
    const currentWeekDayName = targetDate.format("dddd").toUpperCase(); // Adapte se seu banco salva de outra forma
    const todayWorkoutDayRaw = activePlan.workoutDays.find(
      (day) => day.weekDay.toUpperCase() === currentWeekDayName,
    );

    const todayWorkoutDay = todayWorkoutDayRaw
      ? {
          workoutPlanId: activePlan.id,
          id: todayWorkoutDayRaw.id,
          name: todayWorkoutDayRaw.name,
          isRest: todayWorkoutDayRaw.isRest,
          weekDay: todayWorkoutDayRaw.weekDay,
          estimatedDurationInSeconds:
            todayWorkoutDayRaw.estimatedDurationSeconds,
          coverImageUrl: todayWorkoutDayRaw.coverImageUrl ?? undefined,
          exercisesCount: todayWorkoutDayRaw._count.exercises,
        }
      : null;

    // 4. Buscar todas as WorkoutSession do usuário na semana correspondente
    const sessions = await prisma.workoutSession.findMany({
      where: {
        startedAt: {
          gte: startOfWeek.toDate(),
          lte: endOfWeek.toDate(),
        },
        workoutDay: {
          workoutPlan: {
            userId: dto.userId,
          },
        },
      },
      include: {
        workoutDay: true,
      },
    });

    // 5. Montar o consistencyByDay preenchendo TODOS os 7 dias da semana
    const consistencyByDay: Record<
      string,
      { workoutDayCompleted: boolean; workoutDayStarted: boolean }
    > = {};

    for (let i = 0; i < 7; i++) {
      const currentDay = startOfWeek.add(i, "day");
      const dateKey = currentDay.format("YYYY-MM-DD");

      // Acha se houve alguma sessão iniciada nesse dia específico do calendário
      const sessionsOfParamsDay = sessions.filter(
        (s) => dayjs.utc(s.startedAt).format("YYYY-MM-DD") === dateKey,
      );

      const hasStarted = sessionsOfParamsDay.length > 0;
      const hasCompleted = sessionsOfParamsDay.some(
        (s) => s.completedAt !== null,
      );

      consistencyByDay[dateKey] = {
        workoutDayStarted: hasStarted,
        workoutDayCompleted: hasCompleted,
      };
    }

    // 6. Cálculo simplificado de workoutStreak (Dias seguidos com treino completo/concluído)
    // Varre de trás para frente a partir de hoje contando os dias consecutivos salvos
    let workoutStreak = 0;
    let checkDay = targetDate;

    while (true) {
      const checkKey = checkDay.format("YYYY-MM-DD");

      // Busca se o dia em questão está marcado como completado no histórico geral
      const daySessions = await prisma.workoutSession.findFirst({
        where: {
          startedAt: {
            gte: checkDay.startOf("day").toDate(),
            lte: checkDay.endOf("day").toDate(),
          },
          completedAt: { not: null },
          workoutDay: { workoutPlan: { userId: dto.userId } },
        },
      });

      // Se o plano diz que é dia de descanso, conta para o streak por padrão se os anteriores forem válidos
      const planDay = activePlan.workoutDays.find(
        (day) =>
          day.weekDay.toUpperCase() === checkDay.format("dddd").toUpperCase(),
      );
      const isRestDay = planDay ? planDay.isRest : false;

      if (daySessions || isRestDay) {
        workoutStreak++;
        checkDay = checkDay.subtract(1, "day");
      } else {
        break; // Quebrou a corrente consecutiva
      }
    }

    return {
      activeWorkoutPlanId: activePlan.id,
      todayWorkoutDay,
      workoutStreak,
      consistencyByDay,
    };
  };
}
