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
import { updateProject } from '../actions/update-project';
import { PROPERTY_TYPES } from '../validators/sourcing-schemas';

type Project = {
  id: string;
  name: string;
  developer: string | null;
  location: string | null;
  propertyType: string | null;
  notes: string | null;
};

type Props = {
  project: Project;
};

export function ProjectEditForm({ project }: Props) {
  const t = useTranslations('sourcing.projects');
  const tCol = useTranslations('sourcing.projects.columns');
  const tTypes = useTranslations('sourcing.propertyTypes');
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(project.name);
  const [developer, setDeveloper] = useState(project.developer ?? '');
  const [location, setLocation] = useState(project.location ?? '');
  const [propertyType, setPropertyType] = useState(project.propertyType ?? '');

  function handleCancel() {
    setName(project.name);
    setDeveloper(project.developer ?? '');
    setLocation(project.location ?? '');
    setPropertyType(project.propertyType ?? '');
    setEditing(false);
  }

  function handleSave() {
    startTransition(async () => {
      const result = await updateProject({
        id: project.id,
        name,
        developer,
        location,
        propertyType: propertyType || undefined,
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
          <Label>{tCol('developer')}</Label>
          <Input value={developer} onChange={(e) => setDeveloper(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>{tCol('location')}</Label>
          <Input value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>{tCol('type')}</Label>
          <Select value={propertyType} onValueChange={setPropertyType}>
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
