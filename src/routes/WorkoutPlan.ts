import { fromNodeHeaders } from "better-auth/node";
import { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

import {
  ConflictError,
  NotFoundError,
  WorkoutPlanNotActiveError,
} from "../errors/index.js";
import { WeekDay } from "../generated/prisma/index.js";
import { auth } from "../lib/auth.js";
import { ErrorSchema, WorkoutPlanSchema } from "../schemas/index.js";

import { CreateWorkoutPlan } from "../usecases/CreateWorkoutPlan.js";
import { GetWorkoutPlan } from "../usecases/GetWorkoutPlan.js";
import { ListWorkoutPlans } from "../usecases/ListWorkoutPlans.js"; // Importe atualizado
import { GetWorkoutDayDetail } from "../usecases/GetWorkoutDayDetail.js";
import { StartWorkoutSession } from "../usecases/StartWorkoutSession.js";
import { UpdateWorkoutSession } from "../usecases/UpdateWorkoutSession.js";

export const workoutPlanRoutes = async (app: FastifyInstance) => {
  const withTypeProvider = app.withTypeProvider<ZodTypeProvider>();

  // ROTA 01: Criar Plano de Treino
  withTypeProvider.route({
    method: "POST",
    url: "/workout-plans",
    schema: {
      tags: ["Workout Plan"],
      summary: "Create a workout plan",
      body: WorkoutPlanSchema,
      response: {
        201: WorkoutPlanSchema,
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
          return reply
            .status(401)
            .send({ error: "Unauthorized", code: "UNAUTHORIZED" });
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

        const dayWithoutExercises = workoutDays.find(
          (day) =>
            !day.isRest && (!day.exercises || day.exercises.length === 0),
        );
        if (dayWithoutExercises) {
          return reply.status(400).send({
            error: `O dia "${dayWithoutExercises.name}" está ativo, portanto precisa ter pelo menos um exercício cadastrado.`,
            code: "MISSING_EXERCISES",
          });
        }

        const createWorkoutPlan = new CreateWorkoutPlan();
        const result = await createWorkoutPlan.execute({
          userId: session.user.id,
          name,
          workoutDays: workoutDays.map((workoutDay) => ({
            name: workoutDay.name,
            coverImageUrl: workoutDay.coverImageUrl,
            weekDay: workoutDay.weekDay as WeekDay,
            isRest: workoutDay.isRest,
            estimatedDurationSeconds: workoutDay.estimatedDurationSeconds,
            exercises: workoutDay.exercises,
          })),
        });

        return reply.status(201).send(result);
      } catch (error) {
        app.log.error(error);
        if (error instanceof NotFoundError) {
          return reply
            .status(404)
            .send({ error: error.message, code: "NOT_FOUND_ERROR" });
        }
        return reply.status(500).send({
          error: "Internal server error",
          code: "INTERNAL_SERVER_ERROR",
        });
      }
    },
  });

  // ROTA 02: Iniciar Sessão de Treino
  withTypeProvider.route({
    method: "POST",
    url: "/workout-plans/:id/days/:dayId/sessions",
    schema: {
      tags: ["Workout Plan"],
      summary: "Start a workout session",
      params: z.object({
        id: z.string().uuid(),
        dayId: z.string().uuid(),
      }),
      response: {
        201: z.object({
          userWorkoutSessionId: z.string(),
        }),
        400: ErrorSchema,
        401: ErrorSchema,
        404: ErrorSchema,
        409: ErrorSchema,
        500: ErrorSchema,
      },
    },
    handler: async (request, reply) => {
      try {
        const session = await auth.api.getSession({
          headers: fromNodeHeaders(request.headers),
        });

        if (!session) {
          return reply
            .status(401)
            .send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }

        const { id: workoutPlanId, dayId: workoutDayId } = request.params;

        const startWorkoutSession = new StartWorkoutSession();
        const result = await startWorkoutSession.execute({
          userId: session.user.id,
          workoutPlanId,
          workoutDayId,
        });

        return reply.status(201).send(result);
      } catch (error) {
        app.log.error(error);
        if (error instanceof NotFoundError) {
          return reply
            .status(404)
            .send({ error: error.message, code: "NOT_FOUND_ERROR" });
        }
        if (error instanceof WorkoutPlanNotActiveError) {
          return reply
            .status(400)
            .send({ error: error.message, code: "PLAN_NOT_ACTIVE" });
        }
        if (error instanceof ConflictError) {
          return reply
            .status(409)
            .send({ error: error.message, code: "CONFLICT_ERROR" });
        }
        return reply.status(500).send({
          error: "Internal server error",
          code: "INTERNAL_SERVER_ERROR",
        });
      }
    },
  });

  // ROTA 04: Detalhar Um Plano de Treino Específico
  withTypeProvider.route({
    method: "GET",
    url: "/workout-plans/:id",
    schema: {
      tags: ["Workout Plan"],
      summary: "Get workout plan details",
      params: z.object({
        id: z.string().uuid(),
      }),
      response: {
        200: z.object({
          id: z.string().uuid(),
          name: z.string(),
          workoutDays: z.array(
            z.object({
              id: z.string().uuid(),
              weekDay: z.string(),
              name: z.string(),
              isRest: z.boolean(),
              coverImageUrl: z.string().optional(),
              estimatedDurationInSeconds: z.number(),
              exercisesCount: z.number(),
            }),
          ),
        }),
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
          return reply
            .status(401)
            .send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }

        const { id: workoutPlanId } = request.params;

        const getWorkoutPlan = new GetWorkoutPlan();
        const result = await getWorkoutPlan.execute({
          userId: session.user.id,
          workoutPlanId,
        });

        return reply.status(200).send(result);
      } catch (error) {
        app.log.error(error);
        if (error instanceof NotFoundError) {
          return reply
            .status(404)
            .send({ error: error.message, code: "NOT_FOUND_ERROR" });
        }
        return reply.status(500).send({
          error: "Internal server error",
          code: "INTERNAL_SERVER_ERROR",
        });
      }
    },
  });

  // ROTA 05: Detalhar Dia de Treino
  withTypeProvider.route({
    method: "GET",
    url: "/workout-plans/:id/days/:dayId",
    schema: {
      tags: ["Workout Plan"],
      summary: "Get workout day details with sessions",
      params: z.object({
        id: z.string().uuid(),
        dayId: z.string().uuid(),
      }),
      response: {
        200: z.object({
          id: z.string().uuid(),
          name: z.string(),
          isRest: z.boolean(),
          coverImageUrl: z.string().optional(),
          estimatedDurationInSeconds: z.number(),
          weekDay: z.string(),
          exercises: z.array(
            z.object({
              id: z.string().uuid(),
              name: z.string(),
              sets: z.number(),
              reps: z.number(),
              order: z.number(),
              restTimeInSeconds: z.number(),
            }),
          ),
          sessions: z.array(
            z.object({
              id: z.string().uuid(),
              workoutDayId: z.string().uuid(),
              startedAt: z.string().optional(),
              completedAt: z.string().optional(),
            }),
          ),
        }),
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
          return reply
            .status(401)
            .send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }

        const { id: workoutPlanId, dayId: workoutDayId } = request.params;

        const getWorkoutDayDetail = new GetWorkoutDayDetail();
        const result = await getWorkoutDayDetail.execute({
          userId: session.user.id,
          workoutPlanId,
          workoutDayId,
        });

        return reply.status(200).send(result);
      } catch (error) {
        app.log.error(error);
        if (error instanceof NotFoundError) {
          return reply
            .status(404)
            .send({ error: error.message, code: "NOT_FOUND_ERROR" });
        }
        return reply.status(500).send({
          error: "Internal server error",
          code: "INTERNAL_SERVER_ERROR",
        });
      }
    },
  });

  // ROTA 07: Listar/Filtrar Todos os Planos de Treino Completos
  withTypeProvider.route({
    method: "GET",
    url: "/workout-plans",
    schema: {
      tags: ["Workout Plan"],
      summary: "Get all workout plans with details",
      querystring: z.object({
        active: z
          .string()
          .optional()
          .transform((val) =>
            val === "true" ? true : val === "false" ? false : undefined,
          ),
      }),
      response: {
        200: z.object({
          workoutPlans: z.array(
            z.object({
              id: z.string().uuid(),
              name: z.string(),
              isActive: z.boolean(),
              workoutDays: z.array(
                z.object({
                  id: z.string().uuid(),
                  name: z.string(),
                  weekDay: z.string(),
                  isRest: z.boolean(),
                  coverImageUrl: z.string().optional(),
                  estimatedDurationSeconds: z.number(),
                  exercises: z.array(
                    z.object({
                      id: z.string().uuid(),
                      name: z.string(),
                      sets: z.number(),
                      reps: z.number(),
                      order: z.number(),
                      restTimeInSeconds: z.number(),
                    }),
                  ),
                }),
              ),
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
          return reply
            .status(401)
            .send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }
        const { active } = request.query as any;
        const listWorkoutPlans = new ListWorkoutPlans();
        const result = await listWorkoutPlans.execute({
          userId: session.user.id,
          active,
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
