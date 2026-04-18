'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTranslations } from 'next-intl';
import { Currency } from '@/components/data-display/currency';
import { Pill } from '@/components/data-display/pill';
import { Link } from '@/i18n/navigation';
import { getThumbnailUrl } from '@/lib/property-thumbnail';
import { cn } from '@/lib/utils';
import type { PropertyListItem } from '../queries/list-properties';

type Props = {
  property: PropertyListItem;
  /** When true, renders as a plain card (used inside DragOverlay) */
  isOverlay?: boolean;
};

function CardContent({ property }: { property: PropertyListItem }) {
  const tTypes = useTranslations('sourcing.propertyTypes');
  const thumbnailUrl = getThumbnailUrl(property.thumbnailPath);

  return (
    <>
      {thumbnailUrl && (
        // biome-ignore lint/performance/noImgElement: user-uploaded dynamic URL
        <img
          src={thumbnailUrl}
          alt=""
          className="mb-2 -mx-1 -mt-1 h-24 w-[calc(100%+0.5rem)] rounded-sm border border-border-subtle object-cover"
        />
      )}
      <div className="mb-2 flex items-start justify-between gap-2">
        <Link
          href={`/sourcing/properties/${property.id}`}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="font-medium text-text-strong hover:underline"
        >
          {property.listingName}
        </Link>
        <Pill>{tTypes(property.propertyType)}</Pill>
      </div>
      {property.project?.name && (
        <p className="mb-1 text-xs text-text-muted">{property.project.name}</p>
      )}
      {property.askingPriceThb != null && (
        <p className="text-sm font-medium">
          <Currency amount={property.askingPriceThb} />
        </p>
      )}
      {property._count.dealAnalyses > 0 && (
        <p className="mt-1 text-xs text-text-muted">{property._count.dealAnalyses} analyses</p>
      )}
    </>
  );
}

export function PipelineCard({ property, isOverlay }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: property.id,
    disabled: isOverlay,
  });

  if (isOverlay) {
    return (
      <div className="cursor-grabbing rounded-md border border-border-strong bg-background p-3 shadow-md">
        <CardContent property={property} />
      </div>
    );
  }

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'cursor-grab rounded-md border border-border bg-background p-3 shadow-sm',
        'hover:border-border-strong active:cursor-grabbing',
        isDragging && 'opacity-40',
      )}
    >
      <CardContent property={property} />
    </div>
  );
}
