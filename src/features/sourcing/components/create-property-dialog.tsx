'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createProperty } from '../actions/create-property';
import { propertySchema } from '../validators/sourcing-schemas';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const PROPERTY_TYPES = [
  'condo',
  'townhouse',
  'detached_house',
  'land',
  'commercial',
  'shophouse',
  'other',
] as const;

export function CreatePropertyDialog({ open, onOpenChange }: Props) {
  const t = useTranslations('sourcing.propertyForm');
  const tTypes = useTranslations('sourcing.propertyTypes');
  const tErr = useTranslations('auth.errors');
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const form = useForm<z.infer<typeof propertySchema>>({
    resolver: zodResolver(propertySchema),
    defaultValues: {
      nickname: '',
      addressLine1: '',
      propertyType: 'townhouse',
    },
  });

  function onSubmit(values: z.infer<typeof propertySchema>) {
    startTransition(async () => {
      const result = await createProperty(values);
      if (!result.ok) {
        form.setError('root', { message: tErr('server') });
        return;
      }
      onOpenChange(false);
      form.reset();
      router.push(`/sourcing/properties/${result.data.propertyId}`);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('createTitle')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {form.formState.errors.root && (
            <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>
          )}

          <div className="flex flex-col gap-1.5">
            <Label>{t('nickname')}</Label>
            <Input placeholder={t('nicknamePlaceholder')} {...form.register('nickname')} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{t('addressLine1')}</Label>
            <Input placeholder={t('addressLine1Placeholder')} {...form.register('addressLine1')} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>{t('subdistrict')}</Label>
              <Input {...form.register('subdistrict')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t('district')}</Label>
              <Input {...form.register('district')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>{t('province')}</Label>
              <Input {...form.register('province')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t('propertyType')}</Label>
              <Select
                value={form.watch('propertyType')}
                onValueChange={(v) =>
                  form.setValue('propertyType', v as z.infer<typeof propertySchema>['propertyType'])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROPERTY_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {tTypes(type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>{t('bedrooms')}</Label>
              <Input type="number" {...form.register('bedrooms')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t('bathrooms')}</Label>
              <Input type="number" step="0.5" {...form.register('bathrooms')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t('floorAreaSqm')}</Label>
              <Input type="number" {...form.register('floorAreaSqm')} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{t('notes')}</Label>
            <textarea
              className="min-h-[80px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              {...form.register('notes')}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t('submit') === 'บันทึก' ? 'ยกเลิก' : 'Cancel'}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? t('submitting') : t('submit')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
