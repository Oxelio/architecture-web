import { describe, expect, it } from "vitest";

import { KyselyMfaAdapter } from "./kysely-mfa.adapter.js";
describe("MFA persistence mapping", () => {
  it.each(["NaN", "Infinity", "-1", "1.5", "9007199254740992"])(
    "treats corrupt counter %s as a technical failure",
    async (value) => {
      const row = {
        user_id: "account",
        encrypted_secret: "sealed",
        enrollment_expires_at: null,
        enabled_at: new Date(),
        last_totp_counter: value,
      };
      const query = {
        selectAll: () => query,
        where: () => query,
        executeTakeFirst: async () => row,
      };
      const adapter = new KyselyMfaAdapter(
        { selectFrom: () => query } as never,
        () => ({ append: async () => undefined }),
      );
      await expect(adapter.credential("account")).rejects.toThrow(
        "Invalid persisted MFA counter",
      );
    },
  );
});
