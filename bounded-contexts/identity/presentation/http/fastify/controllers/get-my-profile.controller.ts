import type { FastifyReply, FastifyRequest } from "fastify";
import type { GetMyProfileUseCase } from "#application/use-cases/get-my-profile/get-my-profile.use-case";

interface AuthenticatedRequest extends FastifyRequest {
  auth: {
    userId: string;
    sessionId: string;
  };
}

export function buildGetMyProfileController(useCase: GetMyProfileUseCase) {
  return {
    handle: async (request: FastifyRequest, reply: FastifyReply) => {
      const { auth } = request as AuthenticatedRequest;

      const result = await useCase.execute(auth.userId);

      if (!result.success) {
        return reply.status(404).send({
          error: { code: "NOT_FOUND" },
        });
      }

      return reply.status(200).send({
        data: result.value,
      });
    },
  };
}
