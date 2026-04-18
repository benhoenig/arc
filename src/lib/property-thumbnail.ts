export const PROPERTY_THUMBNAIL_BUCKET = 'property-thumbnails';

/**
 * Construct a public URL for a property thumbnail path.
 * Paths look like `{orgId}/{uuid}.{ext}`.
 */
export function getThumbnailUrl(path: string | null | undefined): string | null {
  if (!path) {
    return null;
  }
  // biome-ignore lint/style/noNonNullAssertion: inlined at build time
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  return `${base}/storage/v1/object/public/${PROPERTY_THUMBNAIL_BUCKET}/${path}`;
}
