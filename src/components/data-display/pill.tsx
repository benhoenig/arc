import { cn } from '@/lib/utils';

type PillVariant = 'neutral' | 'active' | 'muted' | 'positive' | 'warning' | 'destructive';

type Props = {
  variant?: PillVariant;
  children: React.ReactNode;
  className?: string;
};

const variantStyles: Record<PillVariant, string> = {
  neutral: 'border-border bg-background text-text-default',
  active: 'border-border-strong bg-fill-selected text-text-strong',
  muted: 'border-border-subtle text-text-muted',
  positive: 'border-positive bg-positive-fill text-positive',
  warning: 'border-warning bg-warning-fill text-warning',
  destructive: 'border-destructive bg-destructive-fill text-destructive',
};

export function Pill({ variant = 'neutral', children, className }: Props) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
        variantStyles[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
