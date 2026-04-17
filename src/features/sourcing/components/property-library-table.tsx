'use client';

import { useTranslations } from 'next-intl';
import { Currency } from '@/components/data-display/currency';
import { EmptyState } from '@/components/data-display/empty-state';
import { Pill } from '@/components/data-display/pill';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Link } from '@/i18n/navigation';
import type { PropertyListItem } from '../queries/list-properties';

type Props = {
  properties: PropertyListItem[];
  onAdd: () => void;
};

export function PropertyLibraryTable({ properties, onAdd }: Props) {
  const t = useTranslations('sourcing.properties');
  const tTypes = useTranslations('sourcing.propertyTypes');
  const tStatus = useTranslations('sourcing.sourcingStatus');

  if (properties.length === 0) {
    return (
      <EmptyState
        title={t('empty')}
        description={t('emptyDescription')}
        actionLabel={t('addProperty')}
        onAction={onAdd}
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('columns.name')}</TableHead>
          <TableHead>{t('columns.project')}</TableHead>
          <TableHead>{t('columns.type')}</TableHead>
          <TableHead>{t('columns.specs')}</TableHead>
          <TableHead className="text-right">{t('columns.askingPrice')}</TableHead>
          <TableHead>{t('columns.status')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {properties.map((p) => (
          <TableRow key={p.id} className="cursor-pointer hover:bg-fill-hover">
            <TableCell>
              <Link
                href={`/sourcing/properties/${p.id}`}
                className="font-medium text-text-strong hover:underline"
              >
                {p.listingName}
              </Link>
            </TableCell>
            <TableCell className="text-text-muted">{p.project?.name ?? '—'}</TableCell>
            <TableCell>
              <Pill>{tTypes(p.propertyType)}</Pill>
            </TableCell>
            <TableCell className="tabular text-text-muted">
              {[
                `${p.bedrooms} bed`,
                `${Number(p.bathrooms)} bath`,
                `${Number(p.floorAreaSqm)} sqm`,
              ].join(' · ')}
            </TableCell>
            <TableCell className="tabular text-right">
              {p.askingPriceThb ? (
                <Currency amount={Number(p.askingPriceThb)} />
              ) : (
                <span className="text-text-muted">—</span>
              )}
            </TableCell>
            <TableCell>
              <Pill variant={p.sourcingStatus === 'dropped' ? 'muted' : 'neutral'}>
                {tStatus(p.sourcingStatus)}
              </Pill>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
