import { z } from "zod";

export const authoringProjectProjection = z.strictObject({
  generatedAt: z.number().int().nonnegative(),
  works: z
    .array(
      z.strictObject({
        workNumber: z.number().int().positive(),
        issueOpen: z.boolean(),
        status: z.string().max(100).nullable(),
        workType: z.string().max(100).nullable(),
        workflowDepth: z.string().max(100).nullable(),
      }),
    )
    .max(1000),
});

export function createAuthoringProjectProjection(input: {
  readonly dispatch: () => Promise<unknown>;
  readonly maximumAgeMs: number;
  readonly now?: () => number;
}) {
  if (!Number.isSafeInteger(input.maximumAgeMs) || input.maximumAgeMs <= 0) {
    throw new Error("AUTHORING_PROJECT_PROJECTION_LIMIT_INVALID");
  }
  const now = input.now ?? Date.now;
  let snapshot: z.infer<typeof authoringProjectProjection> | null = null;
  let dispatchedAt = Number.NEGATIVE_INFINITY;
  return {
    accept(value: unknown) {
      const parsed = authoringProjectProjection.safeParse(value);
      if (!parsed.success) {
        return false;
      }
      const { generatedAt, works } = parsed.data;
      if (
        generatedAt > now() ||
        generatedAt < (snapshot?.generatedAt ?? 0) ||
        generatedAt + input.maximumAgeMs <= now() ||
        new Set(works.map((work) => work.workNumber)).size !== works.length
      ) {
        return false;
      }
      snapshot = parsed.data;
      return true;
    },
    async read() {
      if (snapshot && snapshot.generatedAt + input.maximumAgeMs > now()) {
        return { projectNumber: 3, ...snapshot };
      }
      snapshot = null;
      if (dispatchedAt + input.maximumAgeMs <= now()) {
        dispatchedAt = now();
        await input.dispatch();
      }
      return { status: "pending" as const };
    },
  };
}
