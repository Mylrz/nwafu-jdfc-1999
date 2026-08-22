export const ARCHIVE_SQUADS = [
  "men-futsal",
  "men-11",
  "women-futsal",
  "mixed",
  "other",
] as const;

export const MEDIA_RIGHTS_STATUSES = ["pending", "cleared", "restricted"] as const;
export const MEDIA_ASSET_STATUSES = ["draft", "published", "archived"] as const;
export const SEASON_ARCHIVE_STATUSES = ["draft", "published", "archived"] as const;

export const ARCHIVE_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
]);

export const PUBLIC_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export type ArchiveSquad = (typeof ARCHIVE_SQUADS)[number];
export type MediaRightsStatus = (typeof MEDIA_RIGHTS_STATUSES)[number];
export type MediaAssetStatus = (typeof MEDIA_ASSET_STATUSES)[number];
export type SeasonArchiveStatus = (typeof SEASON_ARCHIVE_STATUSES)[number];

export function isArchiveSquad(value: string): value is ArchiveSquad {
  return (ARCHIVE_SQUADS as readonly string[]).includes(value);
}

export function isMediaRightsStatus(value: string): value is MediaRightsStatus {
  return (MEDIA_RIGHTS_STATUSES as readonly string[]).includes(value);
}

export function isMediaAssetStatus(value: string): value is MediaAssetStatus {
  return (MEDIA_ASSET_STATUSES as readonly string[]).includes(value);
}

export function isSeasonArchiveStatus(value: string): value is SeasonArchiveStatus {
  return (SEASON_ARCHIVE_STATUSES as readonly string[]).includes(value);
}

export function cleanText(value: unknown, maxLength: number) {
  return String(value ?? "").trim().slice(0, maxLength);
}

export function cleanSlug(value: unknown) {
  return cleanText(value, 80).toLowerCase();
}

export function isValidSlug(value: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

export function nextArchiveVersion(expectedUpdatedAt: string) {
  const expectedTime = Date.parse(expectedUpdatedAt);
  return new Date(Number.isFinite(expectedTime) ? Math.max(Date.now(), expectedTime + 1) : Date.now()).toISOString();
}
