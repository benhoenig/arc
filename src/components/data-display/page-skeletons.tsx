import { SkeletonTable } from '@/components/data-display/skeleton-table';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * Route-level loading skeletons. Rendered by `loading.tsx` files, which Next.js
 * shows instantly inside the nearest Suspense boundary while a route segment's
 * server component fetches data. Shapes mirror the real page chrome so the
 * transition doesn't shift layout once content arrives.
 */

/** List / table page: title, optional filter row, table. Most app pages. */
export function ListPageSkeleton({ columns = 5, rows = 8 }: { columns?: number; rows?: number }) {
  return (
    <div className="px-6 py-6">
      <div className="mb-6 flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="mb-4 flex items-center gap-2">
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-8 w-16" />
      </div>
      <SkeletonTable columns={columns} rows={rows} />
    </div>
  );
}

/** A bordered card block standing in for a detail panel. */
function PanelSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-lg border border-border-subtle p-5', className)}>
      <Skeleton className="mb-4 h-5 w-40" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}

/** Detail page: back link, header (title + actions), stacked panels. */
export function DetailPageSkeleton({ panels = 3 }: { panels?: number }) {
  return (
    <div className="px-6 py-6">
      <Skeleton className="mb-4 h-4 w-28" />

      <div className="mb-8 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-14 w-14 rounded-md" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-9 w-20" />
        </div>
      </div>

      <div className="flex flex-col gap-8">
        {Array.from({ length: panels }).map((_, i) => (
          <PanelSkeleton key={`panel-${i.toString()}`} />
        ))}
      </div>
    </div>
  );
}
