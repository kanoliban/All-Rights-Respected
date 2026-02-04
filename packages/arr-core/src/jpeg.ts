import { ArrError } from "./errors.js";
import type { SignedAttestation } from "./types.js";
import { parseSignedAttestationJson, serializeSignedAttestation } from "./signed.js";

const XMP_IDENTIFIER = Buffer.from("http://ns.adobe.com/xap/1.0/\0", "ascii");
const ARR_NAMESPACE = "http://arr.protocol/1.0/";

type JpegSplit = {
  soi: Buffer;
  segments: Buffer[];
  tail: Buffer;
};

function isStandaloneMarker(marker: number): boolean {
  return marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7);
}

function splitJpeg(buffer: Buffer): JpegSplit {
  if (!isJpeg(buffer)) {
    throw new ArrError("invalid_jpeg", "Input is not a JPEG file.");
  }

  const soi = buffer.subarray(0, 2);
  const segments: Buffer[] = [];
  let offset = 2;

  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) {
      throw new ArrError("invalid_jpeg", "Expected marker prefix in JPEG stream.");
    }

    const markerStart = offset;
    offset += 1;

    while (offset < buffer.length && buffer[offset] === 0xff) {
      offset += 1;
    }

    if (offset >= buffer.length) {
      throw new ArrError("invalid_jpeg", "Unexpected end of JPEG marker stream.");
    }

    const marker = buffer[offset] ?? 0;
    offset += 1;

    if (marker === 0xda || marker === 0xd9) {
      return {
        soi,
        segments,
        tail: buffer.subarray(markerStart),
      };
    }

    if (isStandaloneMarker(marker)) {
      segments.push(buffer.subarray(markerStart, offset));
      continue;
    }

    if (offset + 2 > buffer.length) {
      throw new ArrError("invalid_jpeg", "JPEG segment missing length field.");
    }

    const segmentLength = buffer.readUInt16BE(offset);

    if (segmentLength < 2) {
      throw new ArrError("invalid_jpeg", "JPEG segment has invalid length.");
    }

    const segmentEnd = offset + segmentLength;

    if (segmentEnd > buffer.length) {
      throw new ArrError("invalid_jpeg", "JPEG segment length exceeds file bounds.");
    }

    segments.push(buffer.subarray(markerStart, segmentEnd));
    offset = segmentEnd;
  }

  return {
    soi,
    segments,
    tail: Buffer.from([0xff, 0xd9]),
  };
}

function decodeXmlEntities(value: string): string {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&gt;", ">")
    .replaceAll("&lt;", "<")
    .replaceAll("&amp;", "&");
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function extractArrAttestationFromXml(xml: string): SignedAttestation | null {
  const match = xml.match(/<arr:attestation>([\s\S]*?)<\/arr:attestation>/);

  if (!match || match[1] === undefined) {
    return null;
  }

  return parseSignedAttestationJson(decodeXmlEntities(match[1].trim()));
}

function isApp1Segment(segment: Buffer): boolean {
  return segment.length >= 4 && segment[0] === 0xff && segment[1] === 0xe1;
}

function parseApp1Payload(segment: Buffer): Buffer {
  return segment.subarray(4);
}

function isArrXmpSegment(segment: Buffer): boolean {
  if (!isApp1Segment(segment)) {
    return false;
  }

  const payload = parseApp1Payload(segment);

  if (!payload.subarray(0, XMP_IDENTIFIER.length).equals(XMP_IDENTIFIER)) {
    return false;
  }

  const xml = payload.subarray(XMP_IDENTIFIER.length).toString("utf8");
  return xml.includes(ARR_NAMESPACE) && xml.includes("<arr:attestation>");
}

function buildArrXmpXml(signed: SignedAttestation): string {
  const escapedJson = escapeXml(serializeSignedAttestation(signed));

  return [
    "<x:xmpmeta xmlns:x=\"adobe:ns:meta/\">",
    "<rdf:RDF xmlns:rdf=\"http://www.w3.org/1999/02/22-rdf-syntax-ns#\">",
    `<rdf:Description rdf:about=\"\" xmlns:arr=\"${ARR_NAMESPACE}\">`,
    `<arr:attestation>${escapedJson}</arr:attestation>`,
    "</rdf:Description>",
    "</rdf:RDF>",
    "</x:xmpmeta>",
  ].join("");
}

function createArrApp1Segment(signed: SignedAttestation): Buffer {
  const xml = buildArrXmpXml(signed);
  const payload = Buffer.concat([XMP_IDENTIFIER, Buffer.from(xml, "utf8")]);
  const segmentLength = payload.length + 2;

  if (segmentLength > 0xffff) {
    throw new ArrError("xmp_too_large", "ARR XMP payload exceeds JPEG APP1 limits.");
  }

  const header = Buffer.alloc(4);
  header[0] = 0xff;
  header[1] = 0xe1;
  header.writeUInt16BE(segmentLength, 2);

  return Buffer.concat([header, payload]);
}

export function isJpeg(buffer: Buffer): boolean {
  return buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8;
}

export function extractJpegAttestation(buffer: Buffer): SignedAttestation | null {
  const { segments } = splitJpeg(buffer);

  for (const segment of segments) {
    if (!isArrXmpSegment(segment)) {
      continue;
    }

    const payload = parseApp1Payload(segment);
    const xml = payload.subarray(XMP_IDENTIFIER.length).toString("utf8");
    const extracted = extractArrAttestationFromXml(xml);

    if (extracted) {
      return extracted;
    }
  }

  return null;
}

export function embedJpegAttestation(buffer: Buffer, signed: SignedAttestation): Buffer {
  const { soi, segments, tail } = splitJpeg(buffer);
  const filteredSegments = segments.filter((segment) => !isArrXmpSegment(segment));
  const arrSegment = createArrApp1Segment(signed);

  return Buffer.concat([soi, ...filteredSegments, arrSegment, tail]);
}
