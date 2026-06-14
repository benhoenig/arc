'use client';

import { Circle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useMemo, useTransition } from 'react';
import { Link } from '@/i18n/navigation';
import { completeTask } from '../actions/complete-task';
import type { UserTask } from '../queries/list-tasks-for-user';
import { DueDatePill } from './due-date-pill';

type Props = {
  tasks: UserTask[];
};

type FlipGroup = {
  flipId: string;
  code: string;
  name: string;
  tasks: UserTask[];
};

export function MyTasksList({ tasks }: Props) {
  const t = useTranslations('tasks');

  const groups = useMemo<FlipGroup[]>(() => {
    const byFlip = new Map<string, FlipGroup>();
    for (const task of tasks) {
      const existing = byFlip.get(task.flipId);
      if (existing) {
        existing.tasks.push(task);
      } else {
        byFlip.set(task.flipId, {
          flipId: task.flipId,
          code: task.flip.code,
          name: task.flip.name,
          tasks: [task],
        });
      }
    }
    return [...byFlip.values()].sort((a, b) => a.code.localeCompare(b.code));
  }, [tasks]);

  if (tasks.length === 0) {
    return (
      <div className="rounded-md border border-border bg-surface px-4 py-12 text-center text-sm text-text-muted">
        {t('myTasks.empty')}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => (
        <div key={group.flipId} className="rounded-md border border-border">
          <div className="flex items-center justify-between border-b border-border-subtle px-4 py-2.5">
            <Link
              href={`/flips/${group.flipId}/tasks`}
              className="text-sm font-medium text-text-strong hover:underline"
            >
              {group.code} · {group.name}
            </Link>
          </div>
          <div className="divide-y divide-border-subtle">
            {group.tasks.map((task) => (
              <MyTaskRow key={task.id} task={task} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function MyTaskRow({ task }: { task: UserTask }) {
  const t = useTranslations('tasks');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function complete() {
    startTransition(async () => {
      const result = await completeTask({ id: task.id });
      if (result.ok) {
        router.refresh();
      }
    });
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-fill-hover">
      <button
        type="button"
        onClick={complete}
        disabled={isPending}
        aria-label={t('actions.complete')}
        className="shrink-0 text-text-muted transition-colors hover:text-positive"
      >
        <Circle size={18} strokeWidth={1.5} />
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-text-default">{task.title}</p>
        {task.priority !== 'normal' ? (
          <p className="mt-0.5 text-xs text-text-muted">{t(`priority.${task.priority}`)}</p>
        ) : null}
      </div>
      <DueDatePill dueDate={task.dueDate} />
    </div>
  );
}
