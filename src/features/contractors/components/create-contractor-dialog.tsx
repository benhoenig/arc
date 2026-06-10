'use client';

import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
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
import { createContractor } from '../actions/create-contractor';
import {
  CONTRACTOR_TRADES,
  CONTRACTOR_TYPES,
  type ContractorTrade,
  type ContractorType,
} from '../validators/contractor-schemas';

const NO_TRADE = '__none__';

export function CreateContractorDialog() {
  const t = useTranslations('contractors');
  const tCommon = useTranslations('common');
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState('');
  const [contractorType, setContractorType] = useState<ContractorType>('individual');
  const [primaryTrade, setPrimaryTrade] = useState<ContractorTrade | ''>('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [lineId, setLineId] = useState('');
  const [email, setEmail] = useState('');
  const [taxId, setTaxId] = useState('');
  const [defaultDailyRate, setDefaultDailyRate] = useState('');
  const [defaultHourlyRate, setDefaultHourlyRate] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName('');
    setContractorType('individual');
    setPrimaryTrade('');
    setContactPerson('');
    setPhone('');
    setLineId('');
    setEmail('');
    setTaxId('');
    setDefaultDailyRate('');
    setDefaultHourlyRate('');
    setNotes('');
    setError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length === 0) {
      setError('validation');
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await createContractor({
        name: name.trim(),
        contractorType,
        primaryTrade: primaryTrade || undefined,
        additionalTrades: [],
        contactPerson: contactPerson.trim() || undefined,
        phone: phone.trim() || undefined,
        lineId: lineId.trim() || undefined,
        email: email.trim() || undefined,
        taxId: taxId.trim() || undefined,
        defaultDailyRateThb: defaultDailyRate
          ? Number(defaultDailyRate.replace(/,/g, ''))
          : undefined,
        defaultHourlyRateThb: defaultHourlyRate
          ? Number(defaultHourlyRate.replace(/,/g, ''))
          : undefined,
        notes: notes.trim() || undefined,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      reset();
      setOpen(false);
    });
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus size={16} strokeWidth={1.5} className="mr-1.5" />
        {t('add')}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('addTitle')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 flex flex-col gap-1.5">
                <Label>{t('form.name')} *</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('form.namePlaceholder')}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t('form.contractorType')}</Label>
                <Select
                  value={contractorType}
                  onValueChange={(v) => setContractorType(v as ContractorType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTRACTOR_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {t(`types.${type}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t('form.primaryTrade')}</Label>
                <Select
                  value={primaryTrade || NO_TRADE}
                  onValueChange={(v) =>
                    setPrimaryTrade(v === NO_TRADE ? '' : (v as ContractorTrade))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_TRADE}>{t('form.noPrimaryTrade')}</SelectItem>
                    {CONTRACTOR_TRADES.map((trade) => (
                      <SelectItem key={trade} value={trade}>
                        {t(`trades.${trade}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>{t('form.contactPerson')}</Label>
                <Input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t('form.phone')}</Label>
                <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t('form.lineId')}</Label>
                <Input value={lineId} onChange={(e) => setLineId(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t('form.email')}</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="col-span-2 flex flex-col gap-1.5">
                <Label>{t('form.taxId')}</Label>
                <Input value={taxId} onChange={(e) => setTaxId(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>{t('form.defaultDailyRate')}</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={defaultDailyRate}
                  onChange={(e) => setDefaultDailyRate(e.target.value.replace(/[^\d.]/g, ''))}
                  className="tabular text-right"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t('form.defaultHourlyRate')}</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={defaultHourlyRate}
                  onChange={(e) => setDefaultHourlyRate(e.target.value.replace(/[^\d.]/g, ''))}
                  className="tabular text-right"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>{t('form.notes')}</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                {tCommon('cancel')}
              </Button>
              <Button type="submit" disabled={isPending}>
                {tCommon('add')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
