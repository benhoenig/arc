'use client';

import { useTranslations } from 'next-intl';
import { EmptyState } from '@/components/data-display/empty-state';
import { Pill } from '@/components/data-display/pill';
import { Link } from '@/i18n/navigation';
import type { ContactListItem } from '../queries/list-contacts';

type Props = {
  contacts: ContactListItem[];
};

export function ContactTable({ contacts }: Props) {
  const t = useTranslations('sourcing.contacts');
  const tTypes = useTranslations('sourcing.contactTypes');

  if (contacts.length === 0) {
    return <EmptyState title={t('empty')} description={t('emptyDescription')} />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-subtle text-left text-text-muted">
            <th className="pb-2 pr-4 font-medium">{t('columns.name')}</th>
            <th className="pb-2 pr-4 font-medium">{t('columns.type')}</th>
            <th className="pb-2 pr-4 font-medium">{t('columns.phone')}</th>
            <th className="pb-2 pr-4 font-medium">{t('columns.lineId')}</th>
            <th className="pb-2 pr-4 font-medium">{t('columns.email')}</th>
            <th className="pb-2 font-medium text-right">{t('columns.properties')}</th>
          </tr>
        </thead>
        <tbody>
          {contacts.map((contact) => (
            <tr key={contact.id} className="border-b border-border-subtle last:border-0">
              <td className="py-3 pr-4">
                <Link
                  href={`/sourcing/contacts/${contact.id}`}
                  className="font-medium text-text-strong hover:underline"
                >
                  {contact.name}
                </Link>
              </td>
              <td className="py-3 pr-4">
                <Pill>{tTypes(contact.contactType)}</Pill>
              </td>
              <td className="py-3 pr-4 text-text-muted">{contact.phone ?? '—'}</td>
              <td className="py-3 pr-4 text-text-muted">{contact.lineId ?? '—'}</td>
              <td className="py-3 pr-4 text-text-muted">{contact.email ?? '—'}</td>
              <td className="py-3 text-right tabular">{contact._count.properties}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
