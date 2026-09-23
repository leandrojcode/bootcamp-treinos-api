import "dotenv/config";
import fastifyCors from "@fastify/cors";
import fastifySwagger from "@fastify/swagger";
import fastifyApiReference from "@scalar/fastify-api-reference";
import Fastify from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import { z } from "zod";

import { fromNodeHeaders } from "better-auth/node"; // Importado o conversor de cabeçalhos do Better Auth
import { NotFoundError } from "./errors/index.js"; // Import do erro idêntico ao da imagem da aula
import { CreateWorkoutPlan } from "./usecases/CreateWorkoutPlan.js";
import { WeekDay } from "./generated/prisma/index.js";
import { auth } from "./lib/auth.js";

const app = Fastify({
  logger: true,
});

app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

// Configuração do CORS para comunicação com o Frontend
await app.register(fastifyCors, {
  origin: ["http://localhost:3000"],
  credentials: true,
});

// Configuração da documentação básica do Swagger (Obrigatório para o Scalar ler os dados)
await app.register(fastifySwagger, {
  openapi: {
    info: {
      title: "Bootcamp Treinos API",
      description: "API para Treinos de Musculação",
      version: "1.0.0",
    },
    servers: [
      {
        description: "Localhost",
        url: "http://localhost:3000",
      },
    ],
  },
  transform: jsonSchemaTransform,
});

// Registro do Scalar configurado com múltiplas fontes (idêntico à vídeo aula)
await app.register(fastifyApiReference as any, {
  routePrefix: "/docs",
  configuration: {
    sources: [
      {
        title: "Bootcamp Treinos API",
        slug: "bootcamp-treinos-api",
        url: "/swagger.json",
      },
      {
        title: "Auth API",
        slug: "auth-api",
        url: "/api/auth/open-api/generate-schema",
      },
    ],
  },
});

// RESTful
app.withTypeProvider<ZodTypeProvider>().route({
  method: "POST",
  url: "/workout-plans",
  schema: {
    body: z.object({
      name: z.string().trim().min(1),
      workoutDays: z.array(
        z.object({
          name: z.string().trim().min(1),
          weekDay: z.nativeEnum(WeekDay),
          isRest: z.boolean().default(false),
          estimatedDurationInSeconds: z.number().min(1),
          exercises: z
            .array(
              z.object({
                order: z.number().min(0),
                name: z.string().trim().min(1),
                sets: z.number().min(1),
                reps: z.number().min(1),
                restTimeInSeconds: z.number().min(1),
              }),
            )
            .default([]),
        }),
      ),
    }),
    // 🌟 Contrato de respostas atualizado com os novos formatos criados no catch da vídeo aula
    response: {
      201: z.any(), // Permite a saída do objeto populado retornado pelo Prisma
      400: z.object({
        error: z.string(),
        message: z.string(),
        code: z.string(),
      }),
      401: z.object({
        error: z.string(),
        code: z.string(),
      }),
      404: z.object({
        error: z.string(),
        code: z.string(),
      }),
      500: z.object({
        error: z.string(),
        code: z.string(),
      }),
    },
  },
  handler: async (request, reply) => {
    try {
      // 1. Recupera a sessão utilizando o cabeçalho nativo do Better Auth
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(request.headers),
      });

      // 2. Se a sessão não existir, barra com erro 401 (Unauthorized)
      if (!session) {
        return reply.status(401).send({
          error: "Unauthorized",
          code: "UNAUTHORIZED",
        });
      }

      const { name, workoutDays } = request.body;

      // Validações de regras de negócio antes de chamar o Use Case
      const hasActiveDays = workoutDays.some((day) => !day.isRest);
      if (!hasActiveDays) {
        return reply.status(400).send({
          error: "Bad Request",
          message:
            "O plano de treino precisa ter pelo menos um dia de treino ativo.",
          code: "INVALID_WORKOUT_PLAN",
        });
      }

      for (const day of workoutDays) {
        if (!day.isRest && (!day.exercises || day.exercises.length === 0)) {
          return reply.status(400).send({
            error: "Bad Request",
            message: `O dia "${day.name}" está ativo, portanto precisa ter pelo menos um exercício cadastrado.`,
            code: "MISSING_EXERCISES",
          });
        }
      }

      // 3. Instancia o caso de uso e executa salvando no banco real (idêntico à linha 123 da foto)
      const createWorkoutPlan = new CreateWorkoutPlan();
      const result = await createWorkoutPlan.execute({
        userId: session.user.id,
        name,
        workoutDays,
      });

      // 4. Retorna o resultado 201 enviando os dados estendidos (linha 127 da foto do mentor)
      return reply.status(201).send(result);
    } catch (error) {
      // 🌟 Bloco catch e tratamentos idênticos aos da imagem enviados por você
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

// Rota Inicial de Teste (Hello World)
app.withTypeProvider<ZodTypeProvider>().route({
  method: "GET",
  url: "/",
  schema: {
    description: "Hello World",
    tags: ["Hello World"],
    response: {
      200: z.object({
        message: z.string(),
      }),
    },
  },
  handler: () => {
    return {
      message: "Hello World",
    };
  },
});

// Rota para expor o JSON pro Scalar
app.withTypeProvider<ZodTypeProvider>().route({
  method: "GET",
  url: "/swagger.json",
  schema: {
    hide: true,
  },
  handler: async () => {
    return app.swagger();
  },
});

// Rota de Autenticação universal do Better Auth
app.route({
  method: ["GET", "POST", "PUT", "DELETE"],
  url: "/api/auth/*",
  async handler(request, reply) {
    try {
      const protocol = request.headers["x-forwarded-proto"] || "http";
      const host = request.headers.host || "localhost:3000";
      const fullUrl = `${protocol}://${host}${request.raw.url}`;

      const webHeaders = new Headers();
      Object.entries(request.headers).forEach(([key, value]) => {
        if (value) {
          if (Array.isArray(value)) {
            value.forEach((v) => webHeaders.append(key, v));
          } else {
            webHeaders.set(key, value);
          }
        }
      });

      const webRequest = new Request(fullUrl, {
        method: request.method,
        headers: webHeaders,
        body:
          request.body && request.method !== "GET"
            ? JSON.stringify(request.body)
            : undefined,
      });

      const response = await auth.handler(webRequest);
      return reply.send(response);
    } catch (error) {
      app.log.error(error, "Authentication Error");
      return reply.status(500).send({
        error: "Internal authentication error",
        code: "AUTH_FAILURE",
      });
    }
  },
});

// Inicialização do Servidor
try {
  await app.listen({ port: Number(process.env.PORT) || 3000, host: "0.0.0.0" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
