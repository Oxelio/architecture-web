import type { DelegatedAuthorization } from "@architecture/iam/application";
import type {
  ClientApplication,
  ProtectedResource,
} from "@architecture/iam/domain";
import Provider, {
  type Adapter,
  type AdapterConstructor,
  type AdapterPayload,
  errors,
} from "oidc-provider";

import type { OAuthSecrets } from "./oauth-secrets.js";
import type { OAuthTransactions } from "./oauth-transaction.js";

const bearerModels = new Set([
  "AccessToken",
  "AuthorizationCode",
  "RefreshToken",
]);
const writableModels = new Set([
  ...bearerModels,
  "Grant",
  "Interaction",
  "Session",
]);

export const oauthScope = (scope: string | undefined) =>
  typeof scope === "string" ? scope.split(/\s+/u).filter(Boolean) : [];

export function createOAuthArtifacts(
  transactions: OAuthTransactions,
  secrets: OAuthSecrets,
  authority: DelegatedAuthorization,
  resources: readonly ProtectedResource[],
) {
  const byId = new Map(resources.map((resource) => [resource.id, resource]));

  async function family(id: string) {
    const context = transactions.current();
    const row = await context.db
      .selectFrom("iam_oauth_families")
      .selectAll()
      .where("id", "=", id)
      .where("revoked", "=", false)
      .where("expires_at", ">", new Date())
      .executeTakeFirst();
    if (!row) {
      return;
    }
    const resource = byId.get(row.authority.resourceId);
    const scope = (
      await authority.currentEntitlements(context.reader, row.authority)
    ).map(({ code }) => code);
    if (resource && scope.length) {
      context.requestedFamilies.set(id, row.expires_at);
      return { ...row, resource, scope };
    }
    return undefined;
  }

  async function client(
    publicId: string,
  ): Promise<ClientApplication | undefined> {
    const { db, reader } = transactions.current();
    const row = await db
      .selectFrom("iam_delegated_clients")
      .select("id")
      .where("public_id", "=", publicId)
      .where("enabled", "=", true)
      .executeTakeFirst();
    return row && reader.client(row.id);
  }

  async function pending(cid: string) {
    return transactions
      .current()
      .db.selectFrom("iam_oauth_pending")
      .selectAll()
      .where("id", "in", secrets.lookup("pending", cid))
      .where("expires_at", ">", new Date())
      .executeTakeFirst();
  }

  async function capture(
    payload: Pick<AdapterPayload, "cid" | "params">,
    expiresAt: Date,
  ) {
    const { db, reader, actor } = transactions.current();
    const clientId = payload.params?.["client_id"];
    const resourceUri = payload.params?.["resource"];
    const scope = payload.params?.["scope"];
    if (
      !payload.cid ||
      typeof clientId !== "string" ||
      typeof scope !== "string"
    ) {
      throw new errors.AccessDenied();
    }
    const application = await client(clientId);
    const resource = resources.find(({ uri }) => uri === resourceUri);
    if (!application || !resource) {
      throw new errors.AccessDenied();
    }

    let record = await pending(payload.cid);
    record ??= await db
      .insertInto("iam_oauth_pending")
      .values({
        id: secrets.index("pending", payload.cid),
        client_id: application.state.id,
        client_revision: application.state.revision,
        account_id: null,
        binding: null,
        consent: null,
        expires_at: expiresAt,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    if (
      record.decided ||
      record.client_id !== application.state.id ||
      record.client_revision !== application.state.revision
    ) {
      throw new errors.AccessDenied();
    }
    if (!actor) {
      if (record.account_id) {
        throw new errors.AccessDenied();
      }
      return record;
    }
    if (record.account_id) {
      if (
        record.account_id !== actor.accountId ||
        !secrets.matches(record.binding, actor.sessionId)
      ) {
        throw new errors.AccessDenied();
      }
      return record;
    }
    const prepared = await authority.prepare(reader, {
      accountId: actor.accountId,
      clientId: application.state.id,
      resourceId: resource.id,
      requested: oauthScope(scope),
      clientRevision: record.client_revision,
    });
    if (!prepared.success) {
      throw new errors.AccessDenied();
    }
    return db
      .updateTable("iam_oauth_pending")
      .set({
        account_id: actor.accountId,
        binding: secrets.bind(actor.sessionId),
        consent: JSON.stringify(prepared.value),
      })
      .where("id", "=", record.id)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  class PostgresOAuthAdapter implements Adapter {
    constructor(private readonly model: string) {}

    async upsert(id: string, value: AdapterPayload, expiresIn?: number) {
      const { db, actor } = transactions.current();
      const model = this.model;
      if (!writableModels.has(model) || !expiresIn || expiresIn <= 0) {
        throw new Error("Unsupported OAuth artifact");
      }
      let expiry = Date.now() + expiresIn * 1000;
      const body = { ...value };
      let familyId: string | null = null;
      let accountId = body.accountId ?? null;
      if (bearerModels.has(model)) {
        const lineage = await this.authorizeIssuance(body, accountId);
        expiry = Math.min(expiry, lineage.expires_at.getTime());
        familyId = lineage.id;
        delete body.jti;
      }
      if (model === "Grant") {
        familyId = id;
      }
      if (model === "Interaction") {
        accountId = body.session?.accountId ?? actor?.accountId ?? null;
        if (!body.result) {
          const interaction = await capture(body, new Date(expiry));
          accountId = interaction.account_id;
          expiry = Math.min(expiry, interaction.expires_at.getTime());
        }
      }
      const existing = await this.row(id);
      const index = existing?.id ?? secrets.index(model, id);
      const artifact = {
        model,
        id: index,
        uid: body.uid ? secrets.index(`${model}:uid`, body.uid) : null,
        account_id: accountId,
        family_id: familyId,
        payload: secrets.seal(body, index),
        consumed: null,
        expires_at: new Date(expiry),
      };
      await db
        .insertInto("iam_oauth_artifacts")
        .values(artifact)
        .onConflict((conflict) =>
          conflict.columns(["model", "id"]).doUpdateSet({
            account_id: accountId,
            payload: artifact.payload,
            expires_at: artifact.expires_at,
            uid: artifact.uid,
          }),
        )
        .execute();
    }

    private async authorizeIssuance(
      body: AdapterPayload,
      accountId: string | null,
    ) {
      const lineage = body.grantId && (await family(body.grantId));
      const target = this.model === "AccessToken" ? body.aud : body.resource;
      const resource =
        Array.isArray(target) && target.length === 1 ? target[0] : target;
      const application = body.clientId && (await client(body.clientId));
      if (
        !lineage ||
        !application ||
        lineage.client_id !== application.state.id ||
        lineage.account_id !== accountId ||
        lineage.resource.uri !== resource
      ) {
        throw new errors.InvalidGrant();
      }
      if (this.model !== "RefreshToken") {
        const required = application.policyFor(lineage.resource)?.required;
        const scope = oauthScope(body.scope);
        if (
          !scope.length ||
          !required?.every((code) => scope.includes(code)) ||
          !scope.every((code) => lineage.scope.includes(code))
        ) {
          throw new errors.InvalidGrant();
        }
      }
      await transactions.current().lock(lineage.account_id);
      return lineage;
    }

    async find(id: string): Promise<AdapterPayload | undefined> {
      if (this.model === "Client") {
        const registered = await client(id);
        if (!registered) {
          return;
        }
        return {
          client_id: registered.state.publicId,
          redirect_uris: [...registered.state.redirectUris],
          response_types: ["code"],
          grant_types: ["authorization_code", "refresh_token"],
          token_endpoint_auth_method: "none",
          id_token_signed_response_alg: "ES256",
        };
      }
      const row = await this.row(id);
      if (!row) {
        return;
      }
      const payload = secrets.open<AdapterPayload>(row.payload, row.id);
      if (this.model === "AuthorizationCode" || this.model === "RefreshToken") {
        await this.validateExchange(payload);
        if (row.account_id) {
          await transactions.current().lock(row.account_id);
        }
      }
      if (bearerModels.has(this.model)) {
        payload.jti = id;
      }
      if (row.consumed !== null) {
        payload.consumed = row.consumed;
      }
      if (row.family_id && this.model === "Grant") {
        const lineage = await family(row.family_id);
        if (!lineage) {
          return;
        }
        payload["resources"] = {
          [lineage.resource.uri]: lineage.scope.join(" "),
        };
      }
      return payload;
    }

    private async validateExchange(payload: AdapterPayload) {
      const params = Provider.ctx?.oidc.params;
      const resources = Array.isArray(payload.resource)
        ? payload.resource
        : [payload.resource];
      if (
        typeof params?.["resource"] !== "string" ||
        !resources.includes(params["resource"])
      ) {
        throw new errors.InvalidTarget();
      }
      if (this.model === "AuthorizationCode") {
        const redirect = params["redirect_uri"];
        if (typeof redirect !== "string") {
          throw new errors.InvalidRequest("redirect_uri is required");
        }
        const registered = payload.clientId && (await client(payload.clientId));
        if (!registered || !registered.state.redirectUris.includes(redirect)) {
          throw new errors.InvalidGrant();
        }
      }
    }

    async findByUid(uid: string) {
      const row = await transactions
        .current()
        .db.selectFrom("iam_oauth_artifacts")
        .select(["id", "payload"])
        .where("model", "=", this.model)
        .where("uid", "in", secrets.lookup(`${this.model}:uid`, uid))
        .where("expires_at", ">", new Date())
        .executeTakeFirst();
      return row
        ? secrets.open<AdapterPayload>(row.payload, row.id)
        : undefined;
    }

    async findByUserCode() {
      return undefined;
    }

    async consume(id: string) {
      const context = transactions.current();
      const row = await this.row(id);
      if (!row?.account_id || !row.family_id) {
        throw new errors.InvalidGrant();
      }
      await context.lock(row.account_id);
      const changed = await context.db
        .updateTable("iam_oauth_artifacts")
        .set({ consumed: Math.floor(Date.now() / 1000) })
        .where("model", "=", this.model)
        .where("id", "=", row.id)
        .where("consumed", "is", null)
        .where("expires_at", ">", new Date())
        .executeTakeFirst();
      if (changed.numUpdatedRows !== 1n) {
        throw new errors.InvalidGrant();
      }
    }

    async destroy(id: string) {
      const { db } = transactions.current();
      await db
        .deleteFrom("iam_oauth_artifacts")
        .where("model", "=", this.model)
        .where("id", "in", secrets.lookup(this.model, id))
        .execute();
    }

    async revokeByGrantId(id: string) {
      // In the enabled endpoint profile only a verified spent code/refresh can invoke this hook.
      const context = transactions.current();
      const lineage = await family(id);
      if (!lineage) {
        return;
      }
      await context.db
        .updateTable("iam_oauth_families")
        .set({ revoked: true })
        .where("id", "=", id)
        .execute();
      context.replay = true;
    }

    private async row(id: string) {
      return transactions
        .current()
        .db.selectFrom("iam_oauth_artifacts")
        .selectAll()
        .where("model", "=", this.model)
        .where("id", "in", secrets.lookup(this.model, id))
        .where("expires_at", ">", new Date())
        .executeTakeFirst();
    }
  }

  const adapter: AdapterConstructor = PostgresOAuthAdapter;
  return { adapter, client, pending, capture, family };
}
