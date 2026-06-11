import { ListPageSkeleton } from '@/components/data-display/page-skeletons';

// Generic fallback shown on navigation to any app route without a closer
// loading.tsx. Most app pages are list/table views, so a list skeleton is the
// sensible default; detail routes override this with their own loading.tsx.
export default function Loading() {
  return <ListPageSkeleton />;
}
