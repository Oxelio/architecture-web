import { describe, expect, it } from "vitest";

import {
  activationBlockers,
  operationalOwnerActivation,
  parseActivationManifest,
} from "./activation-manifest.js";

function inactiveManifest(): unknown {
  return {
    schemaVersion: 1,
    policyOwner: "docs/project/delivery-pipeline.md",
    project: null,
    mappings: {
      workState: { status: "inactive" },
      priority: { status: "inactive" },
      routes: { status: "inactive" },
      dependencies: { status: "inactive" },
      taskParent: { status: "inactive" },
      taskClaim: { status: "inactive" },
      workIntegrationPr: { status: "inactive" },
    },
  };
}

describe("parseActivationManifest", () => {
  it("keeps the initial manifest fail-closed", () => {
    const manifest = parseActivationManifest(inactiveManifest());

    expect(operationalOwnerActivation(manifest)).toEqual({
      workState: false,
      priority: false,
      routes: false,
      dependencies: false,
      taskParent: false,
      taskClaim: false,
      workIntegrationPr: false,
    });
    expect(activationBlockers(manifest)).toContain("PROJECT_LOCATOR_INACTIVE");
    expect(activationBlockers(manifest)).toContain("OWNER_INACTIVE:workState");
  });

  it("requires evidence for every verified mapping", () => {
    const input = inactiveManifest() as {
      mappings: Record<string, { status: string; evidenceRef?: string }>;
    };
    input.mappings["routes"] = { status: "verified" };

    expect(() => parseActivationManifest(input)).toThrow(/evidenceRef/);
  });

  it("requires an explicit Project locator before Project-backed mappings are verified", () => {
    const input = inactiveManifest() as {
      mappings: Record<string, { status: string; evidenceRef?: string }>;
    };
    input.mappings["workState"] = {
      status: "verified",
      evidenceRef: "validation:work-state",
    };

    expect(() => parseActivationManifest(input)).toThrow(/Project locator/);
  });

  it("derives activation only from explicit verified records", () => {
    const input = inactiveManifest() as {
      project: { owner: string; number: number } | null;
      mappings: Record<string, { status: string; evidenceRef?: string }>;
    };
    input.project = { owner: "Oxelio", number: 1 };
    input.mappings["workState"] = {
      status: "verified",
      evidenceRef: "validation:work-state",
    };
    input.mappings["priority"] = {
      status: "verified",
      evidenceRef: "validation:priority",
    };

    const activation = operationalOwnerActivation(
      parseActivationManifest(input),
    );
    expect(activation.workState).toBe(true);
    expect(activation.priority).toBe(true);
    expect(activation.routes).toBe(false);
  });

  it("rejects unknown keys instead of accepting a competing ad hoc mapping", () => {
    const input = inactiveManifest() as { mappings: Record<string, unknown> };
    input.mappings["nativeStatus"] = {
      status: "verified",
      evidenceRef: "invalid",
    };

    expect(() => parseActivationManifest(input)).toThrow(
      /must contain exactly/,
    );
  });
});
