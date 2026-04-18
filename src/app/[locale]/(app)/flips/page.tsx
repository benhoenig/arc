import { setRequestLocale } from 'next-intl/server';
import { FlipsPageClient } from '@/features/flips/components/flips-page-client';
import { listFlips } from '@/features/flips/queries/list-flips';
import { getActiveOrgId } from '@/server/supabase/auth';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function FlipsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const orgId = await getActiveOrgId();
  const flips = await listFlips(orgId);

  return <FlipsPageClient flips={flips} />;
}
