import type { Attestation } from "./types.js";

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sortValue(entry));
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
      left.localeCompare(right),
    );

    const sorted: Record<string, unknown> = {};

    for (const [key, entryValue] of entries) {
      sorted[key] = sortValue(entryValue);
    }

    return sorted;
  }

  return value;
}

export function canonicalizeAttestation(attestation: Attestation): string {
  return JSON.stringify(sortValue(attestation));
}
