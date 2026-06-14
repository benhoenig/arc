'use client';

import { CircleCheck, CircleDashed, Pencil, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { Pill } from '@/components/data-display/pill';
import { Button } from '@/components/ui/button';
import { formatDateShort } from '@/lib/formatters/date';
import type { Locale } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { deleteMilestone } from '../actions/delete-milestone';
import { markMilestoneActual } from '../actions/mark-milestone-actual';
import type { FlipMilestone } from '../queries/list-milestones-for-flip';
import { MilestoneForm } from './milestone-form';

type Props = {
  flipId: string;
  milestones: FlipMilestone[];
};

// Days between actual and target (UTC calendar). Negative = early, 0 = on time,
// positive = late. Directionality: late is the bad outcome → warning.
function varianceDays(target: Date | string, actual: Date | string): number {
  const t = typeof target === 'string' ? new Date(target) : target;
  const a = typeof actual === 'string' ? new Date(actual) : actual;
  const tm = Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate());
  const am = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  return Math.round((am - tm) / 86_400_000);
}

function todayInput(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate(),
  ).padStart(2, '0')}`;
}

export function TimelinePanel({ flipId, milestones }: Props) {
  const t = useTranslations('tasks');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<FlipMilestone | undefined>(undefined);

  function startCreate() {
    setEditing(undefined);
    setFormOpen(true);
  }
  function startEdit(milestone: FlipMilestone) {
    setEditing(milestone);
    setFormOpen(true);
  }

  return (
    <div className="rounded-md border border-border">
      <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
        <h2 className="text-sm font-semibold text-text-strong">{t('timeline.title')}</h2>
        <Button size="sm" variant="outline" onClick={startCreate}>
          <Plus size={14} strokeWidth={1.5} className="mr-1" />
          {t('actions.addMilestone')}
        </Button>
      </div>

      {milestones.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-text-muted">{t('timeline.empty')}</p>
      ) : (
        <ol className="divide-y divide-border-subtle">
          {milestones.map((m) => (
            <MilestoneRow key={m.id} milestone={m} onEdit={startEdit} />
          ))}
        </ol>
      )}

      <MilestoneForm
        key={editing?.id ?? 'create'}
        flipId={flipId}
        open={formOpen}
        onOpenChange={setFormOpen}
        milestone={editing}
      />
    </div>
  );
}

function MilestoneRow({
  milestone,
  onEdit,
}: {
  milestone: FlipMilestone;
  onEdit: (m: FlipMilestone) => void;
}) {
  const t = useTranslations('tasks');
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const isHit = milestone.actualDate != null;

  function toggleHit() {
    startTransition(async () => {
      const result = await markMilestoneActual({
        id: milestone.id,
        actualDate: isHit ? null : todayInput(),
      });
      if (result.ok) {
        router.refresh();
      }
    });
  }

  function handleDelete() {
    if (!window.confirm(t('actions.confirmDeleteMilestone'))) {
      return;
    }
    startTransition(async () => {
      const result = await deleteMilestone({ id: milestone.id });
      if (result.ok) {
        router.refresh();
      }
    });
  }

  let variancePill: React.ReactNode = null;
  if (isHit && milestone.actualDate) {
    const diff = varianceDays(milestone.targetDate, milestone.actualDate);
    if (diff > 0) {
      variancePill = <Pill variant="warning">{`${t('timeline.late')} +${diff}`}</Pill>;
    } else if (diff < 0) {
      variancePill = <Pill variant="positive">{`${t('timeline.early')} ${diff}`}</Pill>;
    } else {
      variancePill = <Pill variant="positive">{t('timeline.onTime')}</Pill>;
    }
  }

  return (
    <li className="group flex items-start gap-3 px-4 py-3 hover:bg-fill-hover">
      <button
        type="button"
        onClick={toggleHit}
        disabled={isPending}
        aria-label={isHit ? t('timeline.reopen') : t('timeline.markHit')}
        className={cn(
          'mt-0.5 shrink-0 transition-colors',
          isHit ? 'text-positive' : 'text-text-muted hover:text-text-strong',
        )}
      >
        {isHit ? (
          <CircleCheck size={18} strokeWidth={1.5} />
        ) : (
          <CircleDashed size={18} strokeWidth={1.5} />
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-text-default">{milestone.title}</p>
          {milestone.isCritical ? <Pill variant="neutral">{t('timeline.critical')}</Pill> : null}
          {variancePill}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs text-text-muted">
          <span>
            {t('timeline.target')}: {formatDateShort(milestone.targetDate, locale)}
          </span>
          {milestone.actualDate ? (
            <span>
              {t('timeline.actual')}: {formatDateShort(milestone.actualDate, locale)}
            </span>
          ) : null}
        </div>
        {milestone.description ? (
          <p className="mt-1 text-xs text-text-muted">{milestone.description}</p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={() => onEdit(milestone)}
          aria-label={t('actions.edit')}
          className="rounded p-1 text-text-muted hover:bg-fill-selected hover:text-text-default"
        >
          <Pencil size={14} strokeWidth={1.5} />
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending}
          aria-label={t('actions.delete')}
          className="rounded p-1 text-text-muted hover:bg-destructive-fill hover:text-destructive"
        >
          <Trash2 size={14} strokeWidth={1.5} />
        </button>
      </div>
    </li>
  );
}
