'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { FlipListItem } from '../queries/list-flips';
import { FlipListTable } from './flip-list-table';

type Filter = 'all' | 'active' | 'closed';

type Props = {
  flips: FlipListItem[];
};

export function FlipsPageClient({ flips }: Props) {
  const t = useTranslations('flips');
  const [filter, setFilter] = useState<Filter>('all');

  const filtered = flips.filter((f) => {
    if (filter === 'active') {
      return !f.soldAt && !f.killedAt;
    }
    if (filter === 'closed') {
      return f.soldAt || f.killedAt;
    }
    return true;
  });

  return (
    <div className="px-6 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-text-strong">{t('title')}</h1>
      </div>

      <div className="mb-4 flex items-center gap-1">
        {(['all', 'active', 'closed'] as const).map((key) => (
          <Button
            key={key}
            variant={filter === key ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setFilter(key)}
            className={cn(filter === key && 'font-medium')}
          >
            {t(
              key === 'all'
                ? 'list.filterAll'
                : key === 'active'
                  ? 'list.filterActive'
                  : 'list.filterClosed',
            )}
          </Button>
        ))}
      </div>

      <FlipListTable flips={filtered} />
    </div>
  );
}
