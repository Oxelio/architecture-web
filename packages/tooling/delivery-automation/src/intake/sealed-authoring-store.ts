import { createHash, randomUUID } from "node:crypto";
import {
  link,
  mkdir,
  open,
  readdir,
  readFile,
  stat,
  unlink,
} from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { isDeepStrictEqual } from "node:util";

import type { PreparedAuthoringRequest } from "../control/authoring-request.js";

const identifier = /^[a-f0-9]{64}$/u;
export const payloadDigest = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");

export interface SealedAuthoringHeader {
  readonly request: PreparedAuthoringRequest;
  readonly createdAt: number;
  readonly expiresAt: number;
}

export interface AuthoringJobBinding {
  readonly runId: string;
  readonly runAttempt: "1";
  readonly workflowSha: string;
}

export interface PrivateAuthoringResult {
  readonly status: "confirmed" | "denied" | "not-applied";
  readonly canonicalUrls: readonly string[];
}

// A private, single-host staging volume. It is not the controller's admission
// journal. Immutable transport receipts survive payload disposal so an intake
// retry cannot dispatch a replacement operation. No expiry settles a journal.
export class SealedAuthoringStore {
  constructor(
    private readonly configuration: {
      readonly directory: string;
      readonly maximumPayloadBytes: number;
      readonly maximumLifetimeMs: number;
      readonly now?: () => number;
    },
  ) {
    if (
      !isAbsolute(configuration.directory) ||
      !Number.isSafeInteger(configuration.maximumPayloadBytes) ||
      configuration.maximumPayloadBytes < 1 ||
      !Number.isSafeInteger(configuration.maximumLifetimeMs) ||
      configuration.maximumLifetimeMs < 1
    ) {
      throw new Error("AUTHORING_STAGING_CONFIGURATION_INVALID");
    }
  }

  private path(requestId: string, kind: string) {
    if (!identifier.test(requestId)) {
      throw new Error("AUTHORING_REQUEST_ID_INVALID");
    }
    return join(this.configuration.directory, `${requestId}.${kind}`);
  }

  private now() {
    return (this.configuration.now ?? Date.now)();
  }

  private async bytes(requestId: string, kind: string) {
    try {
      return await readFile(this.path(requestId, kind));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }

  private async read<T>(requestId: string, kind: string): Promise<T | null> {
    const bytes = await this.bytes(requestId, kind);
    return bytes === null ? null : (JSON.parse(bytes.toString("utf8")) as T);
  }

  private async create(requestId: string, kind: string, bytes: Uint8Array) {
    await mkdir(this.configuration.directory, { recursive: true, mode: 0o700 });
    const destination = this.path(requestId, kind);
    const temporary = `${destination}.${randomUUID()}.tmp`;
    try {
      const file = await open(temporary, "wx", 0o600);
      try {
        await file.writeFile(bytes);
        await file.sync();
      } finally {
        await file.close();
      }
      // Atomic create-if-absent after all bytes are written; never overwrite a
      // sealed request, job binding, dispatch claim or result after a crash.
      await link(temporary, destination);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") {
        return false;
      }
      throw error;
    } finally {
      await unlink(temporary).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "ENOENT") {
          throw error;
        }
      });
    }
  }

  private json(requestId: string, kind: string, value: unknown) {
    return this.create(requestId, kind, Buffer.from(JSON.stringify(value)));
  }

  async header(requestId: string) {
    return this.read<SealedAuthoringHeader>(requestId, "header");
  }

  async seal(request: PreparedAuthoringRequest, bytes: Uint8Array) {
    if (
      bytes.byteLength > this.configuration.maximumPayloadBytes ||
      payloadDigest(bytes) !== request.command.payloadDigest
    ) {
      return "rejected" as const;
    }
    const existing = await this.header(request.requestId);
    if (existing) {
      return this.compare(existing, request);
    }
    const createdAt = this.now();
    const header = {
      request,
      createdAt,
      expiresAt: createdAt + this.configuration.maximumLifetimeMs,
    };
    if (!Number.isSafeInteger(header.expiresAt)) {
      return "rejected" as const;
    }
    // Stage the payload under its digest first. A competing command with the
    // same request ID cannot supply bytes used by the winning header.
    await this.create(request.requestId, request.command.payloadDigest, bytes);
    if (await this.json(request.requestId, "header", header)) {
      return "sealed" as const;
    }
    const winner = await this.header(request.requestId);
    if (
      winner &&
      winner.request.command.payloadDigest !== request.command.payloadDigest
    ) {
      await unlink(this.path(request.requestId, request.command.payloadDigest));
    }
    return winner ? this.compare(winner, request) : ("rejected" as const);
  }

  private compare(
    header: SealedAuthoringHeader,
    request: PreparedAuthoringRequest,
  ) {
    if (!isDeepStrictEqual(header.request, request)) {
      return "conflict" as const;
    }
    return this.now() < header.expiresAt
      ? ("duplicate" as const)
      : ("expired" as const);
  }

  async claimDispatch(requestId: string) {
    const header = await this.header(requestId);
    if (!header || this.now() >= header.expiresAt) {
      return false;
    }
    // Claimed before the HTTP call. A crash or lost reply is uncertain, not
    // permission to repeat dispatch. Recovery consults the canonical journal.
    return this.json(requestId, "dispatch", { claimedAt: this.now() });
  }

  async fetchPayload(
    requestId: string,
    digest: string,
    job: AuthoringJobBinding,
  ) {
    const header = await this.header(requestId);
    if (
      !header ||
      header.request.command.payloadDigest !== digest ||
      this.now() >= header.expiresAt ||
      !(await this.bytes(requestId, "dispatch"))
    ) {
      return null;
    }
    await this.json(requestId, "job", job);
    if (!isDeepStrictEqual(await this.read(requestId, "job"), job)) {
      return null;
    }
    const bytes = await this.bytes(requestId, digest);
    return bytes && payloadDigest(bytes) === digest
      ? { header, payload: bytes }
      : null;
  }

  async recordResult(
    requestId: string,
    job: AuthoringJobBinding,
    result: PrivateAuthoringResult,
  ) {
    if (!isDeepStrictEqual(await this.read(requestId, "job"), job)) {
      return false;
    }
    await this.json(requestId, "result", result);
    return isDeepStrictEqual(await this.result(requestId), result);
  }

  async result(requestId: string) {
    return this.read<PrivateAuthoringResult>(requestId, "result");
  }

  async disposePayload(requestId: string) {
    const header = await this.header(requestId);
    if (!header) {
      return;
    }
    try {
      await unlink(this.path(requestId, header.request.command.payloadDigest));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }

  async expirePayload(requestId: string) {
    const header = await this.header(requestId);
    if (header && this.now() >= header.expiresAt) {
      await this.disposePayload(requestId);
    }
  }

  // Run at startup and on the host's maintenance schedule. Include orphaned
  // payloads/temporary files from a crashed seal. Keep receipt/job/result files;
  // their eventual policy is separate from short-lived transport bytes.
  async expirePayloads() {
    await mkdir(this.configuration.directory, { recursive: true, mode: 0o700 });
    for (const entry of await readdir(this.configuration.directory, {
      withFileTypes: true,
    })) {
      const match = entry.name.match(
        /^([a-f0-9]{64})\.([a-f0-9]{64})(?:\.[a-f0-9-]{36}\.tmp)?$/u,
      );
      if (!entry.isFile() || !match) {
        continue;
      }
      const path = join(this.configuration.directory, entry.name);
      const metadata = await stat(path);
      const header = match[1] ? await this.header(match[1]) : null;
      const expiresAt =
        header && header.request.command.payloadDigest === match[2]
          ? header.expiresAt
          : metadata.mtimeMs + this.configuration.maximumLifetimeMs;
      if (this.now() >= expiresAt) {
        await unlink(path);
      }
    }
    // No admission or remote operation can be declared unstarted by this sweep.
  }
}
