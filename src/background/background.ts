import { MESSAGE_TYPES, GROK_IMAGINE_URL } from './constants';
import type { Project, GlobalSettings } from './types';
import {
  getProjects,
  saveProject,
  deleteProject,
  getQueueOrder,
  setQueueOrder,
  getGlobalSettings,
  saveGlobalSettings,
  clearAllData,
} from './storageManager';
import {
  startQueue,
  pauseQueue,
  resumeQueue,
  terminateQueue,
  onProjectDoneFromContent,
  handleProjectProgress,
  handleContentError,
} from './queueProcessor';
import { handleDownloadRequest } from './downloadHandler';

function broadcastToPanel(message: object): void {
  chrome.runtime.sendMessage(message).catch(() => {});
}

chrome.runtime.onInstalled.addListener(() => {
  console.log('Grok Automation extension installed');
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch(() => {});
});

chrome.runtime.onMessage.addListener(
  (
    message: { type: string; payload?: unknown },
    sender,
    sendResponse
  ) => {
    // Only handle messages from extension pages (e.g. side panel), not from content script
    if (sender.tab) return false;
    const handle = async () => {
      switch (message.type) {
        case MESSAGE_TYPES.GET_PROJECTS: {
          const projects = await getProjects();
          const queueOrder = await getQueueOrder();
          return { projects, queueOrder };
        }
        case MESSAGE_TYPES.SAVE_PROJECT: {
          const project = message.payload as Project;
          await saveProject(project);
          const projects = await getProjects();
          broadcastToPanel({ type: MESSAGE_TYPES.PROJECTS_UPDATED, projects });
          return { ok: true };
        }
        case MESSAGE_TYPES.DELETE_PROJECT: {
          const id = message.payload as string;
          await deleteProject(id);
          const projects = await getProjects();
          broadcastToPanel({ type: MESSAGE_TYPES.PROJECTS_UPDATED, projects });
          return { ok: true };
        }
        case MESSAGE_TYPES.GET_GLOBAL_SETTINGS: {
          return await getGlobalSettings();
        }
        case MESSAGE_TYPES.SAVE_GLOBAL_SETTINGS: {
          const settings = message.payload as GlobalSettings;
          await saveGlobalSettings(settings);
          return { ok: true };
        }
        case MESSAGE_TYPES.SET_QUEUE_ORDER: {
          const projectIds = message.payload as string[];
          await setQueueOrder(projectIds);
          return { ok: true };
        }
        case MESSAGE_TYPES.GET_TAB_STATUS: {
          const tabs = await chrome.tabs.query({ url: `${GROK_IMAGINE_URL}*` });
          const grokTab = tabs.find((t) => t.url?.startsWith(GROK_IMAGINE_URL));
          return {
            hasGrokTab: !!grokTab,
            tabId: grokTab?.id,
            url: grokTab?.url,
          };
        }
        case MESSAGE_TYPES.START_QUEUE: {
          const payload = message.payload as { projectIds: string[] };
          if (payload?.projectIds?.length) {
            startQueue(payload.projectIds).catch((err) => {
              broadcastToPanel({ type: MESSAGE_TYPES.ERROR, error: err?.message });
            });
          }
          return { ok: true };
        }
        case MESSAGE_TYPES.PAUSE_QUEUE: {
          pauseQueue();
          return { ok: true };
        }
        case MESSAGE_TYPES.RESUME_QUEUE: {
          resumeQueue();
          return { ok: true };
        }
        case MESSAGE_TYPES.TERMINATE_QUEUE: {
          terminateQueue();
          return { ok: true };
        }
        case MESSAGE_TYPES.CLEAR_ALL_DATA: {
          await clearAllData();
          return { ok: true };
        }
        default:
          return null;
      }
    };
    handle().then(sendResponse);
    return true; // keep channel open for async sendResponse
  }
);

// Messages from content script (sender.tab exists)
chrome.runtime.onMessage.addListener(
  (message: { type: string; payload?: unknown }, sender, sendResponse) => {
    if (!sender.tab) return false;
    if (message.type === MESSAGE_TYPES.DOWNLOAD_REQUEST) {
      const req = message.payload as {
        url: string;
        projectName: string;
        promptIndex: number;
        isVideo: boolean;
      };
      if (req?.url) {
        handleDownloadRequest(req).then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
        return true;
      }
      sendResponse({ ok: true });
      return false;
    }
    if (message.type === MESSAGE_TYPES.PROJECT_DONE) {
      const projectId = message.payload as string;
      if (projectId) {
        onProjectDoneFromContent(projectId);
        getProjects().then((projects) => {
          const p = projects.find((x) => x.id === projectId);
          if (p) {
            saveProject({ ...p, status: 'completed', lastRunAt: Date.now() });
          }
        });
      }
      sendResponse({ ok: true });
      return false;
    }
    if (message.type === MESSAGE_TYPES.PROJECT_PROGRESS) {
      const label = message.payload as string;
      if (label) handleProjectProgress(label);
      sendResponse({ ok: true });
      return false;
    }
    if (message.type === MESSAGE_TYPES.ERROR) {
      const { error, projectId } = (message.payload || {}) as { error?: string; projectId?: string };
      handleContentError(error ?? 'Unknown error', projectId);
      sendResponse({ ok: true });
      return false;
    }
    return false;
  }
);

// When Chrome interrupts our download (e.g. "Ask where to save" is on), tell the user how to fix it.
chrome.downloads.onChanged.addListener((delta) => {
  if (delta.state?.current === 'interrupted' && delta.error?.current === 'USER_CANCELED') {
    chrome.downloads.search({ id: delta.id }).then((items) => {
      const item = items[0];
      if (item?.byExtensionId === chrome.runtime.id) {
        broadcastToPanel({
          type: MESSAGE_TYPES.DOWNLOAD_SAVE_AS_TIP,
          message:
            'Turn off "Ask where to save each file" in Chrome → Settings → Downloads so files save automatically.',
        });
      }
    });
  }
});
