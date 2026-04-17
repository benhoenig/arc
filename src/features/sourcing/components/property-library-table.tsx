'use client';

import { useTranslations } from 'next-intl';
import { DateDisplay } from '@/components/data-display/date-display';
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
          <TableHead>{t('columns.nickname')}</TableHead>
          <TableHead>{t('columns.location')}</TableHead>
          <TableHead>{t('columns.type')}</TableHead>
          <TableHead className="text-right">{t('columns.specs')}</TableHead>
          <TableHead className="text-right">{t('columns.analyses')}</TableHead>
          <TableHead>{t('columns.added')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {properties.map((property) => (
          <TableRow key={property.id} className="cursor-pointer hover:bg-fill-hover">
            <TableCell>
              <Link
                href={`/sourcing/properties/${property.id}`}
                className="font-medium text-text-strong hover:underline"
              >
                {property.nickname}
              </Link>
            </TableCell>
            <TableCell className="text-text-muted">
              {[property.district, property.province].filter(Boolean).join(', ') || '—'}
            </TableCell>
            <TableCell>
              <Pill>{tTypes(property.propertyType)}</Pill>
            </TableCell>
            <TableCell className="tabular text-right text-text-muted">
              {[
                property.bedrooms != null ? `${property.bedrooms} bed` : null,
                property.bathrooms != null ? `${Number(property.bathrooms)} bath` : null,
                property.floorAreaSqm != null ? `${Number(property.floorAreaSqm)} sqm` : null,
              ]
                .filter(Boolean)
                .join(' · ') || '—'}
            </TableCell>
            <TableCell className="tabular text-right">{property._count.dealAnalyses}</TableCell>
            <TableCell className="text-text-muted">
              <DateDisplay date={property.createdAt} format="short" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
