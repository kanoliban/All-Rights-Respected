export type VerifyReason =
  | "invalid_signature"
  | "unsupported_version"
  | "malformed"
  | "missing_public_key";

export type Attestation = {
  version: "arr/0.1";
  id: string;
  created: string;
  creator: string;
  intent?: string;
  tool?: string;
  upstream?: string[];
  content_hash?: string;
  expires?: string;
  revocable?: boolean;
  license?: string;
  renews?: string;
  extensions?: Record<string, unknown>;
};

export type SignedAttestation = {
  attestation: Attestation;
  signature: string;
};

export type VerificationResult = {
  valid: boolean;
  expired?: boolean;
  reason?: VerifyReason;
};

export type FileFormat = "png" | "jpeg" | "unknown";

export type ExtractedAttestation = {
  format: Exclude<FileFormat, "unknown">;
  signed: SignedAttestation;
};
