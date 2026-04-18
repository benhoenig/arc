'use client';

import { zodResolver } from '@hookform/resolvers/zod';
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
import { createProject } from '../actions/create-project';
import { createProjectSchema, PROPERTY_TYPES } from '../validators/sourcing-schemas';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CreateProjectDialog({ open, onOpenChange }: Props) {
  const t = useTranslations('sourcing.projects');
  const tCol = useTranslations('sourcing.projects.columns');
  const tTypes = useTranslations('sourcing.propertyTypes');
  const [isPending, startTransition] = useTransition();

  const form = useForm({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {
      name: '',
      developer: '',
      location: '',
      propertyType: undefined as (typeof PROPERTY_TYPES)[number] | undefined,
    },
  });

  function onSubmit() {
    form.handleSubmit((values) => {
      startTransition(async () => {
        const result = await createProject(values);
        if (!result.ok) {
          if (result.error === 'conflict') {
            form.setError('name', { message: 'ชื่อโครงการนี้มีอยู่แล้ว' });
          }
          return;
        }
        onOpenChange(false);
        form.reset();
      });
    })();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('createTitle')}</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <Label>{tCol('name')} *</Label>
            <Input {...form.register('name')} />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>{tCol('developer')}</Label>
              <Input {...form.register('developer')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{tCol('location')}</Label>
              <Input {...form.register('location')} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{tCol('type')}</Label>
            <Select
              value={form.watch('propertyType') ?? ''}
              onValueChange={(v) =>
                form.setValue(
                  'propertyType',
                  (v || undefined) as (typeof PROPERTY_TYPES)[number] | undefined,
                )
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

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? t('saving') : t('save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
