'use client';

import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { EmptyState } from '@/components/data-display/empty-state';
import { Pill } from '@/components/data-display/pill';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Locale } from '@/lib/i18n';
import { createBudgetCategory } from '../actions/create-budget-category';
import { deleteBudgetCategory } from '../actions/delete-budget-category';
import { updateBudgetCategory } from '../actions/update-budget-category';
import type { BudgetCategoryItem } from '../queries/list-budget-categories';

type Props = {
  isAdmin: boolean;
  categories: BudgetCategoryItem[];
};

type EditState = {
  id?: string;
  slug: string;
  nameTh: string;
  nameEn: string;
  sortOrder: string;
  isSystem: boolean;
};

const emptyEdit: EditState = {
  slug: '',
  nameTh: '',
  nameEn: '',
  sortOrder: '0',
  isSystem: false,
};

export function BudgetCategoriesPageClient({ isAdmin, categories }: Props) {
  const t = useTranslations('budget');
  const tCommon = useTranslations('common');
  const locale = useLocale() as Locale;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [edit, setEdit] = useState<EditState>(emptyEdit);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function openCreate() {
    setEdit(emptyEdit);
    setError(null);
    setDialogOpen(true);
  }

  function openEdit(cat: BudgetCategoryItem) {
    setEdit({
      id: cat.id,
      slug: cat.slug,
      nameTh: cat.nameTh,
      nameEn: cat.nameEn ?? '',
      sortOrder: String(cat.sortOrder),
      isSystem: cat.isSystem,
    });
    setError(null);
    setDialogOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const sortOrder = Number(edit.sortOrder);
    if (Number.isNaN(sortOrder) || sortOrder < 0) {
      setError(t('categories.invalidSortOrder'));
      return;
    }
    startTransition(async () => {
      const result = edit.id
        ? await updateBudgetCategory({
            id: edit.id,
            slug: edit.isSystem ? undefined : edit.slug,
            nameTh: edit.nameTh,
            nameEn: edit.nameEn.trim() === '' ? null : edit.nameEn,
            sortOrder,
          })
        : await createBudgetCategory({
            slug: edit.slug,
            nameTh: edit.nameTh,
            nameEn: edit.nameEn.trim() === '' ? undefined : edit.nameEn,
            sortOrder,
          });
      if (!result.ok) {
        setError(
          result.error === 'conflict'
            ? (result.message ?? 'conflict')
            : result.error === 'forbidden'
              ? t('categories.forbidden')
              : result.error,
        );
        return;
      }
      setDialogOpen(false);
    });
  }

  function handleDelete(cat: BudgetCategoryItem) {
    if (cat.isSystem) {
      return;
    }
    if (!confirm(t('categories.confirmDelete', { name: cat.nameTh }))) {
      return;
    }
    startTransition(async () => {
      const result = await deleteBudgetCategory({ id: cat.id });
      if (!result.ok) {
        alert(result.error === 'conflict' ? (result.message ?? 'conflict') : result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-strong">{t('categories.title')}</h1>
          <p className="text-sm text-text-muted">{t('categories.description')}</p>
        </div>
        {isAdmin ? (
          <Button size="sm" variant="outline" onClick={openCreate}>
            <Plus size={14} strokeWidth={1.5} className="mr-1" />
            {t('categories.add')}
          </Button>
        ) : null}
      </div>

      {categories.length === 0 ? (
        <EmptyState title={t('categories.empty')} className="py-10" />
      ) : (
        <div className="rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-text-muted">
              <tr className="border-b border-border-subtle">
                <th className="px-4 py-2 text-left font-medium">{t('categories.slug')}</th>
                <th className="px-4 py-2 text-left font-medium">{t('categories.nameTh')}</th>
                <th className="px-4 py-2 text-left font-medium">{t('categories.nameEn')}</th>
                <th className="px-4 py-2 text-right font-medium">{t('categories.sortOrder')}</th>
                <th className="w-32" />
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => {
                const display = locale === 'en' && cat.nameEn ? cat.nameEn : cat.nameTh;
                return (
                  <tr key={cat.id} className="border-t border-border-subtle">
                    <td className="px-4 py-2 text-text-muted">
                      <code className="text-xs">{cat.slug}</code>
                      {cat.isSystem ? (
                        <Pill className="ml-2" variant="muted">
                          {t('categories.system')}
                        </Pill>
                      ) : null}
                    </td>
                    <td className="px-4 py-2 text-text-default">{cat.nameTh}</td>
                    <td className="px-4 py-2 text-text-muted">{cat.nameEn ?? '—'}</td>
                    <td className="px-4 py-2 text-right tabular text-text-muted">
                      {cat.sortOrder}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {isAdmin ? (
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(cat)}
                            className="rounded p-1 text-text-muted hover:bg-fill-hover hover:text-text-default"
                            aria-label={t('categories.edit', { name: display })}
                          >
                            <Pencil size={14} strokeWidth={1.5} />
                          </button>
                          {cat.isSystem ? null : (
                            <button
                              type="button"
                              onClick={() => handleDelete(cat)}
                              disabled={isPending}
                              className="rounded p-1 text-text-muted hover:bg-fill-hover hover:text-destructive disabled:opacity-50"
                              aria-label={t('categories.delete', { name: display })}
                            >
                              <Trash2 size={14} strokeWidth={1.5} />
                            </button>
                          )}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {edit.id ? t('categories.editTitle') : t('categories.addTitle')}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>{t('categories.slug')} *</Label>
              <Input
                value={edit.slug}
                onChange={(e) => setEdit({ ...edit, slug: e.target.value })}
                disabled={edit.isSystem}
                placeholder="custom_category"
              />
              {edit.isSystem ? (
                <p className="text-xs text-text-muted">{t('categories.systemSlugLocked')}</p>
              ) : null}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t('categories.nameTh')} *</Label>
              <Input
                value={edit.nameTh}
                onChange={(e) => setEdit({ ...edit, nameTh: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t('categories.nameEn')}</Label>
              <Input
                value={edit.nameEn}
                onChange={(e) => setEdit({ ...edit, nameEn: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t('categories.sortOrder')}</Label>
              <Input
                type="number"
                min={0}
                step="1"
                value={edit.sortOrder}
                onChange={(e) => setEdit({ ...edit, sortOrder: e.target.value })}
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>
                {tCommon('cancel')}
              </Button>
              <Button
                type="submit"
                disabled={isPending || !edit.nameTh.trim() || (!edit.isSystem && !edit.slug.trim())}
              >
                {edit.id ? tCommon('save') : tCommon('add')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
