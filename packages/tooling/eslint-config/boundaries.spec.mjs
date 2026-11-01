import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";
import base from "./index.mjs";
import iam from "./iam.mjs";
import api from "./api-boundaries.mjs";
import context from "./context.mjs";
import adapter from "./adapter.mjs";
import { fileURLToPath } from "node:url";
async function violates(config, filePath, dependency) {
  const eslint = new ESLint({
    overrideConfigFile: true,
    overrideConfig: [...base, ...config],
  });
  const [result] = await eslint.lintText(
    `import type { Contract } from "${dependency}"; export type Used = Contract;`,
    { filePath },
  );
  return result.messages.some(
    (message) =>
      message.ruleId === "no-restricted-imports" && message.severity === 2,
  );
}
describe("IAM dependency boundaries", () => {
  it.each([
    "kysely",
    "#accounts/sign-up/sign-up.contracts",
    "#repositories/user.repository",
    "#ports/user.repository",
    "#events/iam-security-event",
  ])("rejects domain dependency %s", async (dependency) => {
    expect(await violates(iam, "src/domain/forbidden.ts", dependency)).toBe(
      true,
    );
  });
  it("rejects concrete application dependencies and permits local ports", async () => {
    expect(await violates(iam, "src/application/forbidden.ts", "ioredis")).toBe(
      true,
    );
    expect(
      await violates(
        iam,
        "src/application/allowed.ts",
        "#repositories/user.repository",
      ),
    ).toBe(false);
  });
  it("rejects adapter imports in transport while permitting composition", async () => {
    expect(
      await violates(
        api,
        "src/features/iam/controller.ts",
        "@architecture/iam-persistence-kysely",
      ),
    ).toBe(true);
    expect(
      await violates(
        api,
        "src/composition-root/module.ts",
        "@architecture/iam-persistence-kysely",
      ),
    ).toBe(false);
  });
});

describe("Context dependency boundaries", () => {
  it.each(["audit", "messaging", "notifications"])(
    "applies the real TypeScript and boundary config in %s",
    async (name) => {
      const engine = new ESLint({
        cwd: fileURLToPath(new URL(`../../contexts/${name}`, import.meta.url)),
      });
      const config = await engine.calculateConfigForFile(
        "src/application/probe.ts",
      );
      expect(config).toBeDefined();
      expect(config.rules["no-restricted-imports"][0]).toBe(2);
      expect(config.rules["@typescript-eslint/no-unused-vars"][0]).toBe(2);
    },
  );
  it("rejects private adapter dependencies while accepting public application contracts", async () => {
    expect(
      await violates(
        adapter,
        "src/adapter.ts",
        "@architecture/iam/src/domain/user",
      ),
    ).toBe(true);
    expect(
      await violates(
        adapter,
        "src/adapter.ts",
        "@architecture/notifications/application",
      ),
    ).toBe(false);
  });
  it.each([
    "#application/service",
    "#repositories/repository",
    "@architecture/messaging/application",
    "node:crypto",
  ])("rejects domain dependency %s", async (dependency) => {
    expect(await violates(context, "src/domain/forbidden.ts", dependency)).toBe(
      true,
    );
  });
  it.each([
    "kysely",
    "node:crypto",
    "@architecture/notifications-delivery-slack-webhook",
  ])("rejects application infrastructure dependency %s", async (dependency) => {
    expect(
      await violates(context, "src/application/forbidden.ts", dependency),
    ).toBe(true);
  });
  it("permits local application ports and public messaging contracts", async () => {
    for (const dependency of [
      "#repositories/repository",
      "@architecture/messaging/application",
      "@architecture/messaging/domain",
    ]) {
      expect(
        await violates(context, "src/application/allowed.ts", dependency),
      ).toBe(false);
    }
  });
});
