import { Icon } from '@iconify/react';
import type { Project } from '@/shared/types';

interface QueueViewProps {
  projects: Project[];
  queueOrder: string[];
  isRunning: boolean;
  isPaused: boolean;
  currentProjectId: string | null;
  progressLabel: string | null;
  onReorder: (projectIds: string[]) => void;
  onRemoveFromQueue: (id: string) => void;
  onRunAll: () => void;
  onPause: () => void;
  onResume: () => void;
  onTerminate: () => void;
}

const modeLabels: Record<Project['mode'], string> = {
  'text-to-video': 'Text to Video',
  'frame-to-video': 'Frame to Video',
  'text-to-image': 'Text to Image',
};

export default function QueueView({
  projects,
  queueOrder,
  isRunning,
  isPaused,
  currentProjectId,
  progressLabel,
  onReorder,
  onRemoveFromQueue,
  onRunAll,
  onPause,
  onResume,
  onTerminate,
}: QueueViewProps) {
  const queueProjects = queueOrder
    .map((id) => projects.find((p) => p.id === id))
    .filter((p): p is Project => !!p);

  const move = (index: number, delta: number) => {
    const newOrder = [...queueOrder];
    const target = index + delta;
    if (target < 0 || target >= newOrder.length) return;
    [newOrder[index], newOrder[target]] = [newOrder[target], newOrder[index]];
    onReorder(newOrder);
  };

  return (
    <div className="border border-gray-200 rounded-2xl p-4 bg-white shadow-sm font-poppins">
      <h3 className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
        <Icon icon="mdi:playlist-play" className="w-4 h-4" />
        Queue
      </h3>
      {queueProjects.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-gray-500 py-3">
          <Icon icon="mdi:playlist-remove" className="w-4 h-4 text-gray-400" />
          Add projects from the list above.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {queueProjects.map((project, index) => (
            <li
              key={project.id}
              className={`flex items-center justify-between gap-2 py-2 px-3 rounded-xl transition-colors ${
                project.id === currentProjectId ? 'bg-blue-50 border border-blue-100' : 'hover:bg-gray-50'
              }`}
            >
              <span className="text-xs text-gray-500 w-5">{index + 1}.</span>
              <span className="text-sm text-gray-900 truncate flex-1">
                {project.name}
              </span>
              <span className="text-xs text-gray-500 shrink-0">
                {modeLabels[project.mode]}
              </span>
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={index === 0 || isRunning}
                  className="p-1 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-40 transition-colors"
                  title="Move up"
                >
                  <Icon icon="mdi:chevron-up" className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === queueProjects.length - 1 || isRunning}
                  className="p-1 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-40 transition-colors"
                  title="Move down"
                >
                  <Icon icon="mdi:chevron-down" className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onRemoveFromQueue(project.id)}
                  disabled={isRunning && project.id === currentProjectId}
                  className="p-1 rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-40 transition-colors"
                  title="Remove from queue"
                >
                  <Icon icon="mdi:close" className="w-3.5 h-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {progressLabel && (
        <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 flex gap-2">
          <Icon icon="mdi:progress-clock" className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-amber-800 mb-0.5">Current step</p>
            <p className="text-sm text-amber-900 break-words">{progressLabel}</p>
          </div>
        </div>
      )}
      <div className="flex gap-2 mt-3">
        <button
          type="button"
          onClick={onRunAll}
          disabled={queueProjects.length === 0 || isRunning}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors"
        >
          <Icon icon="mdi:play" className="w-4 h-4" />
          Run all
        </button>
        {isRunning && (
          <>
            <button
              type="button"
              onClick={isPaused ? onResume : onPause}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl border border-gray-200 text-gray-700 text-sm hover:bg-gray-50 transition-colors"
            >
              <Icon icon={isPaused ? 'mdi:play' : 'mdi:pause'} className="w-4 h-4" />
              {isPaused ? 'Resume' : 'Pause'}
            </button>
            <button
              type="button"
              onClick={onTerminate}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl border border-red-200 text-red-600 text-sm hover:bg-red-50 transition-colors"
            >
              <Icon icon="mdi:stop" className="w-4 h-4" />
              Terminate
            </button>
          </>
        )}
      </div>
    </div>
  );
}
