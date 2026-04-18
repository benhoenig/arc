'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import type { PropertyListItem } from '../queries/list-properties';
import { PipelineCard } from './pipeline-card';

type Props = {
  status: string;
  properties: PropertyListItem[];
};

export function PipelineColumn({ status, properties }: Props) {
  const t = useTranslations('sourcing.sourcingStatus');
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const ids = properties.map((p) => p.id);

  return (
    <div className="flex w-72 shrink-0 flex-col rounded-md bg-surface">
      <div className="flex items-center justify-between border-b border-border-subtle px-3 py-2">
        <h3 className="text-sm font-medium text-text-strong">{t(status)}</h3>
        <span className="tabular text-xs text-text-muted">{properties.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          'flex min-h-[120px] flex-col gap-2 p-2 transition-colors',
          isOver && 'bg-fill-hover',
        )}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {properties.map((property) => (
            <PipelineCard key={property.id} property={property} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}
