import { publishGateCheck } from "../github/gate-check-publisher.js";
import { requiredEnvironment, writeJson } from "./gate-publication-support.js";

interface GateCheckPayload {
  readonly name: string;
  readonly headSha: string;
  readonly title: string;
  readonly summary: string;
  readonly pass: boolean;
}

interface GateEvaluationEnvelope {
  readonly gate: "work-merge";
  readonly check: GateCheckPayload;
  readonly result: unknown;
  readonly context: unknown;
}

const checkNameByGate = {
  "work-merge": "Architecture Web / Work Merge Gate",
} as const;

function parseEnvelope(encoded: string): GateEvaluationEnvelope {
  let value: unknown;
  try {
    value = JSON.parse(
      Buffer.from(encoded, "base64").toString("utf8"),
    ) as unknown;
  } catch {
    throw new Error("GATE_RESULT_B64 is not valid base64-encoded JSON");
  }

  if (!value || typeof value !== "object") {
    throw new Error("Gate evaluation envelope must be an object");
  }
  const record = value as Record<string, unknown>;
  const gate = record["gate"];
  if (gate !== "work-merge") {
    throw new Error("Gate evaluation envelope has an invalid gate kind");
  }

  const checkValue = record["check"];
  if (!checkValue || typeof checkValue !== "object") {
    throw new Error("Gate evaluation envelope is missing check data");
  }
  const check = checkValue as Record<string, unknown>;
  const name = check["name"];
  const headSha = check["headSha"];
  const title = check["title"];
  const summary = check["summary"];
  const pass = check["pass"];

  if (typeof name !== "string" || name !== checkNameByGate[gate]) {
    throw new Error("Gate evaluation envelope has a mismatched check name");
  }
  if (typeof headSha !== "string" || !/^[0-9a-f]{40}$/iu.test(headSha)) {
    throw new Error("Gate evaluation envelope has an invalid head SHA");
  }
  if (typeof title !== "string" || title.length === 0) {
    throw new Error("Gate evaluation envelope has an invalid title");
  }
  if (typeof summary !== "string" || summary.length === 0) {
    throw new Error("Gate evaluation envelope has an invalid summary");
  }
  if (typeof pass !== "boolean") {
    throw new TypeError("Gate evaluation envelope has an invalid pass result");
  }

  return {
    gate,
    check: { name, headSha, title, summary, pass },
    result: record["result"],
    context: record["context"],
  };
}

async function main(): Promise<void> {
  const repository = requiredEnvironment("GITHUB_REPOSITORY");
  const repositoryToken = requiredEnvironment("GITHUB_TOKEN");
  const envelope = parseEnvelope(requiredEnvironment("GATE_RESULT_B64"));

  const published = await publishGateCheck({
    repository,
    repositoryToken,
    name: envelope.check.name,
    headSha: envelope.check.headSha,
    title: envelope.check.title,
    summary: envelope.check.summary,
    pass: envelope.check.pass,
  });

  writeJson({ ...envelope, published });
  if (!envelope.check.pass) {
    process.exitCode = 2;
  }
}

try {
  await main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Gate check publication failed: ${message}\n`);
  process.exitCode = 1;
}
