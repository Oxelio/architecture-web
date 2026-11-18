import { expect, it, vi } from "vitest";

import { createAuthoringProjectProjection } from "./authoring-project-projection.js";

const work = {
  workNumber: 140,
  issueOpen: true,
  status: "Implementing",
  workType: "Governance Change",
  workflowDepth: "Complex",
};

it("reads only a fresh projection and coalesces simultaneous refreshes", async () => {
  let current = 1000;
  const dispatch = vi.fn(async () => undefined);
  const projection = createAuthoringProjectProjection({
    dispatch,
    maximumAgeMs: 100,
    now: () => current,
  });
  await expect(
    Promise.all([projection.read(), projection.read()]),
  ).resolves.toEqual([{ status: "pending" }, { status: "pending" }]);
  expect(dispatch).toHaveBeenCalledTimes(1);
  expect(projection.accept({ generatedAt: 1000, works: [work] })).toBe(true);
  await expect(projection.read()).resolves.toEqual({
    projectNumber: 3,
    generatedAt: 1000,
    works: [work],
  });
  current = 1100;
  await expect(projection.read()).resolves.toEqual({ status: "pending" });
  expect(dispatch).toHaveBeenCalledTimes(2);
});

it("rejects future, outdated, duplicate, and overbroad Project data", () => {
  const projection = createAuthoringProjectProjection({
    dispatch: vi.fn(),
    maximumAgeMs: 100,
    now: () => 1000,
  });
  expect(projection.accept({ generatedAt: 1001, works: [work] })).toBe(false);
  expect(projection.accept({ generatedAt: 900, works: [work] })).toBe(false);
  expect(projection.accept({ generatedAt: 1000, works: [work, work] })).toBe(
    false,
  );
  expect(
    projection.accept({
      generatedAt: 1000,
      works: [{ ...work, description: "private" }],
    }),
  ).toBe(false);
  expect(projection.accept({ generatedAt: 1000, works: [] })).toBe(true);
  expect(projection.accept({ generatedAt: 999, works: [work] })).toBe(false);
  expect(() =>
    createAuthoringProjectProjection({ dispatch: vi.fn(), maximumAgeMs: 0 }),
  ).toThrow("AUTHORING_PROJECT_PROJECTION_LIMIT_INVALID");
});
