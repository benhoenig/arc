'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { OrgUserOption } from '@/features/flips/queries/list-org-users';
import { createTask } from '../actions/create-task';
import { updateTask } from '../actions/update-task';
import type { FlipTask } from '../queries/list-tasks-for-flip';
import { TASK_PRIORITIES, type TaskPriority } from '../validators/task-schemas';

const UNASSIGNED = '__unassigned__';

// @db.Date → yyyy-mm-dd for <input type="date"> (read UTC calendar parts).
function toDateInput(date: Date | string | null): string {
  if (date == null) {
    return '';
  }
  const d = typeof date === 'string' ? new Date(date) : date;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
    d.getUTCDate(),
  ).padStart(2, '0')}`;
}

function userLabel(u: OrgUserOption): string {
  return u.fullName ?? u.displayName ?? u.email;
}

type Props = {
  flipId: string;
  candidates: OrgUserOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: FlipTask;
};

export function TaskForm({ flipId, candidates, open, onOpenChange, task }: Props) {
  const t = useTranslations('tasks');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const isEdit = task != null;

  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [priority, setPriority] = useState<TaskPriority>(
    (task?.priority as TaskPriority) ?? 'normal',
  );
  const [assignee, setAssignee] = useState(task?.assignedToUserId ?? UNASSIGNED);
  const [dueDate, setDueDate] = useState(toDateInput(task?.dueDate ?? null));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (trimmed.length === 0) {
      return;
    }
    setError(null);

    startTransition(async () => {
      const assignedToUserId = assignee === UNASSIGNED ? null : assignee;
      const result = isEdit
        ? await updateTask({
            id: task.id,
            title: trimmed,
            description: description.trim() === '' ? null : description.trim(),
            priority,
            assignedToUserId,
            dueDate: dueDate === '' ? null : dueDate,
          })
        : await createTask({
            flipId,
            title: trimmed,
            description: description.trim() === '' ? undefined : description.trim(),
            priority,
            assignedToUserId: assignedToUserId ?? undefined,
            dueDate: dueDate === '' ? undefined : dueDate,
          });

      if (!result.ok) {
        setError(result.error === 'validation' ? t('errors.validation') : t('errors.server'));
        return;
      }
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? t('form.editTitle') : t('form.createTitle')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>{t('form.title')} *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('form.titlePlaceholder')}
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{t('form.description')}</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>{t('form.priority')}</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {t(`priority.${p}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>{t('form.dueDate')}</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{t('form.assignee')}</Label>
            <Select value={assignee} onValueChange={setAssignee}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNASSIGNED}>{t('form.unassigned')}</SelectItem>
                {candidates.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {userLabel(u)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={isPending || title.trim().length === 0}>
              {isEdit ? tCommon('save') : tCommon('add')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
