import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";
import base from "./index.mjs";
import iam from "./iam.mjs";
import api from "./api-boundaries.mjs";
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
