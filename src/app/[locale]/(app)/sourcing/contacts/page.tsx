import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ContactsPageClient } from '@/features/sourcing/components/contacts-page-client';
import { listContacts } from '@/features/sourcing/queries/list-contacts';
import { getActiveOrgId } from '@/server/supabase/auth';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function ContactsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const orgId = await getActiveOrgId();
  const contacts = await listContacts(orgId);
  const t = await getTranslations('sourcing.contacts');

  return <ContactsPageClient contacts={contacts} title={t('title')} addLabel={t('add')} />;
}
