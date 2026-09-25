import { z } from "zod";
import { WeekDay } from "../generated/prisma/index.js";

export const ErrorSchema = z.object({
  error: z.string(),
  code: z.string(),
});

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
          weekDay: z.nativeEnum(WeekDay),
          isRest: z.boolean().default(false),
          estimatedDurationInSeconds: z.number().min(1),
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
