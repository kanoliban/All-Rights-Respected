export function decodeBase64Url(value: string): Buffer {
  try {
    return Buffer.from(value, "base64url");
  } catch {
    throw new Error("Invalid base64url value.");
  }
}

export function encodeBase64Url(value: Buffer): string {
  return value.toString("base64url");
}
