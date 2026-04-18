import { ArrowLeft } from 'lucide-react';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Currency } from '@/components/data-display/currency';
import { Pill } from '@/components/data-display/pill';
import { ContactEditForm } from '@/features/sourcing/components/contact-edit-form';
import { getContact } from '@/features/sourcing/queries/get-contact';
import { Link } from '@/i18n/navigation';
import { getActiveOrgId } from '@/server/supabase/auth';

type Props = {
  params: Promise<{ locale: string; contactId: string }>;
};

export default async function ContactDetailPage({ params }: Props) {
  const { locale, contactId } = await params;
  setRequestLocale(locale);

  const orgId = await getActiveOrgId();
  const contact = await getContact(orgId, contactId);

  if (!contact) {
    notFound();
  }

  const t = await getTranslations('sourcing');
  const tTypes = await getTranslations('sourcing.contactTypes');
  const tPropTypes = await getTranslations('sourcing.propertyTypes');

  return (
    <div className="px-6 py-6">
      <Link
        href="/sourcing/contacts"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-default"
      >
        <ArrowLeft size={14} strokeWidth={1.5} />
        {t('contacts.detail.backToList')}
      </Link>

      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-text-strong">{contact.name}</h1>
              <Pill>{tTypes(contact.contactType)}</Pill>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-text-muted">
              {contact.phone && <span>{contact.phone}</span>}
              {contact.lineId && <span>LINE: {contact.lineId}</span>}
              {contact.email && <span>{contact.email}</span>}
            </div>
          </div>
          <ContactEditForm contact={contact} />
        </div>
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold text-text-strong">
          {t('contacts.detail.linkedProperties', { count: contact.properties.length })}
        </h2>

        {contact.properties.length === 0 ? (
          <p className="text-sm text-text-muted">{t('contacts.detail.noProperties')}</p>
        ) : (
          <div className="space-y-2">
            {contact.properties.map((prop) => (
              <Link
                key={prop.id}
                href={`/sourcing/properties/${prop.id}`}
                className="flex items-center justify-between rounded-md border border-border p-3 hover:bg-fill-hover"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-text-strong">{prop.listingName}</span>
                  <Pill>{tPropTypes(prop.propertyType)}</Pill>
                </div>
                {prop.askingPriceThb && (
                  <Currency amount={Number(prop.askingPriceThb)} className="text-sm" />
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
