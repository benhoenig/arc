import { get } from '@vercel/blob';
import { type NextRequest, NextResponse } from 'next/server';
import { pathBelongsToOrg } from '@/lib/blob-paths';
import { getCurrentUser } from '@/server/auth';
import { db } from '@/server/db';

/**
 * Authenticated delivery for private blobs (thumbnails + receipts). Private
 * blobs have no public URL, so every read streams through here.
 *
 * Auth is verified in the handler (NOT middleware — per Vercel's guidance, a
 * middleware bug could expose cached private content). We also confirm the
 * pathname lives under the caller's active org before fetching.
 *
 * Receipts hold bank details → `no-store`. Thumbnails → `no-cache` (browser may
 * keep a revalidated copy). Both keep auth on every request.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const pathname = request.nextUrl.searchParams.get('pathname');
  if (!pathname) {
    return NextResponse.json({ error: 'missing_pathname' }, { status: 400 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const role = await db.userRole.findFirst({
    where: { userId: user.id, deletedAt: null },
    select: { organizationId: true },
  });
  if (!role || !pathBelongsToOrg(pathname, role.organizationId)) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const result = await get(pathname, {
    access: 'private',
    ifNoneMatch: request.headers.get('if-none-match') ?? undefined,
  });

  if (!result) {
    return new NextResponse('Not found', { status: 404 });
  }

  const cacheControl = pathname.startsWith('receipts/') ? 'private, no-store' : 'private, no-cache';

  if (result.statusCode === 304) {
    return new NextResponse(null, {
      status: 304,
      headers: { ETag: result.blob.etag, 'Cache-Control': cacheControl },
    });
  }

  return new NextResponse(result.stream, {
    headers: {
      'Content-Type': result.blob.contentType,
      'X-Content-Type-Options': 'nosniff',
      ETag: result.blob.etag,
      'Cache-Control': cacheControl,
    },
  });
}
