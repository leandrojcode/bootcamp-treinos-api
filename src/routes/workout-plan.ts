import { fromNodeHeaders } from "better-auth/node";
import { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";

import { NotFoundError } from "../errors/index.js";
import { auth } from "../lib/auth.js";
import { ErrorSchema, WorkoutPlanSchema } from "../schemas/index.js";
import { CreateWorkoutPlan } from "../usecases/create-workout-plan.js";

export const workoutPlanRoutes = async (app: FastifyInstance) => {
  app.withTypeProvider<ZodTypeProvider>().route({
    method: "POST",
    url: "/workout-plans",
    schema: {
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

        const dayWithoutExercises = workoutDays.find(
          (day) => !day.isRest && (!day.exercises || day.exercises.length === 0),
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
            weekDay: workoutDay.weekDay,
            isRest: workoutDay.isRest,
            estimatedDurationSeconds: workoutDay.estimatedDurationSeconds,
            exercises: workoutDay.exercises,
          })),
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
