import type { Project } from '@/shared/types';
import { DEFAULT_GENERATION_SETTINGS } from '@/shared/types';
import { DOWNLOAD_FOLDER_PREFIX } from '@/shared/constants';

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function sanitizeProjectName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .trim()
    .slice(0, 100) || 'project';
}

export function getOutputFolder(projectName: string): string {
  return `${DOWNLOAD_FOLDER_PREFIX}/${sanitizeProjectName(projectName)}`;
}

export function parsePromptsFromText(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function createNewProject(overrides?: Partial<Project>): Project {
  const now = Date.now();
  return {
    id: generateId(),
    name: 'New Project',
    mode: 'text-to-video',
    prompts: [],
    settings: { ...DEFAULT_GENERATION_SETTINGS },
    status: 'idle',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
