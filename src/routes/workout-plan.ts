import Fastify, { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { fromNodeHeaders } from "better-auth/node";

import { ErrorSchema, WorkoutPlanSchema } from "../schemas/index.js";
import { CreateWorkoutPlan } from "../usecases/CreateWorkoutPlan.js";
import { NotFoundError } from "../errors/index.js";
import { auth } from "../lib/auth.js";

// As rotas no Fastify são exportadas como funções assíncronas que recebem a instância do app
export const workoutPlanRoutes = async (app: FastifyInstance) => {
  app.withTypeProvider<ZodTypeProvider>().route({
    method: "POST",
    url: "/workout-plans",
    schema: {
      body: WorkoutPlanSchema,
      response: {
        201: z.any(),
        400: ErrorSchema,
        401: ErrorSchema,
        404: ErrorSchema,
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

        const { name, workoutDays } = request.body;

        const hasActiveDays = workoutDays.some((day) => !day.isRest);
        if (!hasActiveDays) {
          return reply.status(400).send({
            error:
              "O plano de treino precisa ter pelo menos um dia de treino ativo.",
            code: "INVALID_WORKOUT_PLAN",
          });
        }

        for (const day of workoutDays) {
          if (!day.isRest && (!day.exercises || day.exercises.length === 0)) {
            return reply.status(400).send({
              error: `O dia "${day.name}" está ativo, portanto precisa ter pelo menos um exercício cadastrado.`,
              code: "MISSING_EXERCISES",
            });
          }
        }

        const createWorkoutPlan = new CreateWorkoutPlan();
        const result = await createWorkoutPlan.execute({
          userId: session.user.id,
          name,
          workoutDays,
        });

        return reply.status(201).send(result);
      } catch (error) {
        app.log.error(error);

        if (error instanceof NotFoundError) {
          return reply.status(404).send({
            error: error.message,
            code: "NOT_FOUND_ERROR",
          });
        }

        return reply.status(500).send({
          error: "Internal server error",
          code: "INTERNAL_SERVER_ERROR",
        });
      }
    },
  });
};
