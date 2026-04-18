'use client';

import { Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { PropertyDetail } from '../queries/get-property';
import type { PickerOptions } from '../queries/list-picker-options';
import { PropertyDialog } from './property-dialog';

type Props = {
  property: PropertyDetail;
  pickerOptions: PickerOptions;
};

export function PropertyHeaderActions({ property, pickerOptions }: Props) {
  const t = useTranslations('sourcing.propertyForm');
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Pencil size={14} strokeWidth={1.5} className="mr-1.5" />
        {t('editTitle')}
      </Button>
      <PropertyDialog
        open={open}
        onOpenChange={setOpen}
        pickerOptions={pickerOptions}
        property={property}
      />
    </>
  );
}
