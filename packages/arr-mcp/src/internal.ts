import { randomUUID } from "node:crypto";
import type { Attestation } from "@allrightsrespected/sdk";

export type AttestationInput = Omit<Attestation, "version" | "id" | "created"> & {
  id?: string;
  created?: string;
};

export function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const result = {} as Record<string, unknown>;
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result as T;
}

function assertValidDate(expires: string | undefined): void {
  if (!expires) {
    return;
  }

  const parsed = new Date(expires);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("expires must be a valid ISO-8601 date.");
  }
}

export function buildAttestation(
  input: AttestationInput,
  overrides: { id?: string; created?: string; renews?: string } = {},
): Attestation {
  const created = overrides.created ?? input.created ?? new Date().toISOString();
  const id = overrides.id ?? input.id ?? randomUUID();

  assertValidDate(input.expires);

  return stripUndefined({
    version: "arr/0.1" as const,
    id,
    created,
    creator: input.creator,
    intent: input.intent,
    tool: input.tool,
    upstream: input.upstream,
    content_hash: input.content_hash,
    expires: input.expires,
    revocable: input.revocable ?? true,
    license: input.license,
    renews: overrides.renews ?? input.renews,
    extensions: input.extensions,
  }) as Attestation;
}

export function canonicalizeRecord(value: unknown): string {
  function sortValue(entry: unknown): unknown {
    if (Array.isArray(entry)) {
      return entry.map((item) => sortValue(item));
    }

    if (entry && typeof entry === "object") {
      const entries = Object.entries(entry as Record<string, unknown>).sort(([left], [right]) =>
        left.localeCompare(right),
      );
      const sorted: Record<string, unknown> = {};
      for (const [key, item] of entries) {
        sorted[key] = sortValue(item);
      }
      return sorted;
    }

    return entry;
  }

  return JSON.stringify(sortValue(value));
}
