import { ArrError } from "./errors.js";
import type { SignedAttestation } from "./types.js";
import { parseSignedAttestationJson, serializeSignedAttestation } from "./signed.js";

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const ARR_KEYWORD = "arr.attestation";

type Chunk = {
  type: string;
  data: Buffer;
  raw: Buffer;
};

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);

  for (let n = 0; n < 256; n += 1) {
    let c = n;

    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }

    table[n] = c >>> 0;
  }

  return table;
})();

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;

  for (const byte of buffer) {
    const tableValue = CRC_TABLE[(crc ^ byte) & 0xff] ?? 0;
    crc = tableValue ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function parseChunks(buffer: Buffer): Chunk[] {
  if (!isPng(buffer)) {
    throw new ArrError("invalid_png", "Input is not a PNG file.");
  }

  const chunks: Chunk[] = [];
  let offset = PNG_SIGNATURE.length;

  while (offset < buffer.length) {
    if (offset + 12 > buffer.length) {
      throw new ArrError("invalid_png", "PNG chunk is truncated.");
    }

    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const chunkEnd = dataEnd + 4;

    if (chunkEnd > buffer.length) {
      throw new ArrError("invalid_png", "PNG chunk extends past file boundary.");
    }

    chunks.push({
      type,
      data: buffer.subarray(dataStart, dataEnd),
      raw: buffer.subarray(offset, chunkEnd),
    });

    offset = chunkEnd;

    if (type === "IEND") {
      break;
    }
  }

  return chunks;
}

function parseItxt(chunkData: Buffer): { keyword: string; text: string } {
  const keywordEnd = chunkData.indexOf(0x00);

  if (keywordEnd < 0) {
    throw new ArrError("invalid_png", "iTXt chunk missing keyword terminator.");
  }

  const keyword = chunkData.subarray(0, keywordEnd).toString("latin1");
  let cursor = keywordEnd + 1;

  if (cursor + 2 > chunkData.length) {
    throw new ArrError("invalid_png", "iTXt chunk missing compression fields.");
  }

  const compressionFlag = chunkData[cursor] ?? 0;
  const compressionMethod = chunkData[cursor + 1] ?? 0;
  cursor += 2;

  if (compressionFlag !== 0 || compressionMethod !== 0) {
    throw new ArrError("unsupported_itxt_compression", "Compressed iTXt chunks are not supported.");
  }

  const languageTagEnd = chunkData.indexOf(0x00, cursor);

  if (languageTagEnd < 0) {
    throw new ArrError("invalid_png", "iTXt chunk missing language tag terminator.");
  }

  cursor = languageTagEnd + 1;
  const translatedKeywordEnd = chunkData.indexOf(0x00, cursor);

  if (translatedKeywordEnd < 0) {
    throw new ArrError("invalid_png", "iTXt chunk missing translated keyword terminator.");
  }

  cursor = translatedKeywordEnd + 1;
  const text = chunkData.subarray(cursor).toString("utf8");

  return { keyword, text };
}

function encodeItxt(keyword: string, text: string): Buffer {
  const keywordBytes = Buffer.from(keyword, "latin1");
  const textBytes = Buffer.from(text, "utf8");

  return Buffer.concat([
    keywordBytes,
    Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00]),
    textBytes,
  ]);
}

function createChunk(type: string, data: Buffer): Buffer {
  const typeBytes = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 0);

  return Buffer.concat([length, typeBytes, data, crc]);
}

export function isPng(buffer: Buffer): boolean {
  return buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE);
}

export function extractPngAttestation(buffer: Buffer): SignedAttestation | null {
  const chunks = parseChunks(buffer);

  for (const chunk of chunks) {
    if (chunk.type !== "iTXt") {
      continue;
    }

    let parsed: { keyword: string; text: string };

    try {
      parsed = parseItxt(chunk.data);
    } catch {
      continue;
    }

    if (parsed.keyword === ARR_KEYWORD) {
      return parseSignedAttestationJson(parsed.text);
    }
  }

  return null;
}

export function embedPngAttestation(buffer: Buffer, signed: SignedAttestation): Buffer {
  const chunks = parseChunks(buffer);
  const arrChunk = createChunk("iTXt", encodeItxt(ARR_KEYWORD, serializeSignedAttestation(signed)));
  const outChunks: Buffer[] = [];
  let inserted = false;

  for (const chunk of chunks) {
    if (chunk.type === "iTXt") {
      let parsed: { keyword: string; text: string } | null = null;

      try {
        parsed = parseItxt(chunk.data);
      } catch {
        parsed = null;
      }

      if (parsed && parsed.keyword === ARR_KEYWORD) {
        continue;
      }
    }

    if (chunk.type === "IEND" && !inserted) {
      outChunks.push(arrChunk);
      inserted = true;
    }

    outChunks.push(chunk.raw);
  }

  if (!inserted) {
    throw new ArrError("invalid_png", "PNG is missing an IEND chunk.");
  }

  return Buffer.concat([PNG_SIGNATURE, ...outChunks]);
}
