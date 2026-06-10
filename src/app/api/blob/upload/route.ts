import { type HandleUploadBody, handleUpload } from '@vercel/blob/client';
import { NextResponse } from 'next/server';
import { type BlobKind, contentTypesForKind, maxBytesForKind } from '@/lib/blob-paths';
import { getCurrentUser } from '@/server/auth';
import { db } from '@/server/db';

/**
 * Issues short-lived client-upload tokens for the private Blob store. The
 * browser calls this via `upload(..., { handleUploadUrl: '/api/blob/upload' })`
 * then PUTs the file straight to Vercel Blob (no 4.5 MB server-action limit).
 *
 * Auth + tenant isolation are enforced HERE, before any token is minted:
 * the caller must be authenticated, and the requested pathname must live under
 * their active org's prefix for the declared kind. The store-level token comes
 * from BLOB_READ_WRITE_TOKEN (handleUpload's default).
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const user = await getCurrentUser();
        if (!user) {
          throw new Error('unauthorized');
        }

        const role = await db.userRole.findFirst({
          where: { userId: user.id, deletedAt: null },
          select: { organizationId: true },
        });
        if (!role) {
          throw new Error('no_org');
        }
        const orgId = role.organizationId;

        const { kind } = JSON.parse(clientPayload || '{}') as { kind?: BlobKind };
        if (kind !== 'thumbnail' && kind !== 'receipt') {
          throw new Error('bad_kind');
        }

        const expectedPrefix = kind === 'thumbnail' ? 'thumbnails/' : 'receipts/';
        if (!pathname.startsWith(`${expectedPrefix}${orgId}/`)) {
          throw new Error('path_forbidden');
        }

        return {
          allowedContentTypes: contentTypesForKind(kind),
          maximumSizeInBytes: maxBytesForKind(kind),
          addRandomSuffix: false,
        };
      },
      // Fires only on deployed Vercel (not localhost). We persist the pathname
      // from the upload() return value in the existing create actions instead,
      // so this is intentionally a no-op.
      onUploadCompleted: async () => {},
    });

    return NextResponse.json(json);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'upload_failed' },
      { status: 400 },
    );
  }
}
