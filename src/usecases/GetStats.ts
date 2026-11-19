import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import { prisma } from "../lib/db.js";

dayjs.extend(utc);

export interface GetStatsDTO {
  userId: string;
  from: string;
  to: string;
}

export class GetStats {
  execute = async (dto: GetStatsDTO) => {
    const startRange = dayjs.utc(dto.from).startOf("day").toDate();
    const endRange = dayjs.utc(dto.to).endOf("day").toDate();

    // 1. Buscar todas as sessões no período fornecido
    const sessions = await prisma.workoutSession.findMany({
      where: {
        startedAt: {
          gte: startRange,
          lte: endRange,
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

    const totalSessionsCount = sessions.length;
    let completedWorkoutsCount = 0;
    let totalTimeInSeconds = 0;

    const consistencyByDay: Record<
      string,
      { workoutDayCompleted: boolean; workoutDayStarted: boolean }
    > = {};

    // 2. Mapear sessões e agrupar por data (YYYY-MM-DD)
    sessions.forEach((session) => {
      const dateKey = dayjs.utc(session.startedAt).format("YYYY-MM-DD");
      const isCompleted = session.completedAt !== null;

      if (isCompleted) {
        completedWorkoutsCount++;
        // Calcula a diferença em segundos entre completedAt e startedAt
        const diffSeconds = dayjs(session.completedAt).diff(
          dayjs(session.startedAt),
          "seconds",
        );
        totalTimeInSeconds += Math.max(0, diffSeconds);
      }

      // Se o dia já foi mapeado, mescla os estados (um "true" de completado mata um "false")
      if (consistencyByDay[dateKey]) {
        consistencyByDay[dateKey].workoutDayStarted = true;
        if (isCompleted) {
          consistencyByDay[dateKey].workoutDayCompleted = true;
        }
      } else {
        consistencyByDay[dateKey] = {
          workoutDayStarted: true,
          workoutDayCompleted: isCompleted,
        };
      }
    });

    // 3. Calcular a taxa de conclusão (conclusionRate)
    const conclusionRate =
      totalSessionsCount > 0 ? completedWorkoutsCount / totalSessionsCount : 0;

    // 4. Calcular o workoutStreak atual (dias seguidos completados retroativamente)
    let workoutStreak = 0;
    let checkDay = dayjs.utc().startOf("day"); // Começa a checagem a partir de hoje

    // Busca o plano ativo para validar regras de dias de descanso
    const activePlan = await prisma.workoutPlan.findFirst({
      where: { userId: dto.userId, isActive: true },
      include: { workoutDays: true },
    });

    while (true) {
      const checkDaySessions = await prisma.workoutSession.findFirst({
        where: {
          startedAt: {
            gte: checkDay.startOf("day").toDate(),
            lte: checkDay.endOf("day").toDate(),
          },
          completedAt: { not: null },
          workoutDay: { workoutPlan: { userId: dto.userId } },
        },
      });

      const currentDayName = checkDay.format("dddd").toUpperCase();
      const planDay = activePlan?.workoutDays.find(
        (d) => d.weekDay.toUpperCase() === currentDayName,
      );
      const isRestDay = planDay ? planDay.isRest : false;

      // Conta o streak se houver treino feito ou se for um dia válido de descanso planejado
      if (checkDaySessions || isRestDay) {
        workoutStreak++;
        checkDay = checkDay.subtract(1, "day");
      } else {
        break; // Corrente de treinos quebrada
      }
    }

    return {
      workoutStreak,
      consistencyByDay,
      completedWorkoutsCount,
      conclusionRate,
      totalTimeInSeconds,
    };
  };
}
