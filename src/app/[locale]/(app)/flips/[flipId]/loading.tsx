import { DetailPageSkeleton } from '@/components/data-display/page-skeletons';

// Covers the flip detail page and its sub-routes (budget, team, contractors),
// all of which share the back-link + header + stacked-panels layout.
export default function Loading() {
  return <DetailPageSkeleton panels={4} />;
}
