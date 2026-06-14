'use client';

import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { Input } from '@/components/ui/input';
import { createTask } from '../actions/create-task';

type Props = {
  flipId: string;
};

// Inline "add task" row — type a title, press Enter. No dialog. Title-only;
// priority defaults to normal, unassigned, no due date. Use the detailed form
// for the rest.
export function TaskQuickAdd({ flipId }: Props) {
  const t = useTranslations('tasks');
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [isPending, startTransition] = useTransition();

  function submit() {
    const trimmed = title.trim();
    if (trimmed.length === 0 || isPending) {
      return;
    }
    startTransition(async () => {
      const result = await createTask({ flipId, title: trimmed });
      if (result.ok) {
        setTitle('');
        router.refresh();
      }
    });
  }

  return (
    <div className="flex items-center gap-2 border-b border-border-subtle px-3 py-2">
      <Plus size={16} strokeWidth={1.5} className="shrink-0 text-text-muted" />
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            submit();
          }
        }}
        placeholder={t('quickAdd.placeholder')}
        aria-label={t('actions.addTask')}
        className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
        disabled={isPending}
      />
    </div>
  );
}
