import { z } from "zod";
import { WeekDay } from "../generated/prisma/index.js";

export const ErrorSchema = z.object({
  error: z.string(),
  code: z.string(),
});

export const SignUpBodySchema = z.object({
  name: z.string().trim().min(1),
  email: z.email(),
});

export const SignUpResponseSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    emailVerified: z.boolean(),
    image: z.string().nullable().optional(),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
  })
  .passthrough();

// WorkoutPlanSchema com .passthrough() para aceitar os campos automáticos do Prisma v7
export const WorkoutPlanSchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(1),
    workoutDays: z.array(
      z
        .object({
          id: z.string().uuid().optional(),
          name: z.string().trim().min(1),
          coverImageUrl: z.string().nullish(),
          weekDay: z.nativeEnum(WeekDay),
          isRest: z.boolean().default(false),
          estimatedDurationSeconds: z.number().min(1),
          exercises: z
            .array(
              z
                .object({
                  id: z.string().uuid().optional(),
                  order: z.number().min(0),
                  name: z.string().trim().min(1),
                  sets: z.number().min(1),
                  reps: z.number().min(1),
                  restTimeInSeconds: z.number().min(1),
                })
                .passthrough(), // Permite metadados do Prisma nos Exercícios
            )
            .default([]),
        })
        .passthrough(), // Permite metadados do Prisma nos Dias de Treino
    ),
  })
  .passthrough(); // Permite metadados do Prisma no Plano de Treino Geral
