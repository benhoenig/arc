'use client';

import { Trash2, UserPlus } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { DateDisplay } from '@/components/data-display/date-display';
import { EmptyState } from '@/components/data-display/empty-state';
import { Pill } from '@/components/data-display/pill';
import { ConfirmDeleteDialog } from '@/components/form/confirm-delete-dialog';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { removeMember } from '../actions/remove-member';
import { revokeInvitation } from '../actions/revoke-invitation';
import type { InvitationListItem } from '../queries/list-invitations';
import type { MemberListItem } from '../queries/list-members';
import { INVITABLE_ROLE_SLUGS, type InvitableRoleSlug } from '../validators/invitation-schemas';
import { InviteMemberDialog } from './invite-member-dialog';

type Tab = 'members' | 'invitations';

type Props = {
  currentUserId: string;
  isAdmin: boolean;
  members: MemberListItem[];
  invitations: InvitationListItem[];
  roles: { slug: string; nameTh: string; nameEn: string | null }[];
};

export function MembersPageClient({ currentUserId, isAdmin, members, invitations, roles }: Props) {
  const t = useTranslations('members');
  const locale = useLocale();
  const [tab, setTab] = useState<Tab>('members');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<MemberListItem | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const roleLabels: Record<InvitableRoleSlug, string> = Object.fromEntries(
    INVITABLE_ROLE_SLUGS.map((slug) => {
      const role = roles.find((r) => r.slug === slug);
      const label = role ? (locale === 'en' && role.nameEn ? role.nameEn : role.nameTh) : slug;
      return [slug, label];
    }),
  ) as Record<InvitableRoleSlug, string>;

  function renderRole(role: { slug: string; nameTh: string; nameEn: string | null }): string {
    if (locale === 'en' && role.nameEn) {
      return role.nameEn;
    }
    return role.nameTh;
  }

  function renderUserName(u: MemberListItem['user']): string {
    return u.displayName ?? u.fullName ?? u.email;
  }

  function handleRevoke(id: string) {
    setRevokingId(id);
    startTransition(async () => {
      await revokeInvitation({ id });
      setRevokingId(null);
    });
  }

  function handleConfirmRemove() {
    if (!removeTarget) {
      return;
    }
    setRemoveError(null);
    startTransition(async () => {
      const result = await removeMember({ userRoleId: removeTarget.id });
      if (!result.ok) {
        if (result.error === 'conflict') {
          const code = result.message ?? '';
          if (code === 'cannot_remove_self') {
            setRemoveError(t('members.errors.cannotRemoveSelf'));
            return;
          }
          if (code === 'last_admin') {
            setRemoveError(t('members.errors.lastAdmin'));
            return;
          }
        }
        if (result.error === 'forbidden') {
          setRemoveError(t('members.errors.forbidden'));
          return;
        }
        setRemoveError(t('members.errors.server'));
        return;
      }
      setRemoveTarget(null);
    });
  }

  return (
    <div className="px-6 py-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-text-strong">{t('title')}</h1>
          <p className="mt-1 text-sm text-text-muted">{t('subtitle')}</p>
        </div>
        {isAdmin ? (
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlus size={14} strokeWidth={1.5} className="mr-1" />
            {t('invite.button')}
          </Button>
        ) : null}
      </div>

      <div className="mb-4 flex items-center gap-1 border-b border-border-subtle">
        {(['members', 'invitations'] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm transition-colors',
              tab === key
                ? 'border-border-strong font-medium text-text-strong'
                : 'border-transparent text-text-muted hover:text-text-default',
            )}
          >
            {t(`tabs.${key}`, {
              count: key === 'members' ? members.length : invitations.length,
            })}
          </button>
        ))}
      </div>

      {tab === 'members' ? (
        members.length === 0 ? (
          <EmptyState title={t('members.empty')} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('members.columns.name')}</TableHead>
                <TableHead>{t('members.columns.email')}</TableHead>
                <TableHead>{t('members.columns.role')}</TableHead>
                <TableHead>{t('members.columns.joined')}</TableHead>
                {isAdmin ? <TableHead className="w-0" /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => {
                const isSelf = m.user.id === currentUserId;
                return (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium text-text-strong">
                      {renderUserName(m.user)}
                      {isSelf ? (
                        <span className="ml-2 text-xs text-text-muted">{t('members.you')}</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-text-muted">{m.user.email}</TableCell>
                    <TableCell>
                      <Pill>{renderRole(m.role)}</Pill>
                    </TableCell>
                    <TableCell className="text-text-muted">
                      <DateDisplay date={m.joinedAt} format="short" />
                    </TableCell>
                    {isAdmin ? (
                      <TableCell>
                        {!isSelf ? (
                          <button
                            type="button"
                            onClick={() => {
                              setRemoveError(null);
                              setRemoveTarget(m);
                            }}
                            className="rounded p-1 text-text-muted hover:bg-fill-hover hover:text-destructive"
                            aria-label={t('members.remove')}
                          >
                            <Trash2 size={14} strokeWidth={1.5} />
                          </button>
                        ) : null}
                      </TableCell>
                    ) : null}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )
      ) : invitations.length === 0 ? (
        <EmptyState title={t('invitations.empty')} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('invitations.columns.email')}</TableHead>
              <TableHead>{t('invitations.columns.role')}</TableHead>
              <TableHead>{t('invitations.columns.invitedBy')}</TableHead>
              <TableHead>{t('invitations.columns.expiresAt')}</TableHead>
              {isAdmin ? (
                <TableHead className="w-0">{t('invitations.columns.actions')}</TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {invitations.map((inv) => {
              const isExpired = inv.expiresAt.getTime() <= Date.now();
              return (
                <TableRow key={inv.id}>
                  <TableCell className="font-medium text-text-strong">{inv.email}</TableCell>
                  <TableCell>
                    <Pill variant={isExpired ? 'muted' : 'neutral'}>{renderRole(inv.role)}</Pill>
                  </TableCell>
                  <TableCell className="text-text-muted">
                    {inv.invitedByUser
                      ? (inv.invitedByUser.displayName ??
                        inv.invitedByUser.fullName ??
                        inv.invitedByUser.email)
                      : '—'}
                  </TableCell>
                  <TableCell className={cn('text-text-muted', isExpired && 'text-destructive')}>
                    {isExpired ? (
                      t('invitations.expired')
                    ) : (
                      <DateDisplay date={inv.expiresAt} format="short" />
                    )}
                  </TableCell>
                  {isAdmin ? (
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => handleRevoke(inv.id)}
                        disabled={isPending && revokingId === inv.id}
                        className="rounded p-1 text-text-muted hover:bg-fill-hover hover:text-destructive disabled:opacity-50"
                        aria-label={t('invitations.revoke')}
                      >
                        <Trash2 size={14} strokeWidth={1.5} />
                      </button>
                    </TableCell>
                  ) : null}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {isAdmin ? (
        <InviteMemberDialog
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          roleLabels={roleLabels}
        />
      ) : null}

      <ConfirmDeleteDialog
        open={removeTarget !== null}
        onOpenChange={(v) => {
          if (!v) {
            setRemoveTarget(null);
            setRemoveError(null);
          }
        }}
        title={t('members.removeConfirmTitle')}
        description={
          removeTarget
            ? `${renderUserName(removeTarget.user)} · ${removeTarget.user.email}\n\n${t('members.removeConfirmDescription')}${removeError ? `\n\n${removeError}` : ''}`
            : ''
        }
        onConfirm={handleConfirmRemove}
        isPending={isPending}
      />
    </div>
  );
}
