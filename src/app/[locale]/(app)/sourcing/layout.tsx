import type { ReactNode } from 'react';
import { SourcingSubNav } from '@/features/sourcing/components/sourcing-sub-nav';

type Props = {
  children: ReactNode;
};

export default function SourcingLayout({ children }: Props) {
  return (
    <div>
      <SourcingSubNav />
      {children}
    </div>
  );
}
