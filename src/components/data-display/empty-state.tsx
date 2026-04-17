import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Props = {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
};

export function EmptyState({ title, description, actionLabel, onAction, className }: Props) {
  return (
    <div
      className={cn('flex flex-col items-center justify-center gap-3 py-16 text-center', className)}
    >
      <h3 className="text-base font-medium text-text-default">{title}</h3>
      {description && <p className="max-w-sm text-sm text-text-muted">{description}</p>}
      {actionLabel && onAction && (
        <Button variant="secondary" onClick={onAction} className="mt-2">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
