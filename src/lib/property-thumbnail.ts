import { blobViewUrl } from './blob-paths';

/**
 * Resolve a stored property-thumbnail pathname to a renderable URL.
 *
 * Thumbnails live in a private Vercel Blob store, so the URL points at our
 * authenticated streaming route rather than a public CDN URL.
 * Paths look like `thumbnails/{orgId}/{uuid}.{ext}`.
 */
export function getThumbnailUrl(path: string | null | undefined): string | null {
  return blobViewUrl(path);
}
