'use client';

import { Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { updateContact } from '../actions/update-contact';
import { CONTACT_TYPES } from '../validators/sourcing-schemas';

type Contact = {
  id: string;
  name: string;
  contactType: string;
  phone: string | null;
  lineId: string | null;
  email: string | null;
  notes: string | null;
};

type Props = {
  contact: Contact;
};

export function ContactEditForm({ contact }: Props) {
  const t = useTranslations('sourcing.contacts');
  const tCol = useTranslations('sourcing.contacts.columns');
  const tTypes = useTranslations('sourcing.contactTypes');
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(contact.name);
  const [contactType, setContactType] = useState(contact.contactType);
  const [phone, setPhone] = useState(contact.phone ?? '');
  const [lineId, setLineId] = useState(contact.lineId ?? '');
  const [email, setEmail] = useState(contact.email ?? '');

  function handleCancel() {
    setName(contact.name);
    setContactType(contact.contactType);
    setPhone(contact.phone ?? '');
    setLineId(contact.lineId ?? '');
    setEmail(contact.email ?? '');
    setEditing(false);
  }

  function handleSave() {
    startTransition(async () => {
      const result = await updateContact({
        id: contact.id,
        name,
        contactType,
        phone,
        lineId,
        email,
      });
      if (result.ok) {
        setEditing(false);
      }
    });
  }

  if (!editing) {
    return (
      <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
        <Pencil size={14} strokeWidth={1.5} className="mr-1.5" />
        {t('edit')}
      </Button>
    );
  }

  return (
    <div className="rounded-md border border-border p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label>{tCol('name')}</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>{tCol('type')}</Label>
          <Select value={contactType} onValueChange={setContactType}>
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
        <div className="flex flex-col gap-1.5">
          <Label>{tCol('phone')}</Label>
          <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>{tCol('lineId')}</Label>
          <Input value={lineId} onChange={(e) => setLineId(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>{tCol('email')}</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Button size="sm" onClick={handleSave} disabled={isPending}>
          {isPending ? t('saving') : t('save')}
        </Button>
        <Button size="sm" variant="ghost" onClick={handleCancel} disabled={isPending}>
          {t('cancel')}
        </Button>
      </div>
    </div>
  );
}
