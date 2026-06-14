/**
 * Shared, client-safe helpers for Vercel Blob storage (no server-only imports).
 *
 * One PRIVATE Blob store holds both thumbnails and receipts. Pathnames are
 * prefixed by kind + org so the streaming route can enforce tenant isolation:
 *   thumbnails/{orgId}/{uuid}.{ext}
 *   receipts/{orgId}/{flipId}/{uuid}.{ext}
 *
 * Reads go through our authenticated route (`/api/blob/view`) — private blobs
 * have no public URL.
 */

export type BlobKind = 'thumbnail' | 'receipt';

export const THUMBNAIL_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const RECEIPT_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

export const THUMBNAIL_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
export const RECEIPT_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export function buildThumbnailPath(orgId: string, ext: string): string {
  return `thumbnails/${orgId}/${crypto.randomUUID()}.${ext}`;
}

export function buildReceiptPath(orgId: string, flipId: string, ext: string): string {
  return `receipts/${orgId}/${flipId}/${crypto.randomUUID()}.${ext}`;
}

/** Path for a document uploaded only for AI extraction (not tied to a flip). */
export function buildOcrDocPath(orgId: string, ext: string): string {
  return `receipts/${orgId}/_ocr/${crypto.randomUUID()}.${ext}`;
}

/** URL of our authenticated streaming route for a stored blob pathname. */
export function blobViewUrl(pathname: string | null | undefined): string | null {
  if (!pathname) {
    return null;
  }
  return `/api/blob/view?pathname=${encodeURIComponent(pathname)}`;
}

/** Tenant-isolation check used by both upload + view routes. */
export function pathBelongsToOrg(pathname: string, orgId: string): boolean {
  return pathname.startsWith(`thumbnails/${orgId}/`) || pathname.startsWith(`receipts/${orgId}/`);
}

export function contentTypesForKind(kind: BlobKind): string[] {
  return kind === 'thumbnail' ? THUMBNAIL_CONTENT_TYPES : RECEIPT_CONTENT_TYPES;
}

export function maxBytesForKind(kind: BlobKind): number {
  return kind === 'thumbnail' ? THUMBNAIL_MAX_BYTES : RECEIPT_MAX_BYTES;
}
