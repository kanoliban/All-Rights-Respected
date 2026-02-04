import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  type KeyObject,
  sign as signBytes,
  verify as verifyBytes,
} from "node:crypto";
import { decodeBase64Url, encodeBase64Url } from "./base64url.js";
import { canonicalizeAttestation } from "./canonicalize.js";
import type { Attestation, SignedAttestation } from "./types.js";

const ED25519_PREFIX = "ed25519:";
const PUBKEY_CREATOR_PREFIX = "pubkey:ed25519:";

function ensurePrivateKey(privateKey: string | KeyObject): KeyObject {
  return typeof privateKey === "string" ? createPrivateKey(privateKey) : privateKey;
}

function ensurePublicKey(publicKey: string | KeyObject): KeyObject {
  return typeof publicKey === "string" ? createPublicKey(publicKey) : publicKey;
}

export function generateKeyPair(): { privateKeyPem: string; publicKeyPem: string; creator: string } {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");

  const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();

  return {
    privateKeyPem,
    publicKeyPem,
    creator: publicKeyPemToCreator(publicKeyPem),
  };
}

export function signAttestation(attestation: Attestation, privateKey: string | KeyObject): SignedAttestation {
  const key = ensurePrivateKey(privateKey);
  const canonical = canonicalizeAttestation(attestation);
  const signature = signBytes(null, Buffer.from(canonical, "utf8"), key);

  return {
    attestation,
    signature: `${ED25519_PREFIX}${encodeBase64Url(signature)}`,
  };
}

export function verifySignature(
  attestation: Attestation,
  signature: string,
  publicKey: string | KeyObject,
): boolean {
  if (!signature.startsWith(ED25519_PREFIX)) {
    return false;
  }

  const encodedSignature = signature.slice(ED25519_PREFIX.length);
  const signatureBytesBuffer = decodeBase64Url(encodedSignature);
  const canonical = canonicalizeAttestation(attestation);
  const key = ensurePublicKey(publicKey);

  return verifyBytes(null, Buffer.from(canonical, "utf8"), key, signatureBytesBuffer);
}

export function parseCreatorPublicKey(creator: string): KeyObject | null {
  if (!creator.startsWith(PUBKEY_CREATOR_PREFIX)) {
    return null;
  }

  const encodedPublicKey = creator.slice(PUBKEY_CREATOR_PREFIX.length);
  const publicKeyBytes = decodeBase64Url(encodedPublicKey);

  if (publicKeyBytes.length !== 32) {
    throw new Error("Creator key must contain a 32-byte Ed25519 public key.");
  }

  const spkiPrefix = Buffer.from("302a300506032b6570032100", "hex");
  const der = Buffer.concat([spkiPrefix, publicKeyBytes]);

  return createPublicKey({ format: "der", key: der, type: "spki" });
}

export function publicKeyPemToCreator(publicKeyPem: string): string {
  const key = createPublicKey(publicKeyPem);
  const der = key.export({ format: "der", type: "spki" });

  if (der.length < 32) {
    throw new Error("Unexpected public key DER payload.");
  }

  const rawPublicKey = der.subarray(der.length - 32);
  return `${PUBKEY_CREATOR_PREFIX}${encodeBase64Url(rawPublicKey)}`;
}
