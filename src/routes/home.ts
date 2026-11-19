import { fromNodeHeaders } from "better-auth/node";
import { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

import { ErrorSchema } from "../schemas/index.js";
import { auth } from "../lib/auth.js";
import { GetHomeData } from "../usecases/GetHomeData.js";

export const homeRoutes = async (app: FastifyInstance) => {
  app.withTypeProvider<ZodTypeProvider>().route({
    method: "GET",
    url: "/home/:date",
    schema: {
      tags: ["Home"],
      summary: "Get home dashboard data",
      params: z.object({
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato deve ser YYYY-MM-DD"),
      }),
      response: {
        200: z.object({
          activeWorkoutPlanId: z.string(),
          todayWorkoutDay: z
            .object({
              workoutPlanId: z.string().uuid(),
              id: z.string().uuid(),
              name: z.string(),
              isRest: z.boolean(),
              weekDay: z.string(),
              estimatedDurationInSeconds: z.number(),
              coverImageUrl: z.string().optional(),
              exercisesCount: z.number(),
            })
            .nullable(),
          workoutStreak: z.number(),
          consistencyByDay: z.record(
            z.string(),
            z.object({
              workoutDayCompleted: z.boolean(),
              workoutDayStarted: z.boolean(),
            }),
          ),
        }),
        401: ErrorSchema,
        500: ErrorSchema,
      },
    },
    handler: async (request, reply) => {
      try {
        const session = await auth.api.getSession({
          headers: fromNodeHeaders(request.headers),
        });

        if (!session) {
          return reply.status(401).send({
            error: "Unauthorized",
            code: "UNAUTHORIZED",
          });
        }

        const { date } = request.params;

        const getHomeData = new GetHomeData();
        const result = await getHomeData.execute({
          userId: session.user.id,
          date,
        });

        return reply.status(200).send(result);
      } catch (error) {
        app.log.error(error);
        return reply.status(500).send({
          error: "Internal server error",
          code: "INTERNAL_SERVER_ERROR",
        });
      }
    },
  });
};
