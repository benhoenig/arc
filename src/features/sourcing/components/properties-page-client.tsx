'use client';

import { Kanban, Plus, Table2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { PickerOptions } from '../queries/list-picker-options';
import type { PropertyListItem } from '../queries/list-properties';
import { DealPipelineKanban } from './deal-pipeline-kanban';
import { PropertyDialog } from './property-dialog';
import { PropertyLibraryTable } from './property-library-table';

type Props = {
  properties: PropertyListItem[];
  title: string;
  addLabel: string;
  pickerOptions: PickerOptions;
  orgId: string;
};

type View = 'table' | 'kanban';

export function PropertiesPageClient({ properties, title, addLabel, pickerOptions, orgId }: Props) {
  const t = useTranslations('sourcing.properties');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [view, setView] = useState<View>('table');

  return (
    <div className="px-6 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-text-strong">{title}</h1>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 rounded-md border border-border p-1">
            <button
              type="button"
              onClick={() => setView('table')}
              className={cn(
                'flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-sm transition-colors',
                view === 'table'
                  ? 'bg-fill-selected text-text-strong'
                  : 'text-text-muted hover:text-text-default',
              )}
            >
              <Table2 size={14} strokeWidth={1.5} />
              {t('viewTable')}
            </button>
            <button
              type="button"
              onClick={() => setView('kanban')}
              className={cn(
                'flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-sm transition-colors',
                view === 'kanban'
                  ? 'bg-fill-selected text-text-strong'
                  : 'text-text-muted hover:text-text-default',
              )}
            >
              <Kanban size={14} strokeWidth={1.5} />
              {t('viewKanban')}
            </button>
          </div>
          <Button onClick={() => setDialogOpen(true)} size="sm">
            <Plus size={16} strokeWidth={1.5} className="mr-1.5" />
            {addLabel}
          </Button>
        </div>
      </div>

      {view === 'table' ? (
        <PropertyLibraryTable properties={properties} onAdd={() => setDialogOpen(true)} />
      ) : (
        <DealPipelineKanban properties={properties} />
      )}

      <PropertyDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        pickerOptions={pickerOptions}
        orgId={orgId}
      />
    </div>
  );
}
