import type { FastifyReply, FastifyRequest } from "fastify";
import type { SessionPort } from "#application/ports/session.port";
import type { UserPort } from "#application/ports/user.port";
import { SessionIdentifierValueObject } from "#value-objects/session-identifier.value-object";
export interface AuthenticatedRequest extends FastifyRequest {
  user: {
    id: string;
  };
  session: {
    id: string;
  };
}

export function buildAuthMiddleware(
  sessionPort: SessionPort,
  userPort: UserPort,
) {
  return async function authMiddleware(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const header = request.headers.authorization;

    if (!header?.startsWith("Bearer ")) {
      return reply.status(401).send({
        error: { code: "UNAUTHORIZED" },
      });
    }

    const sessionId = header.replace("Bearer ", "");

    const sessionVO = SessionIdentifierValueObject.create(sessionId);
    const session = await sessionPort.findById(sessionVO);

    if (!session || session?.isExpired()) {
      return reply.status(401).send({
        error: { code: "UNAUTHORIZED" },
      });
    }

    const user = await userPort.findById(session.userId);

    if (!user) {
      return reply.status(401).send({
        error: { code: "UNAUTHORIZED" },
      });
    }

    (request as AuthenticatedRequest).user = {
      id: user.identifier.value,
    };

    (request as AuthenticatedRequest).session = {
      id: session.identifier.value,
    };
  };
}
