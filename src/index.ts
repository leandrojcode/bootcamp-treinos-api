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

import { auth } from "./lib/auth.js";
import { authRoutes } from "./routes/auth.js";
import { workoutPlanRoutes } from "./routes/workout-plan.js";

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

// Registro do Scalar configurado com múltiplas fontes
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

// Registra as rotas de Planos de Treino centralizadas usando o app.register do Fastify
await app.register(workoutPlanRoutes);

// Registra as rotas de autenticação customizadas (antes do catch-all do Better Auth)
await app.register(authRoutes);

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
