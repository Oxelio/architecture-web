import type { Configuration } from "oidc-provider";
import { z } from "zod";

export interface OAuthOptions {
  issuer: string;
  cookieKeys: [string, ...string[]];
  artifactKeys: [Buffer, ...Buffer[]];
  bindingKeys: [Buffer, ...Buffer[]];
  jwks: NonNullable<Configuration["jwks"]>;
  trustProxy: boolean;
}

const key = z
  .string()
  .regex(/^[A-Za-z0-9_-]{43}$/u)
  .refine(
    (value) => Buffer.from(value, "base64url").toString("base64url") === value,
  );
const ring = z
  .tuple([key])
  .rest(key)
  .refine((keys) => keys.length <= 2);
const configuration = z
  .strictObject({
    issuer: z.url().refine((value) => {
      const uri = new URL(value);
      return uri.protocol === "https:" && value === uri.origin;
    }),
    cookieKeys: ring,
    artifactKeys: ring,
    bindingKeys: ring,
    jwks: z.object({
      keys: z
        .array(
          z.strictObject({
            kty: z.literal("EC"),
            crv: z.literal("P-256"),
            kid: z.string().min(1),
            alg: z.literal("ES256"),
            use: z.literal("sig"),
            x: key,
            y: key,
            d: key,
          }),
        )
        .min(1)
        .max(2),
    }),
  })
  .refine(({ cookieKeys, artifactKeys, bindingKeys }) => {
    const keys = [...cookieKeys, ...artifactKeys, ...bindingKeys];
    return keys.length === new Set(keys).size;
  });

export function loadOAuthOptions(
  raw: string | undefined,
  trustProxy: boolean,
): OAuthOptions | undefined {
  if (raw === undefined) {
    return;
  }
  try {
    const { issuer, cookieKeys, artifactKeys, bindingKeys, jwks } =
      configuration.parse(JSON.parse(raw));
    const decode = ([active, ...previous]: [string, ...string[]]): [
      Buffer,
      ...Buffer[],
    ] => [
      Buffer.from(active, "base64url"),
      ...previous.map((value) => Buffer.from(value, "base64url")),
    ];
    return {
      issuer,
      cookieKeys,
      artifactKeys: decode(artifactKeys),
      bindingKeys: decode(bindingKeys),
      jwks,
      trustProxy,
    };
  } catch {
    throw new Error("Invalid delegated OAuth configuration");
  }
}
