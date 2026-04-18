'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Currency } from '@/components/data-display/currency';
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
import { getThumbnailUrl } from '@/lib/property-thumbnail';
import type { FlipListItem } from '../queries/list-flips';

type Props = {
  flips: FlipListItem[];
};

export function FlipListTable({ flips }: Props) {
  const t = useTranslations('flips');
  const locale = useLocale();

  if (flips.length === 0) {
    return <EmptyState title={t('empty.title')} description={t('empty.description')} />;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('list.code')}</TableHead>
          <TableHead>{t('list.name')}</TableHead>
          <TableHead>{t('list.property')}</TableHead>
          <TableHead>{t('list.stage')}</TableHead>
          <TableHead className="text-right">{t('list.baselineArv')}</TableHead>
          <TableHead className="text-right">{t('list.baselineMargin')}</TableHead>
          <TableHead>{t('list.team')}</TableHead>
          <TableHead>{t('list.acquiredAt')}</TableHead>
          <TableHead>{t('list.soldAt')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {flips.map((f) => {
          const isTerminal =
            f.stage.stageType === 'terminal' || f.killedAt !== null || f.soldAt !== null;
          const stageLabel = locale === 'en' && f.stage.nameEn ? f.stage.nameEn : f.stage.nameTh;
          return (
            <TableRow key={f.id} className="cursor-pointer hover:bg-fill-hover">
              <TableCell className="font-mono text-xs text-text-muted">
                <Link href={`/flips/${f.id}`} className="hover:underline">
                  {f.code}
                </Link>
              </TableCell>
              <TableCell>
                <Link
                  href={`/flips/${f.id}`}
                  className="flex items-center gap-3 font-medium text-text-strong hover:underline"
                >
                  {f.property.thumbnailPath ? (
                    // biome-ignore lint/performance/noImgElement: user-uploaded dynamic URL
                    <img
                      src={getThumbnailUrl(f.property.thumbnailPath) ?? ''}
                      alt=""
                      className="size-10 shrink-0 rounded border border-border-subtle object-cover"
                    />
                  ) : (
                    <div className="size-10 shrink-0 rounded border border-border-subtle bg-surface" />
                  )}
                  <span className={isTerminal ? 'text-text-muted' : undefined}>{f.name}</span>
                </Link>
              </TableCell>
              <TableCell className="text-text-muted">{f.property.listingName}</TableCell>
              <TableCell>
                <Pill variant={isTerminal ? 'muted' : 'neutral'}>{stageLabel}</Pill>
              </TableCell>
              <TableCell className="tabular text-right">
                {f.baselineTargetArvThb != null ? (
                  <Currency amount={f.baselineTargetArvThb} />
                ) : (
                  <span className="text-text-muted">—</span>
                )}
              </TableCell>
              <TableCell className="tabular text-right">
                {f.baselineTargetMarginPct != null
                  ? `${f.baselineTargetMarginPct.toFixed(1)}%`
                  : '—'}
              </TableCell>
              <TableCell className="tabular text-text-muted">{f._count.teamMembers}</TableCell>
              <TableCell className="text-text-muted">
                {f.acquiredAt ? <DateDisplay date={f.acquiredAt} format="short" /> : '—'}
              </TableCell>
              <TableCell className="text-text-muted">
                {f.soldAt ? <DateDisplay date={f.soldAt} format="short" /> : '—'}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
