import { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { SignupUser } from "../usecases/signup-user.js";
import { SignInUser } from "../usecases/signin-user.js"; // Import do Use Case novo
import { ErrorSchema } from "../schemas/index.js";
import { ConflictError } from "../errors/index.js";
import { NotFoundError } from "../errors/index.js";

// Schemas usando z.object() conforme compatibilidade validada pela IA
const SignUpBodySchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().email(),
});

const SignInBodySchema = z.object({
  email: z.string().email(),
});

export const authRoutes = async (app: FastifyInstance) => {
  // 1. Rota de Cadastro existente
  app.withTypeProvider<ZodTypeProvider>().route({
    method: "POST",
    url: "/api/auth/signup",
    schema: {
      body: SignUpBodySchema,
      response: {
        201: z.any(),
        409: ErrorSchema,
        500: ErrorSchema,
      },
    },
    handler: async (request, reply) => {
      try {
        const { name, email } = request.body;
        const signUpUser = new SignupUser();
        const result = await signUpUser.execute({ name, email });
        return reply.status(201).send(result);
      } catch (error) {
        if (error instanceof ConflictError) {
          return reply
            .status(409)
            .send({ error: error.message, code: "CONFLICT_ERROR" });
        }
        return reply
          .status(500)
          .send({
            error: "Internal server error",
            code: "INTERNAL_SERVER_ERROR",
          });
      }
    },
  });

  // 2. 🌟 ROTA NOVA: Login (Sign In)
  app.withTypeProvider<ZodTypeProvider>().route({
    method: "POST",
    url: "/api/auth/signin",
    schema: {
      body: SignInBodySchema,
      response: {
        200: z.any(),
        404: ErrorSchema,
        500: ErrorSchema,
      },
    },
    handler: async (request, reply) => {
      try {
        const { email } = request.body;
        const signInUser = new SignInUser();
        const result = await signInUser.execute({ email });

        // Aqui o Better-Auth gerencia os cookies de sessão nos bastidores automaticamente
        return reply.status(200).send(result);
      } catch (error) {
        if (error instanceof NotFoundError) {
          return reply
            .status(404)
            .send({ error: error.message, code: "NOT_FOUND_ERROR" });
        }
        return reply
          .status(500)
          .send({
            error: "Internal server error",
            code: "INTERNAL_SERVER_ERROR",
          });
      }
    },
  });
};
