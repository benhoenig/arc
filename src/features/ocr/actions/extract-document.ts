'use server';

import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { get } from '@vercel/blob';
import { pathBelongsToOrg } from '@/lib/blob-paths';
import { getActiveOrgId, requireAuth } from '@/server/auth';
import type { ActionResult } from '@/types/common';
import { getAnthropicClient, OCR_MODEL } from '../lib/anthropic';
import {
  type ExtractedRow,
  type ExtractionMode,
  type ExtractionTarget,
  extractionEnvelope,
  TARGET_CONFIG,
} from '../validators/extraction-schemas';

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

type ExtractInput = {
  target: ExtractionTarget;
  mode: ExtractionMode;
  blobPathname: string;
};

export async function extractFromDocument(
  input: ExtractInput,
): Promise<ActionResult<{ target: ExtractionTarget; items: ExtractedRow[] }>> {
  await requireAuth();
  const orgId = await getActiveOrgId();

  const client = getAnthropicClient();
  if (!client) {
    return { ok: false, error: 'conflict', message: 'ocr_not_configured' };
  }

  // Tenant guard — only read blobs under the caller's org.
  if (!pathBelongsToOrg(input.blobPathname, orgId)) {
    return { ok: false, error: 'forbidden' };
  }

  try {
    const blob = await get(input.blobPathname, { access: 'private' });
    if (!blob) {
      return { ok: false, error: 'not_found' };
    }
    const bytes = Buffer.from(await new Response(blob.stream).arrayBuffer());
    const base64 = bytes.toString('base64');
    const contentType = blob.blob.contentType ?? '';

    const config = TARGET_CONFIG[input.target];
    const isPdf = contentType === 'application/pdf';
    if (!isPdf && !IMAGE_TYPES.has(contentType)) {
      return { ok: false, error: 'conflict', message: 'unsupported_file_type' };
    }

    const filePart = isPdf
      ? {
          type: 'document' as const,
          source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: base64 },
        }
      : {
          type: 'image' as const,
          source: {
            type: 'base64' as const,
            media_type: contentType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
            data: base64,
          },
        };

    const instruction =
      input.mode === 'single'
        ? `This document is a single entry. Extract exactly one item — ${config.rowHint}.`
        : `This document lists multiple entries (e.g. a contractor's scope of work or an itemized receipt). Extract every distinct line item. Each item is ${config.rowHint}. Do not invent rows; only extract what is on the document. Skip subtotals, totals, tax lines, and headers.`;

    const response = await client.messages.parse({
      model: OCR_MODEL,
      max_tokens: 4096,
      system:
        'You extract structured data from Thai property-renovation documents (receipts, quotations, contractor scopes of work). Amounts are Thai Baht — return them as plain numbers with no commas, currency symbols, or spaces. Preserve Thai text exactly as written.',
      messages: [
        {
          role: 'user',
          content: [filePart, { type: 'text', text: instruction }],
        },
      ],
      output_config: { format: zodOutputFormat(extractionEnvelope(input.target)) },
    });

    if (response.stop_reason === 'refusal') {
      return { ok: false, error: 'conflict', message: 'extraction_refused' };
    }

    const parsed = response.parsed_output;
    if (!parsed) {
      return { ok: false, error: 'conflict', message: 'extraction_failed' };
    }

    return { ok: true, data: { target: input.target, items: parsed.items as ExtractedRow[] } };
  } catch (error) {
    console.error('extractFromDocument failed', error);
    return { ok: false, error: 'server' };
  }
}
