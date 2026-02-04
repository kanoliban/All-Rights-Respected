import type { ExtractedAttestation, FileFormat, SignedAttestation } from "./types.js";
import { ArrError } from "./errors.js";
import { embedJpegAttestation, extractJpegAttestation, isJpeg } from "./jpeg.js";
import { embedPngAttestation, extractPngAttestation, isPng } from "./png.js";

export function detectFileFormat(buffer: Buffer): FileFormat {
  if (isPng(buffer)) {
    return "png";
  }

  if (isJpeg(buffer)) {
    return "jpeg";
  }

  return "unknown";
}

export function extractAttestationFromMetadata(buffer: Buffer): ExtractedAttestation | null {
  if (isPng(buffer)) {
    const signed = extractPngAttestation(buffer);
    return signed ? { format: "png", signed } : null;
  }

  if (isJpeg(buffer)) {
    const signed = extractJpegAttestation(buffer);
    return signed ? { format: "jpeg", signed } : null;
  }

  return null;
}

export function embedAttestationInMetadata(
  buffer: Buffer,
  signed: SignedAttestation,
  format = detectFileFormat(buffer),
): Buffer {
  if (format === "png") {
    return embedPngAttestation(buffer, signed);
  }

  if (format === "jpeg") {
    return embedJpegAttestation(buffer, signed);
  }

  throw new ArrError(
    "unsupported_format",
    "Metadata embedding currently supports only PNG and JPEG.",
    { format },
  );
}
