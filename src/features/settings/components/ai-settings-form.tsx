'use client';

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
import { Textarea } from '@/components/ui/textarea';
import { clearAiCredential } from '../actions/clear-ai-credential';
import { updateAiApiKey } from '../actions/update-ai-api-key';
import { updateAiModel } from '../actions/update-ai-model';
import { updateAiSubscription } from '../actions/update-ai-subscription';
import { AI_MODEL_OPTIONS } from '../lib/ai-models';
import type { AiSettingsStatus } from '../queries/get-ai-settings';

type Props = {
  status: AiSettingsStatus;
};

export function AiSettingsForm({ status }: Props) {
  const t = useTranslations('settings.ai');
  const [isPending, startTransition] = useTransition();

  const [apiKey, setApiKey] = useState('');
  const [subscription, setSubscription] = useState('');
  const [model, setModel] = useState(status.effectiveModel);
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'error'; message: string } | null>(null);

  const encryptionDisabled = !status.encryptionAvailable;

  function showError(reason: string) {
    setFeedback({
      kind: 'error',
      message: t.has(`errors.${reason}`) ? t(`errors.${reason}`) : reason,
    });
  }

  function handleSaveKey() {
    setFeedback(null);
    startTransition(async () => {
      const result = await updateAiApiKey({ apiKey });
      if (!result.ok) {
        showError(
          result.error === 'validation'
            ? 'invalidKey'
            : result.error === 'conflict'
              ? (result.message ?? 'server')
              : result.error === 'forbidden'
                ? 'forbidden'
                : 'server',
        );
        return;
      }
      setApiKey('');
      setFeedback({ kind: 'ok', message: t('keySaved') });
    });
  }

  function handleSaveSubscription() {
    setFeedback(null);
    startTransition(async () => {
      const result = await updateAiSubscription({ credential: subscription });
      if (!result.ok) {
        showError(
          result.error === 'conflict'
            ? (result.message ?? 'server')
            : result.error === 'forbidden'
              ? 'forbidden'
              : 'server',
        );
        return;
      }
      setSubscription('');
      setFeedback({ kind: 'ok', message: t('subscriptionConnected') });
    });
  }

  function handleClearCredential() {
    setFeedback(null);
    startTransition(async () => {
      const result = await clearAiCredential();
      if (!result.ok) {
        showError('server');
        return;
      }
      setFeedback({ kind: 'ok', message: t('credentialCleared') });
    });
  }

  function handleSaveModel(next: string) {
    setModel(next);
    setFeedback(null);
    startTransition(async () => {
      const result = await updateAiModel({ model: next });
      if (!result.ok) {
        showError('server');
        return;
      }
      setFeedback({ kind: 'ok', message: t('modelSaved') });
    });
  }

  return (
    <div className="flex max-w-xl flex-col gap-8">
      {/* Status — which credential is active and where it resolves from */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-text-strong">{t('statusTitle')}</h2>
        <div className="flex items-center justify-between gap-4 rounded-md border border-border-subtle bg-surface px-4 py-3 text-sm">
          <div>
            {status.orgCredentialType === 'api_key' && (
              <p className="text-text-default">
                {t('sourceOrgKey')}{' '}
                <span className="font-mono text-text-muted">••••{status.keyLast4}</span>
              </p>
            )}
            {status.orgCredentialType === 'oauth' && (
              <p className="text-text-default">
                {t('sourceOrgSubscription')}{' '}
                <span className="font-mono text-text-muted">••••{status.subscriptionLast4}</span>
              </p>
            )}
            {status.source === 'env' && <p className="text-text-muted">{t('sourceEnv')}</p>}
            {status.source === 'none' && <p className="text-text-muted">{t('sourceNone')}</p>}
          </div>
          {status.source === 'org' && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClearCredential}
              disabled={isPending}
            >
              {t('clearCredential')}
            </Button>
          )}
        </div>
      </section>

      {encryptionDisabled && (
        <p className="rounded-md border border-border-subtle bg-fill-hover px-4 py-3 text-sm text-text-muted">
          {t('encryptionUnavailable')}
        </p>
      )}

      {feedback && (
        <p
          className={`text-sm ${feedback.kind === 'ok' ? 'text-positive' : 'text-destructive'}`}
          role="status"
        >
          {feedback.message}
        </p>
      )}

      {/* API key */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-medium text-text-strong">{t('keyTitle')}</h2>
          <p className="text-xs text-text-muted">{t('keyHelp')}</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="apiKey">{t('keyLabel')}</Label>
          <Input
            id="apiKey"
            type="password"
            autoComplete="off"
            placeholder="sk-ant-..."
            value={apiKey}
            disabled={encryptionDisabled || isPending}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </div>

        <Button
          type="button"
          onClick={handleSaveKey}
          disabled={encryptionDisabled || isPending || apiKey.trim().length === 0}
          className="w-fit"
        >
          {status.orgCredentialType === 'api_key' ? t('replaceKey') : t('saveKey')}
        </Button>
      </section>

      {/* Claude subscription — paste the credential from local Claude Code */}
      <section className="flex flex-col gap-3 border-t border-border-subtle pt-8">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-medium text-text-strong">{t('subscriptionTitle')}</h2>
          <p className="text-xs text-text-muted">{t('subscriptionHelp')}</p>
          <p className="text-xs text-text-muted">
            {t('subscriptionHint')}{' '}
            <code className="rounded bg-fill-hover px-1 py-0.5 font-mono text-[11px]">
              security find-generic-password -s "Claude Code-credentials" -w
            </code>
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="subscription">{t('subscriptionLabel')}</Label>
          <Textarea
            id="subscription"
            autoComplete="off"
            placeholder='{"claudeAiOauth":{"accessToken":"sk-ant-oat...","refreshToken":"sk-ant-ort...","expiresAt":...}}'
            value={subscription}
            disabled={encryptionDisabled || isPending}
            onChange={(e) => setSubscription(e.target.value)}
            className="min-h-24 font-mono text-xs"
          />
        </div>

        <Button
          type="button"
          variant="secondary"
          onClick={handleSaveSubscription}
          disabled={encryptionDisabled || isPending || subscription.trim().length === 0}
          className="w-fit"
        >
          {status.orgCredentialType === 'oauth'
            ? t('reconnectSubscription')
            : t('connectSubscription')}
        </Button>
      </section>

      {/* Model */}
      <section className="flex flex-col gap-3 border-t border-border-subtle pt-8">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-medium text-text-strong">{t('modelTitle')}</h2>
          <p className="text-xs text-text-muted">{t('modelHelp')}</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>{t('modelLabel')}</Label>
          <Select value={model} onValueChange={handleSaveModel} disabled={isPending}>
            <SelectTrigger className="max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AI_MODEL_OPTIONS.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.label}
                  {m.recommended ? ` · ${t('recommended')}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>
    </div>
  );
}
