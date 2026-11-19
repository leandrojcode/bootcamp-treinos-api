import { google } from "@ai-sdk/google";
import { stepCountIs, streamText, tool } from "ai";
import { fromNodeHeaders } from "better-auth/node";
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import z from "zod";

import { auth } from "../lib/auth.js";
import { GetUserTrainData } from "../usecases/GetUserTrainData.js";
import { UpsertUserTrainData } from "../usecases/UpsertUserTrainData.js";
import { ListWorkoutPlans } from "../usecases/ListWorkoutPlans.js";
import { CreateWorkoutPlan } from "../usecases/CreateWorkoutPlan.js";

// Schema de validação para o corpo do chat
const aiBodySchema = z.object({
  messages: z.array(
    z.object({
      id: z.string().optional(),
      role: z.enum(["user", "assistant", "system"]),
      content: z.string(),
    }),
  ),
});

const createWorkoutSchema = z.object({
  name: z.string().describe("Nome do plano de treino"),
  workoutDays: z
    .array(
      z.object({
        name: z
          .string()
          .describe("Nome do dia (ex: Superior A - Peito e Costas, Descanso)"),
        weekDay: z
          .enum([
            "MONDAY",
            "TUESDAY",
            "WEDNESDAY",
            "THURSDAY",
            "FRIDAY",
            "SATURDAY",
            "SUNDAY",
          ])
          .describe("Dia da semana correspondente"),
        isRest: z
          .boolean()
          .describe("Se é dia de descanso (true) ou treino (false)"),
        estimatedDurationInSeconds: z
          .number()
          .describe("Duração estimada em segundos (0 para dias de descanso)"),
        coverImageUrl: z
          .string()
          .url()
          .describe(
            "URL da imagem de capa fornecida nas instruções do sistema",
          ),
        exercises: z
          .array(
            z.object({
              name: z.string().describe("Nome do exercício"),
              order: z
                .number()
                .describe("Ordem sequencial do exercício começando em 1"),
              sets: z.number().describe("Quantidade de séries"),
              reps: z.number().describe("Quantidade de repetições por série"),
              restTimeInSeconds: z
                .number()
                .describe("Tempo de descanso em segundos entre as séries"),
            }),
          )
          .describe("Lista de exercícios do dia (vazio para dias de descanso)"),
      }),
    )
    .describe(
      "O plano DEVE conter exatamente 7 dias mapeando de MONDAY a SUNDAY",
    ),
});

export const aiRoutes = async (app: FastifyInstance) => {
  // Removido o withTypeProvider desta rota específica para permitir retornos do tipo Stream nativos do HTTP
  app.route({
    method: "POST",
    url: "/ai",
    schema: {
      tags: ["AI"],
      summary: "Chatbot IA com Tool Calling para personal trainer virtual",
    },
    handler: async (
      request: FastifyRequest,
      reply: FastifyReply,
    ): Promise<any> => {
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

        const userId = session.user.id;

        // Validando o corpo manualmente com o Zod para manter a segurança estrita
        const parsedBody = aiBodySchema.parse(request.body);
        const { messages } = parsedBody;

        const coreMessages = messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        }));

        const result = streamText({
          model: google("gemini-1.5-flash"),
          system: `Você é um personal trainer virtual especialista em montagem de planos de treino de musculação.
Seu tom de voz deve ser amigável, motivador, utilizando linguagem simples e sem jargões técnicos complexos, focado em pessoas leigas.

### REGRAS CRÍTICAS DE INTERAÇÃO:
1. Você deve **OBRIGATORIAMENTE** chamar a ferramenta \`getUserTrainData\` na sua primeira interação para verificar o estado físico do usuário.
2. Se \`getUserTrainData\` retornar null: pergunte em uma única mensagem o nome, peso (em kg), altura (em cm), idade e percentual de gordura corporal. Quando receber esses valores, faça a conversão do peso de Kg para gramas (multiplique por 1000) e execute a ferramenta \`updateUserTrainData\`.
3. Se o usuário já possuir dados cadastrados, cumprimente-o calorosamente utilizando o nome fornecido no cadastro.
4. Para criar um plano de treino: pergunte o objetivo principal, quantos dias ele tem disponíveis por semana e se possui restrições físicas ou lesões estruturais. Mantenha as interações curtas e objetivas.
5. Sempre forneça respostas curtas, estruturadas e sem enrolação.

### ORGANIZAÇÃO E DIVISÕES DE TREINO (SPLITS):
Selecione rigorosamente a divisão com base na disponibilidade informada:
- 2-3 dias/semana: Estruture treinos "Full Body" ou divisão "ABC" (A: Peito+Tríceps, B: Costas+Bíceps, C: Pernas+Ombros)
- 4 dias/semana: Estruture "Upper/Lower" (Recomendado, estimulando cada grupo 2x por semana) ou "ABCD" (A: Peito+Tríceps, B: Costas+Bíceps, C: Pernas, D: Ombros+Abdômen)
- 5 dias/semana: Estruture "PPLUL" - Push/Pull/Legs + Upper/Lower (Membros superiores 3x e membros inferiores 2x na semana)
- 6 dias/semana: Estruture "PPL 2x" - Sequência Push/Pull/Legs repetida de forma consecutiva.

### PRINCÍPIOS DE MONTAGEM TÉCNICA:
- Combine agrupamentos musculares sinérgicos em uma mesma sessão (ex: Peito e Tríceps, Costas e Bíceps).
- Organize a sessão iniciando com exercícios compostos multiarticulares pesados e finalize com isoladores funcionais.
- Defina de 4 a 8 exercícios por sessão de treino ativa.
- Estabeleça de 3 a 4 séries por exercício, trabalhando com 8-12 repetições para hipertrofia muscular ou 4-6 repetições para desenvolvimento de força pura.
- Defina descansos de 60-90 segundos para protocolos de hipertrofia e de 2-3 minutos para compostos pesados de força.
- Evite categoricamente treinar o mesmo grupamento muscular em dias consecutivos.
- Nomeie os dias de treino com descrições nítidas (ex: "Superior A - Peito e Costas", "Descanso").

### REQUISITOS COMPULSÓRIOS DO PLANO DE TREINO:
- O plano gerado DEVE conter exatamente 7 dias corridos, mapeando estritamente de MONDAY a SUNDAY.
- Dias sem atividade física ativa devem ser preenchidos com \`isRest: true\`, vetor de \`exercises:\` e \`estimatedDurationInSeconds: 0\`.
- Sempre invoque a ferramenta \`createWorkoutPlan\` para consolidar e salvar o plano gerado na base de dados.

### IMAGENS DE CAPA (coverImageUrl):
Você DEVE obrigatoriamente fornecer uma URL válida de imagem para cada um dos dias do plano de treino, chaveando alternadamente conforme as opções estáticas disponibilizadas abaixo:

- Para dias majoritariamente SUPERIORES (Peito, costas, ombros, bíceps, tríceps, push, pull, upper, full body ou dias de descanso):
  * Opção 1: https://ufs.sh
  * Opção 2: https://ufs.sh

- Para dias majoritariamente INFERIORES (Pernas, glúteos, quadríceps, posterior, panturrilha, legs, lower):
  * Opção 1: https://ufs.sh
  * Opção 2: https://ufs.sh

Intercale as opções de cada categoria para garantir variabilidade estética visual ao dashboard do usuário.`,
          messages: coreMessages,
          stopWhen: stepCountIs(5),
          tools: {
            getUserTrainData: tool({
              description:
                "Busca os dados e histórico de treino antigos ou atuais do usuário logado na sessão.",
              inputSchema: z.object({}),
              execute: async () => {
                const usecase = new GetUserTrainData();
                const result = await usecase.execute({ userId });
                return result;
              },
            }),

            updateUserTrainData: tool({
              description:
                "Atualiza ou insere as informações físicas básicas do perfil corporal do usuário.",
              inputSchema: z.object({
                weightInGrams: z
                  .number()
                  .describe(
                    "Peso corporal convertido de kg para gramas inteiras",
                  ),
                heightInCentimeters: z
                  .number()
                  .describe(
                    "Altura do indivíduo medida em centímetros inteiros",
                  ),
                age: z.number().describe("Idade atual cronológica do usuário"),
                bodyFatPercentage: z
                  .number()
                  .describe(
                    "Percentual de gordura estimado (onde o inteiro 14 representa 14%)",
                  ),
              }),
              execute: async (params) => {
                const usecase = new UpsertUserTrainData();
                const result = await usecase.execute({
                  userId,
                  ...params,
                });
                return result;
              },
            }),

            getWorkoutPlans: tool({
              description:
                "Lista de forma abrangente todos os planos de treino que o usuário possui arquivados.",
              inputSchema: z.object({}),
              execute: async () => {
                const usecase = new ListWorkoutPlans();
                const result = await usecase.execute({ userId });
                return result;
              },
            }),

            createWorkoutPlan: tool({
              description:
                "Cria um novo plano de treino completo estruturado em 7 dias com rotinas de exercícios.",
              inputSchema: createWorkoutSchema,
              execute: async (input) => {
                const usecase = new CreateWorkoutPlan();
                const result = await usecase.execute({
                  userId,
                  name: input.name,
                  workoutDays: input.workoutDays as any,
                });
                return result;
              },
            }),
          },
        });

        reply.header("Content-Type", "text/plain; charset=utf-8");
        reply.header("Transfer-Encoding", "chunked");

        return reply.send(result.textStream);
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
