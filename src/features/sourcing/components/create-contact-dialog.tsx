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
import { createContact } from '../actions/create-contact';
import { CONTACT_TYPES, createContactSchema } from '../validators/sourcing-schemas';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CreateContactDialog({ open, onOpenChange }: Props) {
  const t = useTranslations('sourcing.contacts');
  const tCol = useTranslations('sourcing.contacts.columns');
  const tTypes = useTranslations('sourcing.contactTypes');
  const [isPending, startTransition] = useTransition();

  const form = useForm({
    resolver: zodResolver(createContactSchema),
    defaultValues: {
      name: '',
      contactType: 'agent' as const,
      phone: '',
      lineId: '',
      email: '',
    },
  });

  function onSubmit() {
    form.handleSubmit((values) => {
      startTransition(async () => {
        const result = await createContact(values);
        if (!result.ok) {
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
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>{tCol('name')} *</Label>
              <Input {...form.register('name')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{tCol('type')}</Label>
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
                      {tTypes(type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>{tCol('phone')}</Label>
              <Input type="tel" {...form.register('phone')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{tCol('lineId')}</Label>
              <Input {...form.register('lineId')} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{tCol('email')}</Label>
            <Input type="email" {...form.register('email')} />
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
