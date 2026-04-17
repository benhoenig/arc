'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { useForm } from 'react-hook-form';
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
import { Separator } from '@/components/ui/separator';
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

const CONTACT_TYPES = ['seller', 'agent', 'owner', 'developer', 'other'] as const;

export function CreatePropertyDialog({ open, onOpenChange }: Props) {
  const t = useTranslations('sourcing.propertyForm');
  const tTypes = useTranslations('sourcing.propertyTypes');
  const tContact = useTranslations('sourcing.contactTypes');
  const tErr = useTranslations('auth.errors');
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const form = useForm({
    resolver: zodResolver(propertySchema),
    defaultValues: {
      listingName: '',
      projectName: '',
      listingUrl: '',
      propertyType: 'condo' as const,
      bedrooms: 0,
      bathrooms: 0,
      floorAreaSqm: 0,
      floors: 1,
      floorLevel: undefined as number | undefined,
      landAreaSqwa: undefined as number | undefined,
      askingPriceThb: undefined as number | undefined,
      priceRemark: '',
      contactType: 'agent' as const,
      contactName: '',
      contactPhone: '',
      contactLineId: '',
      contactEmail: '',
      notes: '',
    },
  });

  function onSubmit() {
    form.handleSubmit((values) => {
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
    })();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('createTitle')}</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
          className="flex flex-col gap-5"
        >
          {form.formState.errors.root && (
            <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>
          )}

          {/* Basic info */}
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
            {t('sectionBasic')}
          </p>

          <div className="flex flex-col gap-1.5">
            <Label>{t('listingName')} *</Label>
            <Input placeholder={t('listingNamePlaceholder')} {...form.register('listingName')} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>{t('projectName')}</Label>
              <Input placeholder={t('projectNamePlaceholder')} {...form.register('projectName')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t('propertyType')} *</Label>
              <Select
                value={form.watch('propertyType')}
                onValueChange={(v) =>
                  form.setValue('propertyType', v as (typeof PROPERTY_TYPES)[number])
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

          <div className="flex flex-col gap-1.5">
            <Label>{t('listingUrl')}</Label>
            <Input placeholder={t('listingUrlPlaceholder')} {...form.register('listingUrl')} />
          </div>

          <Separator />

          {/* Specs */}
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
            {t('sectionSpecs')}
          </p>

          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>{t('bedrooms')} *</Label>
              <Input type="number" {...form.register('bedrooms', { valueAsNumber: true })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t('bathrooms')} *</Label>
              <Input
                type="number"
                step="0.5"
                {...form.register('bathrooms', { valueAsNumber: true })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t('floorAreaSqm')} *</Label>
              <Input type="number" {...form.register('floorAreaSqm', { valueAsNumber: true })} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>{t('floors')} *</Label>
              <Input type="number" {...form.register('floors', { valueAsNumber: true })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t('floorLevel')}</Label>
              <Input type="number" {...form.register('floorLevel', { valueAsNumber: true })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t('landAreaSqwa')}</Label>
              <Input type="number" {...form.register('landAreaSqwa', { valueAsNumber: true })} />
            </div>
          </div>

          <Separator />

          {/* Pricing */}
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
            {t('sectionPricing')}
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>{t('askingPrice')}</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-muted">
                  ฿
                </span>
                <Input
                  type="number"
                  className="pl-7 text-right tabular"
                  {...form.register('askingPriceThb', { valueAsNumber: true })}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t('priceRemark')}</Label>
              <Input placeholder={t('priceRemarkPlaceholder')} {...form.register('priceRemark')} />
            </div>
          </div>

          <Separator />

          {/* Contact */}
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
            {t('sectionContact')}
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>{t('contactType')}</Label>
              <Select
                value={form.watch('contactType')}
                onValueChange={(v) =>
                  form.setValue('contactType', v as (typeof CONTACT_TYPES)[number])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTACT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {tContact(type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t('contactName')}</Label>
              <Input {...form.register('contactName')} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>{t('contactPhone')}</Label>
              <Input type="tel" {...form.register('contactPhone')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t('contactLineId')}</Label>
              <Input {...form.register('contactLineId')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t('contactEmail')}</Label>
              <Input type="email" {...form.register('contactEmail')} />
            </div>
          </div>

          <Separator />

          <div className="flex flex-col gap-1.5">
            <Label>{t('notes')}</Label>
            <textarea
              className="min-h-[60px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              {...form.register('notes')}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              ยกเลิก
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
