// Message types (local to content script to avoid shared chunk)
export const MESSAGE_TYPES = {
  RUN_PROJECT: 'RUN_PROJECT',
  PROJECT_DONE: 'PROJECT_DONE',
  PROJECT_PROGRESS: 'PROJECT_PROGRESS',
  ERROR: 'ERROR',
  DOWNLOAD_REQUEST: 'DOWNLOAD_REQUEST',
} as const;
