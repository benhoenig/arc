'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ComboboxPicker } from '@/components/form/combobox-picker';
import { NumberInput } from '@/components/form/number-input';
import { ThumbnailUpload } from '@/components/form/thumbnail-upload';
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
import { updateProperty } from '../actions/update-property';
import type { PropertyDetail } from '../queries/get-property';
import type { PickerOptions } from '../queries/list-picker-options';
import { propertySchema } from '../validators/sourcing-schemas';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pickerOptions: PickerOptions;
  orgId: string;
  /** If provided, dialog is in edit mode */
  property?: PropertyDetail | null;
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

const CONTACT_TYPES = ['owner', 'agent', 'developer', 'other'] as const;

type FormValues = {
  listingName: string;
  projectName: string;
  listingUrl: string;
  thumbnailPath: string | null;
  propertyType: (typeof PROPERTY_TYPES)[number];
  bedrooms: number;
  bathrooms: number;
  floorAreaSqm: number;
  floors: number;
  floorLevel: number | undefined;
  landAreaSqwa: number | undefined;
  askingPriceThb: number | undefined;
  priceRemark: string;
  contactType: (typeof CONTACT_TYPES)[number];
  contactName: string;
  contactPhone: string;
  contactLineId: string;
  contactEmail: string;
  notes: string;
};

function buildDefaults(property?: PropertyDetail | null): FormValues {
  if (!property) {
    return {
      listingName: '',
      projectName: '',
      listingUrl: '',
      thumbnailPath: null,
      propertyType: 'condo',
      bedrooms: 0,
      bathrooms: 0,
      floorAreaSqm: 0,
      floors: 1,
      floorLevel: undefined,
      landAreaSqwa: undefined,
      askingPriceThb: undefined,
      priceRemark: '',
      contactType: 'agent',
      contactName: '',
      contactPhone: '',
      contactLineId: '',
      contactEmail: '',
      notes: '',
    };
  }

  return {
    listingName: property.listingName,
    projectName: property.project?.name ?? '',
    listingUrl: property.listingUrl ?? '',
    thumbnailPath: property.thumbnailPath ?? null,
    propertyType: property.propertyType as (typeof PROPERTY_TYPES)[number],
    bedrooms: property.bedrooms ?? 0,
    bathrooms: property.bathrooms ?? 0,
    floorAreaSqm: property.floorAreaSqm ?? 0,
    floors: property.floors ?? 1,
    floorLevel: property.floorLevel ?? undefined,
    landAreaSqwa: property.landAreaSqwa ?? undefined,
    askingPriceThb: property.askingPriceThb ?? undefined,
    priceRemark: property.priceRemark ?? '',
    contactType: (property.contact?.contactType as (typeof CONTACT_TYPES)[number]) ?? 'agent',
    contactName: property.contact?.name ?? '',
    contactPhone: property.contact?.phone ?? '',
    contactLineId: property.contact?.lineId ?? '',
    contactEmail: property.contact?.email ?? '',
    notes: property.notes ?? '',
  };
}

export function PropertyDialog({ open, onOpenChange, pickerOptions, orgId, property }: Props) {
  const isEdit = !!property;
  const t = useTranslations('sourcing.propertyForm');
  const tTypes = useTranslations('sourcing.propertyTypes');
  const tContact = useTranslations('sourcing.contactTypes');
  const tErr = useTranslations('auth.errors');
  const [isPending, setIsPending] = useState(false);
  const router = useRouter();

  const form = useForm({
    resolver: zodResolver(propertySchema),
    defaultValues: buildDefaults(property),
  });

  // Re-populate form when property changes (edit mode reopen)
  useEffect(() => {
    if (open) {
      form.reset(buildDefaults(property));
    }
  }, [open, property, form]);

  function onSubmit() {
    form.handleSubmit(async (values) => {
      setIsPending(true);
      try {
        const result = isEdit
          ? await updateProperty({ id: property.id, ...values })
          : await createProperty(values);

        if (!result.ok) {
          if (result.error === 'validation') {
            for (const issue of result.issues) {
              const field = issue.path[0];
              if (field) {
                form.setError(field as never, { message: issue.message });
              }
            }
          } else {
            form.setError('root', { message: tErr('server') });
          }
          return;
        }

        onOpenChange(false);
        if (isEdit) {
          router.refresh();
        } else {
          form.reset();
          if (result.data && 'propertyId' in result.data) {
            router.push(`/sourcing/properties/${result.data.propertyId}`);
          }
        }
      } finally {
        setIsPending(false);
      }
    })();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? t('editTitle') : t('createTitle')}</DialogTitle>
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

          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
            {t('sectionBasic')}
          </p>

          <div className="flex flex-col gap-1.5">
            <Label>{t('listingName')} *</Label>
            <Input placeholder={t('listingNamePlaceholder')} {...form.register('listingName')} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{t('thumbnail')}</Label>
            <ThumbnailUpload
              orgId={orgId}
              value={form.watch('thumbnailPath') ?? null}
              onChange={(path) => form.setValue('thumbnailPath', path)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>{t('projectName')}</Label>
              <ComboboxPicker
                options={pickerOptions.projects}
                value={form.watch('projectName') ?? ''}
                onChange={(v) => form.setValue('projectName', v)}
                placeholder={t('projectName')}
                searchPlaceholder={t('projectNamePlaceholder')}
                createLabel={t('projectCreateNew')}
              />
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

          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
            {t('sectionSpecs')}
          </p>

          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>{t('bedrooms')} *</Label>
              <Controller
                name="bedrooms"
                control={form.control}
                render={({ field }) => (
                  <NumberInput value={field.value} onChange={(v) => field.onChange(v ?? 0)} />
                )}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t('bathrooms')} *</Label>
              <Controller
                name="bathrooms"
                control={form.control}
                render={({ field }) => (
                  <NumberInput
                    value={field.value}
                    onChange={(v) => field.onChange(v ?? 0)}
                    decimal
                  />
                )}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t('floorAreaSqm')} *</Label>
              <Controller
                name="floorAreaSqm"
                control={form.control}
                render={({ field }) => (
                  <NumberInput
                    value={field.value}
                    onChange={(v) => field.onChange(v ?? 0)}
                    decimal
                  />
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>{t('floors')} *</Label>
              <Controller
                name="floors"
                control={form.control}
                render={({ field }) => (
                  <NumberInput value={field.value} onChange={(v) => field.onChange(v ?? 1)} />
                )}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t('floorLevel')}</Label>
              <Controller
                name="floorLevel"
                control={form.control}
                render={({ field }) => (
                  <NumberInput
                    value={field.value as number | undefined}
                    onChange={(v) => field.onChange(v)}
                  />
                )}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t('landAreaSqwa')}</Label>
              <Controller
                name="landAreaSqwa"
                control={form.control}
                render={({ field }) => (
                  <NumberInput
                    value={field.value as number | undefined}
                    onChange={(v) => field.onChange(v)}
                    decimal
                  />
                )}
              />
            </div>
          </div>

          <Separator />

          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
            {t('sectionPricing')}
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>{t('askingPrice')}</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 z-10 -translate-y-1/2 text-sm text-text-muted">
                  ฿
                </span>
                <Controller
                  name="askingPriceThb"
                  control={form.control}
                  render={({ field }) => (
                    <NumberInput
                      value={field.value as number | undefined}
                      onChange={(v) => field.onChange(v)}
                      className="pl-7 text-right"
                    />
                  )}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t('priceRemark')}</Label>
              <Input placeholder={t('priceRemarkPlaceholder')} {...form.register('priceRemark')} />
            </div>
          </div>

          <Separator />

          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
            {t('sectionContact')}
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>{t('contactName')}</Label>
              <ComboboxPicker
                options={pickerOptions.contacts}
                value={form.watch('contactName') ?? ''}
                onChange={(v) => form.setValue('contactName', v)}
                placeholder={t('contactName')}
                searchPlaceholder={t('contactNamePlaceholder')}
                createLabel={t('contactCreateNew')}
              />
            </div>
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
              className="min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
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
