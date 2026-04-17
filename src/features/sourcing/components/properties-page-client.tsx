'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { PropertyListItem } from '../queries/list-properties';
import { CreatePropertyDialog } from './create-property-dialog';
import { PropertyLibraryTable } from './property-library-table';

type Props = {
  properties: PropertyListItem[];
  title: string;
  addLabel: string;
};

export function PropertiesPageClient({ properties, title, addLabel }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="px-6 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-text-strong">{title}</h1>
        <Button onClick={() => setDialogOpen(true)} size="sm">
          <Plus size={16} strokeWidth={1.5} className="mr-1.5" />
          {addLabel}
        </Button>
      </div>

      <PropertyLibraryTable properties={properties} onAdd={() => setDialogOpen(true)} />

      <CreatePropertyDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
