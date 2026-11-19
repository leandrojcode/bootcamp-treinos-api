import { fromNodeHeaders } from "better-auth/node";
import { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";

import { auth } from "../lib/auth.js";
import { ErrorSchema } from "../schemas/index.js";
import { GetStatsQuerySchema, StatsResponseSchema } from "../schemas/stats.js";
import { GetStats } from "../usecases/GetStats.js";

export const statsRoutes = async (app: FastifyInstance) => {
  app.withTypeProvider<ZodTypeProvider>().route({
    method: "GET",
    url: "/", // O prefixo /stats será configurado no registro do index.ts
    schema: {
      tags: ["Stats"],
      summary: "Get dashboard stats data",
      querystring: GetStatsQuerySchema,
      response: {
        200: StatsResponseSchema,
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

        const { from, to } = request.query;

        const getStats = new GetStats();
        const result = await getStats.execute({
          userId: session.user.id,
          from,
          to,
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
