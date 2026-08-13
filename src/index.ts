import "dotenv/config";
import fastifyCors from "@fastify/cors";

import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import Fastify from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import { z } from "zod";

// 🌟 Importa a configuração do Better Auth que criamos no arquivo anterior
import { auth } from "./lib/auth.js"; 

const app = Fastify({
  logger: true,
});

app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

// Configuração do CORS para comunicação com o Frontend
await app.register(fastifyCors, {
  origin: ["http://localhost:3000"],
  credentials: true, // Essencial para os cookies do Better Auth
});

// Configuração da documentação Swagger
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

await app.register(fastifySwaggerUi, {
  routePrefix: "/docs",
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

// 🌟 Rota de Autenticação universal sem dependências de pacotes quebrados
app.route({
  method: ["GET", "POST", "PUT", "DELETE"], 
  url: "/api/auth/*",
  async handler(request, reply) {
    try {
      // 1. Monta a URL completa baseada nos headers da requisição
      const protocol = request.headers["x-forwarded-proto"] || "http";
      const host = request.headers.host || "localhost:3000";
      const fullUrl = `${protocol}://${host}${request.raw.url}`;

      // 2. Transforma os cabeçalhos do Fastify no objeto standard Headers da Web API
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

      // 3. Constrói o Web Request que o handler do Better Auth exige nativamente no Node v24
      const webRequest = new Request(fullUrl, {
        method: request.method,
        headers: webHeaders,
        body: request.body && request.method !== "GET" ? JSON.stringify(request.body) : undefined,
      });

      // 4. Executa e devolve a resposta tratada
      const response = await auth.handler(webRequest);
      return reply.send(response);
      
    } catch (error) {
      app.log.error(error, "Authentication Error");
      return reply.status(500).send({ 
        error: "Internal authentication error",
        code: "AUTH_FAILURE"
      });
    }
  }
});

// Inicialização do Servidor
try {
  await app.listen({ port: Number(process.env.PORT) || 3000, host: "0.0.0.0" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
