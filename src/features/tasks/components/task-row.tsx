'use client';

import { Check, Circle, Pencil, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { Pill } from '@/components/data-display/pill';
import { cn } from '@/lib/utils';
import { completeTask } from '../actions/complete-task';
import { deleteTask } from '../actions/delete-task';
import { reopenTask } from '../actions/reopen-task';
import type { FlipTask } from '../queries/list-tasks-for-flip';
import { DueDatePill } from './due-date-pill';

type Props = {
  task: FlipTask;
  onEdit: (task: FlipTask) => void;
};

function assigneeLabel(user: FlipTask['assignedToUser']): string | null {
  if (!user) {
    return null;
  }
  return user.fullName ?? user.displayName ?? user.email;
}

export function TaskRow({ task, onEdit }: Props) {
  const t = useTranslations('tasks');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const isDone = task.status === 'done';
  const isCanceled = task.status === 'canceled';
  const assignee = assigneeLabel(task.assignedToUser);

  function toggleComplete() {
    startTransition(async () => {
      const result = isDone
        ? await reopenTask({ id: task.id })
        : await completeTask({ id: task.id });
      if (result.ok) {
        router.refresh();
      }
    });
  }

  function handleDelete() {
    if (!window.confirm(t('actions.confirmDelete'))) {
      return;
    }
    startTransition(async () => {
      const result = await deleteTask({ id: task.id });
      if (result.ok) {
        router.refresh();
      }
    });
  }

  return (
    <div className="group flex items-start gap-3 px-3 py-2.5 hover:bg-fill-hover">
      <button
        type="button"
        onClick={toggleComplete}
        disabled={isPending}
        aria-label={isDone ? t('actions.reopen') : t('actions.complete')}
        className={cn(
          'mt-0.5 shrink-0 rounded-full text-text-muted transition-colors hover:text-text-strong',
          isDone && 'text-positive hover:text-positive',
        )}
      >
        {isDone ? <Check size={18} strokeWidth={2} /> : <Circle size={18} strokeWidth={1.5} />}
      </button>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'text-sm text-text-default',
            (isDone || isCanceled) && 'text-text-muted line-through',
          )}
        >
          {task.title}
        </p>
        {(assignee || task.priority !== 'normal' || isCanceled) && (
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-muted">
            {task.priority !== 'normal' ? (
              <span className="text-text-muted">{t(`priority.${task.priority}`)}</span>
            ) : null}
            {assignee ? <span className="truncate">{assignee}</span> : null}
            {isCanceled ? <Pill variant="muted">{t('status.canceled')}</Pill> : null}
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {!isDone && !isCanceled ? <DueDatePill dueDate={task.dueDate} isDone={isDone} /> : null}
        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={() => onEdit(task)}
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
      </div>
    </div>
  );
}
