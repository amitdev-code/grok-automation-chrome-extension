// Local copy for background (avoids shared chunk)
export type GenerationMode = 'text-to-video' | 'frame-to-video' | 'text-to-image';
export type ProjectStatus = 'idle' | 'running' | 'completed' | 'error';
export type ModelOption = 'grok-3.1-fast' | 'grok-3.1-quality' | 'grok-2-fast' | 'grok-2-quality';
export type AspectRatio = '16:9' | '9:16' | '1:1' | '2:3' | '3:2';
export type VideoQuality = '480p' | '720p';
export type VideoLength = '6' | '10';

export interface GenerationSettings {
  model: ModelOption;
  aspectRatio: AspectRatio;
  outputsPerPrompt: number;
  videoQuality: VideoQuality;
  videoLength: VideoLength;
}

export interface Project {
  id: string;
  name: string;
  mode: GenerationMode;
  prompts: string[];
  settings: GenerationSettings;
  status: ProjectStatus;
  sourceImageUrl?: string;
  createdAt: number;
  updatedAt: number;
  lastRunAt?: number;
}

export interface GlobalSettings {
  promptDelayMs: number;
  maxRetries: number;
  renderTimeoutMs: number;
  queueOrder: string[];
  downloadFolderPrefix: string;
}

export const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  promptDelayMs: 2000,
  maxRetries: 5,
  renderTimeoutMs: 300000,
  queueOrder: [],
  downloadFolderPrefix: 'GrokAutomation',
};
