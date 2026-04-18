'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { ProjectListItem } from '../queries/list-projects';
import { CreateProjectDialog } from './create-project-dialog';
import { ProjectTable } from './project-table';

type Props = {
  projects: ProjectListItem[];
  title: string;
  addLabel: string;
};

export function ProjectsPageClient({ projects, title, addLabel }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="px-6 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-text-strong">{title}</h1>
        <Button onClick={() => setDialogOpen(true)} size="sm">
          <Plus size={16} strokeWidth={1.5} className="mr-1.5" />
          {addLabel}
        </Button>
      </div>

      <ProjectTable projects={projects} />

      <CreateProjectDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
