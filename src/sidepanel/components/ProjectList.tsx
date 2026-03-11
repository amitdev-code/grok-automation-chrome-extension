import { Icon } from '@iconify/react';
import type { Project } from '@/shared/types';
import { getOutputFolder } from '@/shared/utils';

interface ProjectListProps {
  projects: Project[];
  queueOrder: string[];
  onEdit: (project: Project) => void;
  onDelete: (id: string) => void;
  onDuplicate: (project: Project) => void;
  onAddToQueue: (id: string) => void;
  isInQueue: (id: string) => boolean;
}

const statusStyles: Record<Project['status'], string> = {
  idle: 'bg-gray-100 text-gray-600',
  running: 'bg-blue-100 text-blue-700',
  completed: 'bg-emerald-100 text-emerald-700',
  error: 'bg-red-100 text-red-700',
};

const modeLabels: Record<Project['mode'], string> = {
  'text-to-video': 'Video',
  'frame-to-video': 'Frame to Video',
  'text-to-image': 'Image',
};

export default function ProjectList({
  projects,
  onEdit,
  onDelete,
  onDuplicate,
  onAddToQueue,
  isInQueue,
}: ProjectListProps) {
  if (projects.length === 0) {
    return (
      <div className="rounded-2xl bg-gray-50 border border-gray-100 p-8 text-center">
        <Icon icon="mdi:folder-open-outline" className="w-10 h-10 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-500 font-poppins">No projects yet.</p>
        <p className="text-xs text-gray-400 mt-1">Create one to get started.</p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {projects.map((project) => (
        <li
          key={project.id}
          className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow transition-shadow"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-gray-900 truncate font-poppins">{project.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {modeLabels[project.mode]} · {project.prompts.length} prompt{project.prompts.length !== 1 ? 's' : ''}
              </p>
              <p className="text-xs text-gray-400 mt-0.5 truncate">
                {getOutputFolder(project.name)}/
              </p>
              {project.lastRunAt ? (
                <p className="text-xs text-gray-500 mt-0.5">
                  Last run: {new Date(project.lastRunAt).toLocaleString()}
                </p>
              ) : null}
              <span
                className={`inline-block mt-2 px-2.5 py-0.5 rounded-lg text-xs font-medium ${statusStyles[project.status]}`}
              >
                {project.status}
              </span>
            </div>
            <div className="flex flex-col gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => onEdit(project)}
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 font-medium transition-colors"
              >
                <Icon icon="mdi:pencil-outline" className="w-3.5 h-3.5" />
                Edit
              </button>
              <button
                type="button"
                onClick={() => onDuplicate(project)}
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 font-medium transition-colors"
              >
                <Icon icon="mdi:content-copy" className="w-3.5 h-3.5" />
                Duplicate
              </button>
              {!isInQueue(project.id) && (
                <button
                  type="button"
                  onClick={() => onAddToQueue(project.id)}
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-gray-900 text-white hover:bg-gray-800 font-medium transition-colors"
                >
                  <Icon icon="mdi:playlist-plus" className="w-3.5 h-3.5" />
                  Add to queue
                </button>
              )}
              <button
                type="button"
                onClick={() => onDelete(project.id)}
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border border-red-100 text-red-600 hover:bg-red-50 font-medium transition-colors"
              >
                <Icon icon="mdi:delete-outline" className="w-3.5 h-3.5" />
                Delete
              </button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
