export const supportedUploadTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
] as const;

export type SupportedUploadType = (typeof supportedUploadTypes)[number];

function matches(bytes: Uint8Array, signature: readonly number[], offset = 0) {
  return signature.every((value, index) => bytes[offset + index] === value);
}

function ascii(bytes: Uint8Array, offset: number, length: number) {
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

function isHeic(bytes: Uint8Array) {
  if (bytes.length < 16 || ascii(bytes, 4, 4) !== "ftyp") return false;

  const declaredBoxSize = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0);
  const boxEnd = declaredBoxSize === 0
    ? bytes.length
    : Math.min(bytes.length, Math.max(16, declaredBoxSize));
  const heicBrands = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis", "hevm", "hevs"]);

  if (heicBrands.has(ascii(bytes, 8, 4))) return true;
  for (let offset = 16; offset + 4 <= boxEnd; offset += 4) {
    if (heicBrands.has(ascii(bytes, offset, 4))) return true;
  }
  return false;
}

export function detectUploadType(input: ArrayBuffer | Uint8Array): SupportedUploadType | null {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.length >= 3 && matches(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (bytes.length >= 8 && matches(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") {
    return "image/webp";
  }
  if (bytes.length >= 5 && ascii(bytes, 0, 5) === "%PDF-") return "application/pdf";
  if (isHeic(bytes)) return "image/heic";
  return null;
}

export function hasEmbeddedExif(input: ArrayBuffer | Uint8Array) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  if (bytes.length >= 4 && matches(bytes, [0xff, 0xd8])) {
    let offset = 2;
    while (offset + 4 <= bytes.length) {
      if (bytes[offset] !== 0xff) break;
      const marker = bytes[offset + 1];
      offset += 2;
      if (marker === 0xd9 || marker === 0xda) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 2 > bytes.length) break;
      const length = view.getUint16(offset);
      if (length < 2 || offset + length > bytes.length) break;
      if (marker === 0xe1 && length >= 8 && ascii(bytes, offset + 2, 4) === "Exif") return true;
      offset += length;
    }
    return false;
  }

  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") {
    let offset = 12;
    while (offset + 8 <= bytes.length) {
      const chunkType = ascii(bytes, offset, 4);
      const chunkSize = view.getUint32(offset + 4, true);
      if (chunkType === "EXIF") return true;
      offset += 8 + chunkSize + (chunkSize % 2);
    }
    return false;
  }

  if (bytes.length >= 8 && matches(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    let offset = 8;
    while (offset + 12 <= bytes.length) {
      const chunkSize = view.getUint32(offset);
      const chunkType = ascii(bytes, offset + 4, 4);
      if (chunkType === "eXIf") return true;
      offset += 12 + chunkSize;
    }
  }

  return false;
}

export function isSupportedUploadType(value: string | null | undefined): value is SupportedUploadType {
  return supportedUploadTypes.includes(value as SupportedUploadType);
}

export async function validateUploadFile(
  file: File,
  allowedTypes: readonly SupportedUploadType[],
) {
  const declaredType = file.type.trim().toLowerCase();
  const bytes = await file.arrayBuffer();
  const detectedType = detectUploadType(bytes);
  const valid = isSupportedUploadType(declaredType)
    && allowedTypes.includes(declaredType)
    && detectedType === declaredType;

  if (!valid || !detectedType) return { ok: false as const };
  return { ok: true as const, bytes, contentType: detectedType };
}

export function safeStoredContentType(
  candidates: readonly (string | null | undefined)[],
  allowedTypes: readonly SupportedUploadType[],
  fallback = "application/octet-stream",
) {
  for (const candidate of candidates) {
    const normalized = candidate?.trim().toLowerCase();
    if (isSupportedUploadType(normalized) && allowedTypes.includes(normalized)) return normalized;
  }
  return fallback;
}
