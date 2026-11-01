import type { AuditAccess } from "@architecture/audit/application";
import type {
  PublishedConfigurationReader,
  UserQueryRepository,
} from "@architecture/iam/application";

export class IamAuditAccessAdapter implements AuditAccess {
  constructor(
    private readonly users: UserQueryRepository,
    private readonly configuration: PublishedConfigurationReader,
  ) {}
  async resolveActor(actorUserId: string) {
    const [actor, policy] = await Promise.all([
      this.users.findAccountById(actorUserId),
      this.configuration.readPublished(),
    ]);
    return {
      active: actor?.status === "active",
      administrator: actor?.role === "admin",
      consultationEnabled: policy.values.audit.consultation,
      retentionDays: policy.values.audit.retentionDays,
    };
  }
}
