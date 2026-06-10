'use client';

import { FileText } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { blobViewUrl } from '@/lib/blob-paths';

type Props = {
  path: string | null;
};

// Receipt previews live in a private Vercel Blob store. On click we open our
// authenticated streaming route in a new tab — the route verifies the session
// and the org-path before streaming the file. We never render inline; PDFs and
// images both just open in a new tab for simplicity.
export function ReceiptThumbnail({ path }: Props) {
  const t = useTranslations('budget');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!path) {
    return null;
  }

  function handleOpen() {
    if (!path) {
      return;
    }
    setError(null);
    setLoading(true);
    const url = blobViewUrl(path);
    if (!url) {
      setError(t('transactions.receiptFailed'));
      setLoading(false);
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
    setLoading(false);
  }

  return (
    <div className="inline-flex flex-col items-start gap-0.5">
      <button
        type="button"
        onClick={handleOpen}
        disabled={loading}
        className="inline-flex items-center gap-1 rounded-sm border border-border-subtle bg-surface px-1.5 py-0.5 text-xs text-text-muted hover:border-border hover:text-text-default disabled:opacity-50"
        aria-label={t('transactions.viewReceipt')}
      >
        <FileText size={12} strokeWidth={1.5} />
        {t('transactions.viewReceipt')}
      </button>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </div>
  );
}
