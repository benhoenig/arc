'use client';

import { Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { useRouter } from '@/i18n/navigation';
import { deleteContractor } from '../actions/delete-contractor';

type Props = {
  id: string;
  name: string;
  hasActiveAssignments: boolean;
};

export function DeleteContractorButton({ id, name, hasActiveAssignments }: Props) {
  const t = useTranslations('contractors.detail');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    if (hasActiveAssignments) {
      setError(t('deleteBlocked'));
      return;
    }
    if (!confirm(t('confirmDelete', { name }))) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await deleteContractor({ id });
      if (!result.ok) {
        setError(
          result.error === 'conflict' && result.message === 'has_active_assignments'
            ? t('deleteBlocked')
            : result.error,
        );
        return;
      }
      router.push('/contractors');
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="ghost"
        size="sm"
        onClick={handleClick}
        disabled={isPending || hasActiveAssignments}
        className="text-text-muted hover:text-destructive"
      >
        <Trash2 size={14} strokeWidth={1.5} className="mr-1" />
        {tCommon('delete')}
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
