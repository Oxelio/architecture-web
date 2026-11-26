import { createHmac } from "node:crypto";
import { errors, Provider } from "oidc-provider";
import { permissions } from "./database.mjs";

const bearerModels = new Set([
  "AccessToken",
  "AuthorizationCode",
  "RefreshToken",
]);
const list = (value) => [value].flat();

export function postgresAdapter(db, iam, key, beforeSave, requireRedirect) {
  function storageId(model, id) {
    // Provider-owned references, unlike bearer values, must remain joinable.
    return bearerModels.has(model)
      ? createHmac("sha256", key)
          .update(model)
          .update(":")
          .update(id)
          .digest("hex")
      : id;
  }

  class Adapter {
    constructor(model) {
      this.model = model;
    }

    async upsert(id, payload, expiresIn) {
      const model = this.model;
      if (bearerModels.has(model)) {
        const lineage = await iam.family(payload.grantId);
        const target = model === "AccessToken" ? payload.aud : payload.resource;
        const scopes = permissions(payload.scope);
        if (
          !lineage ||
          lineage.account_id !== payload.accountId ||
          lineage.client_id !== payload.clientId ||
          list(target).length !== 1 ||
          list(target)[0] !== lineage.resource ||
          (model !== "RefreshToken" &&
            (!scopes.length ||
              !scopes.every((name) => lineage.scope.includes(name))))
        ) {
          throw new errors.InvalidGrant("issuance no longer authorized");
        }
        await beforeSave(model);
        // Opaque bearer values are also present inside the provider payload.
        // Rehydrate this field at lookup from the credential presented.
        payload = { ...payload };
        delete payload.jti;
      }
      if (
        model === "Interaction" &&
        payload.prompt?.name === "login" &&
        !payload.result &&
        db.state().actor
      ) {
        await iam.captureConsent(
          payload.cid,
          db.state().actor,
          payload.params.client_id,
        );
      }
      const accountId =
        payload.accountId ??
        (model === "Interaction"
          ? (payload.session?.accountId ?? db.state().actor?.account_id)
          : undefined);
      await db.query(
        `INSERT INTO artifact (model, id, payload, account_id, family_id, uid, user_code, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, now() + make_interval(secs => $8))
         ON CONFLICT (model, id) DO UPDATE SET payload = excluded.payload,
         account_id = COALESCE(excluded.account_id, artifact.account_id),
         expires_at = excluded.expires_at`,
        [
          model,
          storageId(model, id),
          payload,
          accountId ?? null,
          payload.grantId ?? null,
          payload.uid ?? null,
          payload.userCode ?? null,
          expiresIn ?? null,
        ],
      );
    }

    async find(id) {
      const row = await db.one(
        `SELECT payload, consumed FROM artifact WHERE model = $1 AND id = $2
         AND (expires_at IS NULL OR expires_at > now())`,
        [this.model, storageId(this.model, id)],
      );
      if (!row) return;
      if (bearerModels.has(this.model)) row.payload.jti = id;
      if (this.model === "Grant") {
        const lineage = await iam.family(id);
        if (!lineage) return;
        const accepted = permissions(row.payload.resources?.[lineage.resource]);
        row.payload.resources = {
          [lineage.resource]: accepted
            .filter((name) => lineage.scope.includes(name))
            .join(" "),
        };
      }
      if (row.consumed !== null) row.payload.consumed = row.consumed;
      return row.payload;
    }

    async findByUid(uid) {
      const row = await db.one(
        "SELECT id FROM artifact WHERE model = $1 AND uid = $2 AND expires_at > now()",
        [this.model, uid],
      );
      return row && this.find(row.id);
    }

    async findByUserCode(userCode) {
      const row = await db.one(
        "SELECT id FROM artifact WHERE model = $1 AND user_code = $2 AND expires_at > now()",
        [this.model, userCode],
      );
      return row && this.find(row.id);
    }

    async consume(id) {
      if (
        this.model === "AuthorizationCode" &&
        requireRedirect &&
        !Provider.ctx.oidc.params.redirect_uri
      ) {
        throw new errors.InvalidRequest(
          "redirect_uri is required by the spike policy",
        );
      }
      const { rowCount } = await db.query(
        `UPDATE artifact SET consumed = extract(epoch FROM now())::integer
         WHERE model = $1 AND id = $2 AND consumed IS NULL AND expires_at > now()`,
        [this.model, storageId(this.model, id)],
      );
      if (rowCount !== 1)
        throw new errors.InvalidGrant("artifact already consumed or expired");
    }

    async destroy(id) {
      await db.query("DELETE FROM artifact WHERE model = $1 AND id = $2", [
        this.model,
        storageId(this.model, id),
      ]);
      if (this.model === "Grant") {
        await db.query("UPDATE family SET active = false WHERE id = $1", [id]);
      }
    }

    async revokeByGrantId(id) {
      // Only code/refresh replay can invoke this helper in the enabled flow.
      db.state().replay = true;
      await db.query(
        "DELETE FROM artifact WHERE model = $1 AND family_id = $2",
        [this.model, id],
      );
    }
  }

  return Adapter;
}
