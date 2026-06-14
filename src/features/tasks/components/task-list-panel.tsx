'use client';

import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { OrgUserOption } from '@/features/flips/queries/list-org-users';
import type { FlipTask } from '../queries/list-tasks-for-flip';
import { TaskForm } from './task-form';
import { TaskQuickAdd } from './task-quick-add';
import { TaskRow } from './task-row';

type Props = {
  flipId: string;
  tasks: FlipTask[];
  candidates: OrgUserOption[];
};

// Priority order for sorting open tasks: urgent first.
const PRIORITY_RANK: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

export function TaskListPanel({ flipId, tasks, candidates }: Props) {
  const t = useTranslations('tasks');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<FlipTask | undefined>(undefined);

  const { open, done } = useMemo(() => {
    const openTasks = tasks
      .filter((task) => task.status !== 'done' && task.status !== 'canceled')
      .sort((a, b) => {
        // Overdue/dated tasks bubble up by date; then by priority.
        const da = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
        const dbb = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
        if (da !== dbb) {
          return da - dbb;
        }
        return (PRIORITY_RANK[a.priority] ?? 2) - (PRIORITY_RANK[b.priority] ?? 2);
      });
    const doneTasks = tasks.filter((task) => task.status === 'done' || task.status === 'canceled');
    return { open: openTasks, done: doneTasks };
  }, [tasks]);

  function startCreate() {
    setEditing(undefined);
    setFormOpen(true);
  }

  function startEdit(task: FlipTask) {
    setEditing(task);
    setFormOpen(true);
  }

  return (
    <div className="rounded-md border border-border">
      <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
        <h2 className="text-sm font-semibold text-text-strong">{t('title')}</h2>
        <Button size="sm" variant="outline" onClick={startCreate}>
          <Plus size={14} strokeWidth={1.5} className="mr-1" />
          {t('actions.addDetailed')}
        </Button>
      </div>

      <TaskQuickAdd flipId={flipId} />

      {tasks.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-text-muted">{t('empty')}</p>
      ) : (
        <div className="divide-y divide-border-subtle">
          {open.map((task) => (
            <TaskRow key={task.id} task={task} onEdit={startEdit} />
          ))}
          {done.length > 0 ? (
            <div>
              <p className="px-3 pt-3 pb-1 text-xs font-medium uppercase tracking-wider text-text-muted">
                {t('sections.done')}
              </p>
              {done.map((task) => (
                <TaskRow key={task.id} task={task} onEdit={startEdit} />
              ))}
            </div>
          ) : null}
        </div>
      )}

      {/* Single form instance reused for create + edit; `editing` selects mode. */}
      <TaskForm
        key={editing?.id ?? 'create'}
        flipId={flipId}
        candidates={candidates}
        open={formOpen}
        onOpenChange={setFormOpen}
        task={editing}
      />
    </div>
  );
}
