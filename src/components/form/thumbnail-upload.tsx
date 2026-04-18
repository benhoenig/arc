'use client';

import { ImagePlus, Loader2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { getThumbnailUrl, PROPERTY_THUMBNAIL_BUCKET } from '@/lib/property-thumbnail';
import { supabaseBrowser } from '@/lib/supabase/browser-client';
import { cn } from '@/lib/utils';

type Props = {
  orgId: string;
  value: string | null;
  onChange: (path: string | null) => void;
};

const MAX_SIZE = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

function getExtension(file: File): string {
  const match = /\.(jpg|jpeg|png|webp|gif)$/i.exec(file.name);
  if (match?.[1]) {
    return match[1].toLowerCase();
  }
  const subtype = file.type.split('/')[1];
  return subtype === 'jpeg' ? 'jpg' : subtype || 'jpg';
}

export function ThumbnailUpload({ orgId, value, onChange }: Props) {
  const t = useTranslations('sourcing.propertyForm');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewUrl = getThumbnailUrl(value);

  async function handleFile(file: File) {
    setError(null);
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError(t('thumbnailInvalidType'));
      return;
    }
    if (file.size > MAX_SIZE) {
      setError(t('thumbnailTooLarge'));
      return;
    }

    setUploading(true);
    try {
      const ext = getExtension(file);
      const id = crypto.randomUUID();
      const path = `${orgId}/${id}.${ext}`;

      const { error: uploadError } = await supabaseBrowser.storage
        .from(PROPERTY_THUMBNAIL_BUCKET)
        .upload(path, file, { cacheControl: '3600', upsert: false });

      if (uploadError) {
        console.error('thumbnail upload failed', uploadError);
        setError(t('thumbnailUploadFailed'));
        return;
      }

      onChange(path);
    } finally {
      setUploading(false);
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      void handleFile(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  function handleRemove() {
    onChange(null);
    setError(null);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        onChange={handleInputChange}
        className="hidden"
      />

      {previewUrl ? (
        <div className="relative w-fit">
          {/* biome-ignore lint/performance/noImgElement: user-uploaded dynamic URL */}
          <img
            src={previewUrl}
            alt=""
            className="h-32 w-32 rounded-md border border-border object-cover"
          />
          <button
            type="button"
            onClick={handleRemove}
            disabled={uploading}
            className="absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full border border-border bg-background text-text-muted shadow-sm hover:text-destructive"
            aria-label={t('thumbnailRemove')}
          >
            <X size={14} strokeWidth={1.5} />
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="absolute inset-x-0 bottom-0 rounded-b-md bg-black/60 py-1 text-xs text-white opacity-0 transition-opacity hover:opacity-100"
          >
            {t('thumbnailReplace')}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className={cn(
            'flex h-32 w-32 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border text-text-muted transition-colors',
            'hover:border-border-strong hover:text-text-default',
            uploading && 'cursor-wait',
          )}
        >
          {uploading ? (
            <Loader2 size={20} strokeWidth={1.5} className="animate-spin" />
          ) : (
            <>
              <ImagePlus size={20} strokeWidth={1.5} />
              <span className="text-xs">{t('thumbnailUpload')}</span>
            </>
          )}
        </button>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
