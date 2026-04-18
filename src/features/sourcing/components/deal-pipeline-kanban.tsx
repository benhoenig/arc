'use client';

import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { updateSourcingStatus } from '../actions/update-sourcing-status';
import type { PropertyListItem } from '../queries/list-properties';
import { PipelineCard } from './pipeline-card';
import { PipelineColumn } from './pipeline-column';

const STATUSES = [
  'new',
  'evaluating',
  'site_visit',
  'negotiating',
  'under_contract',
  'signed',
  'converted',
  'dropped',
] as const;

type SourcingStatus = (typeof STATUSES)[number];

type Props = {
  properties: PropertyListItem[];
};

export function DealPipelineKanban({ properties: initialProperties }: Props) {
  const router = useRouter();
  const [properties, setProperties] = useState(initialProperties);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setProperties(initialProperties);
  }, [initialProperties]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const grouped = useMemo(() => {
    const map = new Map<string, PropertyListItem[]>();
    for (const status of STATUSES) {
      map.set(status, []);
    }
    for (const property of properties) {
      const bucket = map.get(property.sourcingStatus) ?? map.get('new');
      bucket?.push(property);
    }
    return map;
  }, [properties]);

  const activeProperty = activeId ? properties.find((p) => p.id === activeId) : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) {
      return;
    }

    const propertyId = String(active.id);
    const activePropertyForDrag = properties.find((p) => p.id === propertyId);
    if (!activePropertyForDrag) {
      return;
    }

    const overId = String(over.id);
    const targetStatus: SourcingStatus = STATUSES.includes(overId as SourcingStatus)
      ? (overId as SourcingStatus)
      : (properties.find((p) => p.id === overId)?.sourcingStatus as SourcingStatus);

    if (!targetStatus || activePropertyForDrag.sourcingStatus === targetStatus) {
      return;
    }

    setProperties((prev) =>
      prev.map((p) => (p.id === propertyId ? { ...p, sourcingStatus: targetStatus } : p)),
    );

    startTransition(async () => {
      const result = await updateSourcingStatus({
        propertyId,
        sourcingStatus: targetStatus,
      });
      if (!result.ok) {
        setProperties(initialProperties);
      }
      router.refresh();
    });
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {STATUSES.map((status) => (
          <PipelineColumn key={status} status={status} properties={grouped.get(status) ?? []} />
        ))}
      </div>
      <DragOverlay>
        {activeProperty ? <PipelineCard property={activeProperty} isOverlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}
