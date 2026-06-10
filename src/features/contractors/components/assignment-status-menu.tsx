'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { setAssignmentStatus } from '../actions/set-assignment-status';
import {
  type AssignmentStatus,
  canTransitionAssignmentStatus,
} from '../validators/contractor-schemas';

type Props = {
  assignmentId: string;
  currentStatus: AssignmentStatus;
  disabled?: boolean;
};

const ALL_STATUSES: AssignmentStatus[] = ['draft', 'active', 'completed', 'canceled', 'disputed'];

export function AssignmentStatusMenu({ assignmentId, currentStatus, disabled }: Props) {
  const t = useTranslations('contractors.statuses');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleChange(nextStatus: AssignmentStatus) {
    if (nextStatus === currentStatus) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await setAssignmentStatus({ id: assignmentId, status: nextStatus });
      if (!result.ok) {
        setError(result.error === 'conflict' ? (result.message ?? 'conflict') : result.error);
      }
    });
  }

  const options = ALL_STATUSES.filter(
    (s) => s === currentStatus || canTransitionAssignmentStatus(currentStatus, s),
  );

  return (
    <div className="inline-flex flex-col items-end gap-0.5">
      <Select
        value={currentStatus}
        onValueChange={(v) => handleChange(v as AssignmentStatus)}
        disabled={disabled || isPending || options.length === 1}
      >
        <SelectTrigger className="h-7 w-auto min-w-[110px] border-0 bg-transparent px-2 text-xs shadow-none hover:bg-fill-hover">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((s) => (
            <SelectItem key={s} value={s}>
              {t(s)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </div>
  );
}
