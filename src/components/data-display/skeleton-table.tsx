import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type Props = {
  rows?: number;
  columns?: number;
  className?: string;
};

export function SkeletonTable({ rows = 8, columns = 5, className }: Props) {
  return (
    <div className={cn('w-full', className)}>
      {/* Header */}
      <div className="flex gap-4 border-b border-border-subtle px-3 py-2.5">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={`h-${i.toString()}`} className="h-3 flex-1" />
        ))}
      </div>

      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div
          key={`r-${rowIdx.toString()}`}
          className="flex gap-4 border-b border-border-subtle px-3 py-3"
        >
          {Array.from({ length: columns }).map((_, colIdx) => (
            <Skeleton
              key={`c-${rowIdx.toString()}-${colIdx.toString()}`}
              className={cn('h-4 flex-1', colIdx === 0 && 'max-w-[120px]')}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
