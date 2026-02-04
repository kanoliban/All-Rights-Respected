export type {
  Attestation,
  FileFormat,
  SignedAttestation,
  VerificationResult,
  VerifyReason,
} from "./types.js";

export { ArrError } from "./errors.js";

export { canonicalizeAttestation } from "./canonicalize.js";

export {
  generateKeyPair,
  parseCreatorPublicKey,
  publicKeyPemToCreator,
  signAttestation,
  verifySignature,
} from "./keys.js";

export { verifyAttestation } from "./verify.js";

export {
  parseSignedAttestationJson,
  serializeSignedAttestation,
} from "./signed.js";

export {
  sidecarPathFor,
  writeSidecar,
  readSidecar,
} from "./sidecar.js";

export {
  detectFileFormat,
  extractAttestationFromMetadata,
  embedAttestationInMetadata,
} from "./adapters.js";
