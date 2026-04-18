'use client';

import { Trash2, UserPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { DateDisplay } from '@/components/data-display/date-display';
import { EmptyState } from '@/components/data-display/empty-state';
import { Pill } from '@/components/data-display/pill';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { assignTeamMember } from '../actions/assign-team-member';
import { removeTeamMember } from '../actions/remove-team-member';
import type { OrgUserOption } from '../queries/list-org-users';
import { FLIP_TEAM_ROLES, type FlipTeamRole } from '../validators/flip-schemas';

type Member = {
  id: string;
  roleInFlip: string;
  assignedAt: Date;
  user: {
    id: string;
    fullName: string | null;
    displayName: string | null;
    email: string;
  };
};

type Props = {
  flipId: string;
  members: Member[];
  candidates: OrgUserOption[];
  readOnly: boolean;
};

export function FlipTeamPanel({ flipId, members, candidates, readOnly }: Props) {
  const t = useTranslations('flips');
  const tCommon = useTranslations('common');
  const [assignOpen, setAssignOpen] = useState(false);
  const [userId, setUserId] = useState<string>(candidates[0]?.id ?? '');
  const [role, setRole] = useState<FlipTeamRole>('contributor');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAssign() {
    if (!userId) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await assignTeamMember({ flipId, userId, roleInFlip: role });
      if (!result.ok) {
        setError(result.error === 'conflict' ? (result.message ?? 'conflict') : result.error);
        return;
      }
      setAssignOpen(false);
    });
  }

  function handleRemove(memberId: string) {
    startTransition(async () => {
      await removeTeamMember({ flipId, memberId });
    });
  }

  function renderName(u: Member['user']): string {
    return u.displayName ?? u.fullName ?? u.email;
  }

  return (
    <div className="rounded-md border border-border p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text-strong">{t('team.title')}</h2>
        {!readOnly ? (
          <Button size="sm" variant="outline" onClick={() => setAssignOpen(true)}>
            <UserPlus size={14} strokeWidth={1.5} className="mr-1" />
            {t('actions.assignTeamMember')}
          </Button>
        ) : null}
      </div>

      {members.length === 0 ? (
        <EmptyState title={t('team.empty')} className="py-8" />
      ) : (
        <ul className="divide-y divide-border-subtle">
          {members.map((m) => (
            <li key={m.id} className="flex items-center justify-between py-2.5">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-text-strong">{renderName(m.user)}</span>
                <Pill>{t(`team.roles.${m.roleInFlip}` as never)}</Pill>
                <span className="text-xs text-text-muted">
                  <DateDisplay date={m.assignedAt} format="short" />
                </span>
              </div>
              {!readOnly ? (
                <button
                  type="button"
                  onClick={() => handleRemove(m.id)}
                  className="rounded p-1 text-text-muted hover:bg-fill-hover hover:text-destructive"
                  disabled={isPending}
                  aria-label={t('actions.removeTeamMember')}
                >
                  <Trash2 size={14} strokeWidth={1.5} />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('actions.assignTeamMember')}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAssign();
            }}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-1.5">
              <Label>{t('team.user')} *</Label>
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {candidates.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.displayName ?? u.fullName ?? u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t('team.role')} *</Label>
              <Select value={role} onValueChange={(v) => setRole(v as FlipTeamRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FLIP_TEAM_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {t(`team.roles.${r}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setAssignOpen(false)}>
                {tCommon('cancel')}
              </Button>
              <Button type="submit" disabled={isPending || !userId}>
                {tCommon('add')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
