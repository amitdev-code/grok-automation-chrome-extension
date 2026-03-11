import type { Project, GlobalSettings } from './types';
import { DEFAULT_GLOBAL_SETTINGS } from './types';
import { STORAGE_KEYS } from './constants';

export async function getProjects(): Promise<Project[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.PROJECTS);
  return (result[STORAGE_KEYS.PROJECTS] as Project[]) ?? [];
}

export async function saveProject(project: Project): Promise<void> {
  const projects = await getProjects();
  const index = projects.findIndex((p) => p.id === project.id);
  const updated = { ...project, updatedAt: Date.now() };
  if (index >= 0) {
    projects[index] = updated;
  } else {
    projects.push(updated);
  }
  await chrome.storage.local.set({ [STORAGE_KEYS.PROJECTS]: projects });
}

export async function deleteProject(id: string): Promise<void> {
  const projects = await getProjects();
  const filtered = projects.filter((p) => p.id !== id);
  await chrome.storage.local.set({ [STORAGE_KEYS.PROJECTS]: filtered });
  const order = await getQueueOrder();
  const newOrder = order.filter((pid) => pid !== id);
  await chrome.storage.local.set({ [STORAGE_KEYS.QUEUE_ORDER]: newOrder });
}

export async function getQueueOrder(): Promise<string[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.QUEUE_ORDER);
  return (result[STORAGE_KEYS.QUEUE_ORDER] as string[]) ?? [];
}

export async function setQueueOrder(projectIds: string[]): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.QUEUE_ORDER]: projectIds });
}

export async function getGlobalSettings(): Promise<GlobalSettings> {
  const result = await chrome.storage.local.get([
    STORAGE_KEYS.GLOBAL_SETTINGS,
    STORAGE_KEYS.QUEUE_ORDER,
  ]);
  const stored = result[STORAGE_KEYS.GLOBAL_SETTINGS] as Partial<GlobalSettings> | undefined;
  const queueOrder = (result[STORAGE_KEYS.QUEUE_ORDER] as string[]) ?? [];
  return { ...DEFAULT_GLOBAL_SETTINGS, ...stored, queueOrder };
}

export async function saveGlobalSettings(settings: GlobalSettings): Promise<void> {
  const { queueOrder, ...rest } = settings;
  await chrome.storage.local.set({ [STORAGE_KEYS.GLOBAL_SETTINGS]: rest });
  if (queueOrder !== undefined) {
    await chrome.storage.local.set({ [STORAGE_KEYS.QUEUE_ORDER]: queueOrder });
  }
}

export async function clearAllData(): Promise<void> {
  await chrome.storage.local.remove([
    STORAGE_KEYS.PROJECTS,
    STORAGE_KEYS.QUEUE_ORDER,
    STORAGE_KEYS.GLOBAL_SETTINGS,
  ]);
}
