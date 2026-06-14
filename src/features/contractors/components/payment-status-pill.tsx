import { Pill } from '@/components/data-display/pill';

type PillVariant = 'neutral' | 'active' | 'muted' | 'positive' | 'warning' | 'destructive';

// Directionality test (DESIGN_SYSTEM §2.2): `paid` is an outcome → positive;
// `rejected`/`disputed` are bad outcomes → destructive; `canceled` is inert →
// muted. Everything mid-workflow (requested/approved/completed/pending) stays
// neutral or merely active — no good/bad direction.
const VARIANT: Record<string, PillVariant> = {
  // payment
  requested: 'neutral',
  approved: 'active',
  paid: 'positive',
  rejected: 'destructive',
  canceled: 'muted',
  // milestone / tm extras
  pending: 'neutral',
  in_progress: 'neutral',
  completed: 'active',
  disputed: 'destructive',
};

export function PaymentStatusPill({ status, label }: { status: string; label: string }) {
  return <Pill variant={VARIANT[status] ?? 'neutral'}>{label}</Pill>;
}
