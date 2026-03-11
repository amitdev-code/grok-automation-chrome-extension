import { sanitizeProjectName } from './queueProcessor';
import { getGlobalSettings } from './storageManager';

export interface DownloadRequest {
  url: string;
  projectName: string;
  promptIndex: number;
  isVideo: boolean;
}

export async function handleDownloadRequest(req: DownloadRequest): Promise<void> {
  const settings = await getGlobalSettings();
  const prefix = settings.downloadFolderPrefix?.trim() || 'GrokAutomation';
  const safeName = sanitizeProjectName(req.projectName);
  const folder = `${prefix}/${safeName}`;
  const timestamp = Date.now();
  const ext = req.isVideo ? 'mp4' : 'png';
  const filename = `${folder}/${safeName}_${timestamp}_${req.promptIndex}.${ext}`;
  chrome.downloads.download({
    url: req.url,
    filename,
    saveAs: false,
    conflictAction: 'overwrite',
  });
}
