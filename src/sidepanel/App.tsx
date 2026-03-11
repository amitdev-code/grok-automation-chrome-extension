import { useState, useEffect, useCallback } from 'react';
import { Icon } from '@iconify/react';
import type { Project, GlobalSettings } from '@/shared/types';
import { createNewProject, generateId } from '@/shared/utils';
import { MESSAGE_TYPES } from '@/shared/constants';
import { DEFAULT_GLOBAL_SETTINGS } from '@/shared/types';
import ProjectList from './components/ProjectList';
import ProjectForm from './components/ProjectForm';
import QueueView from './components/QueueView';
import GlobalSettingsForm from './components/GlobalSettingsForm';

type ViewMode = 'mode-select' | 'partial' | 'extended' | 'create-video-from-last-frame';

export default function App() {
  const [view, setView] = useState<ViewMode | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [queueOrder, setQueueOrder] = useState<string[]>([]);
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [progressLabel, setProgressLabel] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [saveAsTip, setSaveAsTip] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'projects' | 'settings'>('projects');

  const loadProjects = useCallback(() => {
    chrome.runtime.sendMessage({ type: MESSAGE_TYPES.GET_PROJECTS }, (response) => {
      if (response?.projects) setProjects(response.projects);
      if (response?.queueOrder) setQueueOrder(response.queueOrder);
    });
  }, []);

  const loadGlobalSettings = useCallback(() => {
    chrome.runtime.sendMessage({ type: MESSAGE_TYPES.GET_GLOBAL_SETTINGS }, (response) => {
      if (response && !response.type) setGlobalSettings(response as GlobalSettings);
      else setGlobalSettings(DEFAULT_GLOBAL_SETTINGS);
    });
  }, []);

  useEffect(() => {
    chrome.runtime.sendMessage({ type: MESSAGE_TYPES.CLEAR_ALL_DATA }, () => {
      setProjects([]);
      setQueueOrder([]);
      setView('mode-select');
    });
  }, []);

  useEffect(() => {
    if (view === 'partial') {
      loadProjects();
      loadGlobalSettings();
    }
  }, [view, loadProjects, loadGlobalSettings]);

  useEffect(() => {
    const listener = (
      message: { type: string; projects?: Project[]; error?: string; projectId?: string; label?: string; message?: string }
    ) => {
      if (message.type === MESSAGE_TYPES.PROJECTS_UPDATED && message.projects) {
        setProjects(message.projects);
      }
      if (message.type === MESSAGE_TYPES.PROJECT_STARTED && message.projectId) {
        setCurrentProjectId(message.projectId);
        setProgressLabel(message.label ?? null);
      }
      if (message.type === MESSAGE_TYPES.PROJECT_PROGRESS && message.label) {
        setProgressLabel(message.label);
      }
      if (message.type === MESSAGE_TYPES.PROJECT_DONE) {
        setProjects((prev) =>
          prev.map((p) =>
            p.id === message.projectId
              ? { ...p, status: 'completed' as const }
              : p
          )
        );
      }
      if (message.type === MESSAGE_TYPES.QUEUE_DONE) {
        setIsRunning(false);
        setIsPaused(false);
        setCurrentProjectId(null);
        setProgressLabel(null);
        setSaveAsTip(null);
        loadProjects();
      }
      if (message.type === MESSAGE_TYPES.QUEUE_PAUSED) {
        setIsPaused(true);
      }
      if (message.type === MESSAGE_TYPES.ERROR) {
        setLastError(message.error ?? 'Unknown error');
        setProjects((prev) =>
          prev.map((p) =>
            p.id === currentProjectId ? { ...p, status: 'error' as const } : p
          )
        );
      }
      if (message.type === MESSAGE_TYPES.DOWNLOAD_SAVE_AS_TIP && message.message) {
        setSaveAsTip(message.message);
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [loadProjects, currentProjectId]);

  const handleSaveProject = (project: Project) => {
    chrome.runtime.sendMessage(
      { type: MESSAGE_TYPES.SAVE_PROJECT, payload: project },
      () => {
        setEditingProject(null);
        loadProjects();
      }
    );
  };

  const handleDeleteProject = (id: string) => {
    if (!confirm('Delete this project?')) return;
    chrome.runtime.sendMessage({ type: MESSAGE_TYPES.DELETE_PROJECT, payload: id }, () => {
      setEditingProject((p) => (p?.id === id ? null : p));
      loadProjects();
    });
  };

  const handleDuplicateProject = (project: Project) => {
    const copy = createNewProject({
      ...project,
      id: undefined,
      name: `${project.name} (copy)`,
      status: 'idle',
      prompts: [...project.prompts],
      settings: { ...project.settings },
    });
    handleSaveProject(copy);
    setEditingProject(null);
  };

  const handleSetQueueOrder = (projectIds: string[]) => {
    setQueueOrder(projectIds);
    chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.SET_QUEUE_ORDER,
      payload: projectIds,
    });
  };

  const handleAddToQueue = (id: string) => {
    if (queueOrder.includes(id)) return;
    const next = [...queueOrder, id];
    handleSetQueueOrder(next);
  };

  const handleRemoveFromQueue = (id: string) => {
    handleSetQueueOrder(queueOrder.filter((pid) => pid !== id));
  };

  const handleRunAll = () => {
    setLastError(null);
    setProjects((prev) =>
      prev.map((p) =>
        queueOrder.includes(p.id) ? { ...p, status: 'running' as const } : p
      )
    );
    setIsRunning(true);
    setIsPaused(false);
    chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.START_QUEUE,
      payload: { projectIds: queueOrder },
    });
  };

  const handlePause = () => {
    chrome.runtime.sendMessage({ type: MESSAGE_TYPES.PAUSE_QUEUE });
  };

  const handleResume = () => {
    chrome.runtime.sendMessage({ type: MESSAGE_TYPES.RESUME_QUEUE });
    setIsPaused(false);
  };

  const handleTerminate = () => {
    if (!confirm('Stop the queue? Current project will not complete.')) return;
    chrome.runtime.sendMessage({ type: MESSAGE_TYPES.TERMINATE_QUEUE }, () => {
      setIsRunning(false);
      setIsPaused(false);
      setCurrentProjectId(null);
      setProgressLabel(null);
      loadProjects();
    });
  };

  const handleSaveGlobalSettings = () => {
    if (!globalSettings) return;
    chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.SAVE_GLOBAL_SETTINGS,
      payload: globalSettings,
    });
  };

  const handleExport = () => {
    const data = { projects, queueOrder, exportedAt: Date.now() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `grok-automation-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result)) as {
          projects?: Project[];
          queueOrder?: string[];
        };
        const list = data.projects ?? [];
        const idMap = new Map<string, string>();
        const newIds: string[] = [];
        list.forEach((p) => {
          const newId = generateId();
          idMap.set(p.id, newId);
          newIds.push(newId);
          const created = Date.now();
          chrome.runtime.sendMessage({
            type: MESSAGE_TYPES.SAVE_PROJECT,
            payload: {
              ...p,
              id: newId,
              status: 'idle',
              createdAt: created,
              updatedAt: created,
              lastRunAt: undefined,
            },
          });
        });
        const order = data.queueOrder ?? [];
        const newOrder = order.map((oldId) => idMap.get(oldId) ?? oldId).filter(Boolean);
        if (newOrder.length > 0) {
          chrome.runtime.sendMessage({ type: MESSAGE_TYPES.SET_QUEUE_ORDER, payload: newOrder });
        }
        loadProjects();
      } catch (err) {
        setLastError(err instanceof Error ? err.message : 'Invalid export file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const isInQueue = (id: string) => queueOrder.includes(id);

  if (view === null) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[200px]">
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    );
  }

  if (view === 'mode-select') {
    return (
      <div className="p-4 max-w-md mx-auto bg-gray-50 min-h-screen flex flex-col items-center justify-center font-poppins">
        <h1 className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-6">
          <Icon icon="mdi:robot-outline" className="w-5 h-5 text-gray-600" />
          Grok Automation
        </h1>
        <p className="text-sm text-gray-600 mb-6">Choose a mode to get started</p>
        <div className="w-full space-y-3">
          <button
            type="button"
            onClick={() => {
              setGlobalSettings(DEFAULT_GLOBAL_SETTINGS);
              setView('partial');
            }}
            className="w-full py-4 px-4 rounded-2xl border border-gray-200 bg-white text-gray-900 font-medium hover:border-gray-300 hover:shadow-sm transition-all text-left flex items-start gap-3"
          >
            <Icon icon="mdi:image-multiple-outline" className="w-6 h-6 text-gray-500 shrink-0 mt-0.5" />
            <span>
              <span className="block font-semibold">Partial Clips</span>
              <span className="block text-xs text-gray-500 mt-1">
                Create projects, queue prompts, and automate generation on Grok Imagine
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => setView('create-video-from-last-frame')}
            className="w-full py-4 px-4 rounded-2xl border border-gray-200 bg-white text-gray-900 font-medium hover:border-gray-300 hover:bg-gray-50 transition-all text-left flex items-start gap-3"
          >
            <Icon icon="mdi:movie-plus-outline" className="w-6 h-6 text-gray-500 shrink-0 mt-0.5" />
            <span>
              <span className="block font-semibold">Create Video From last Frame</span>
              <span className="block text-xs text-gray-500 mt-1">
                Generate video continuing from the last frame
              </span>
            </span>
          </button>
        </div>
      </div>
    );
  }

  if (view === 'extended') {
    return (
      <div className="p-4 max-w-md mx-auto bg-gray-50 min-h-screen flex flex-col items-center justify-center font-poppins">
        <Icon icon="mdi:movie-open-outline" className="w-10 h-10 text-gray-400 mb-2" />
        <h1 className="text-lg font-semibold text-gray-900 mb-2">Extended Long Video</h1>
        <p className="text-gray-600 text-center">Coming soon</p>
        <button
          type="button"
          onClick={() => setView('mode-select')}
          className="mt-6 inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 underline"
        >
          <Icon icon="mdi:arrow-left" className="w-4 h-4" />
          Back to mode selection
        </button>
      </div>
    );
  }

  if (view === 'create-video-from-last-frame') {
    return (
      <div className="p-4 max-w-md mx-auto bg-gray-50 min-h-screen flex flex-col items-center justify-center font-poppins">
        <Icon icon="mdi:movie-plus-outline" className="w-10 h-10 text-gray-400 mb-2" />
        <h1 className="text-lg font-semibold text-gray-900 mb-2">Create Video From last Frame</h1>
        <p className="text-gray-600 text-center">Coming soon</p>
        <button
          type="button"
          onClick={() => setView('mode-select')}
          className="mt-6 inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 underline"
        >
          <Icon icon="mdi:arrow-left" className="w-4 h-4" />
          Back to mode selection
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-md mx-auto space-y-4 bg-gray-50 min-h-screen font-poppins">
      <h1 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
        <Icon icon="mdi:robot-outline" className="w-5 h-5 text-gray-600" />
        Grok Automation
      </h1>

      <div className="flex gap-1 p-1 rounded-2xl bg-gray-100 border border-gray-100">
        <button
          type="button"
          onClick={() => setActiveTab('projects')}
          className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            activeTab === 'projects'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Icon icon="mdi:folder-multiple-outline" className="w-4 h-4" />
          Manage Projects
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            activeTab === 'settings'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Icon icon="mdi:cog-outline" className="w-4 h-4" />
          Settings
        </button>
      </div>

      {saveAsTip && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 flex gap-2">
          <Icon icon="mdi:information-outline" className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span className="flex-1">
            <strong>To avoid Save As dialog:</strong> {saveAsTip}
            <button
              type="button"
              onClick={() => setSaveAsTip(null)}
              className="ml-2 text-amber-700 hover:underline"
            >
              Dismiss
            </button>
          </span>
        </div>
      )}
      {lastError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 flex gap-2">
          <Icon icon="mdi:alert-circle-outline" className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          {lastError}
        </div>
      )}

      {activeTab === 'settings' && (
        <>
          <h2 className="text-sm font-semibold text-gray-900">Settings</h2>
          {globalSettings && (
            <GlobalSettingsForm
              settings={globalSettings}
              onChange={setGlobalSettings}
              onSave={handleSaveGlobalSettings}
            />
          )}
        </>
      )}

      {activeTab === 'projects' && (
        <>
          {editingProject !== null ? (
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-900 mb-4 font-poppins">
                {editingProject.id ? 'Edit project' : 'New project'}
              </h2>
              <ProjectForm
                project={editingProject}
                onSave={handleSaveProject}
                onCancel={() => setEditingProject(null)}
              />
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setEditingProject(createNewProject())}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors font-poppins"
                >
                  <Icon icon="mdi:plus" className="w-4 h-4" />
                  Create project
                </button>
                <button
                  type="button"
                  onClick={handleExport}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-gray-200 text-gray-700 text-sm hover:bg-gray-50 transition-colors font-poppins"
                >
                  <Icon icon="mdi:export" className="w-4 h-4" />
                  Export
                </button>
                <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-gray-200 text-gray-700 text-sm hover:bg-gray-50 cursor-pointer transition-colors font-poppins">
                  <Icon icon="mdi:import" className="w-4 h-4" />
                  Import
                  <input type="file" accept=".json" className="hidden" onChange={handleImport} />
                </label>
              </div>

              <div>
                <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 font-poppins">Projects</h2>
                <ProjectList
                  projects={projects}
                  queueOrder={queueOrder}
                  onEdit={setEditingProject}
                  onDelete={handleDeleteProject}
                  onDuplicate={handleDuplicateProject}
                  onAddToQueue={handleAddToQueue}
                  isInQueue={isInQueue}
                />
              </div>

              <QueueView
                projects={projects}
                queueOrder={queueOrder}
                isRunning={isRunning}
                isPaused={isPaused}
                currentProjectId={currentProjectId}
                progressLabel={progressLabel}
                onReorder={handleSetQueueOrder}
                onRemoveFromQueue={handleRemoveFromQueue}
                onRunAll={handleRunAll}
                onPause={handlePause}
                onResume={handleResume}
                onTerminate={handleTerminate}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
