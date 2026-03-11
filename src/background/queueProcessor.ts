import type { Project } from './types';
import { MESSAGE_TYPES, GROK_IMAGINE_URL, PAGE_LOAD_DELAY_MS } from './constants';
import { getProjects, getGlobalSettings } from './storageManager';

let queueState: {
  projectIds: string[];
  index: number;
  paused: boolean;
  tabId: number | null;
} | null = null;

function broadcastToPanel(message: object): void {
  chrome.runtime.sendMessage(message).catch(() => {});
}

const IMAGINE_PAGE = 'https://grok.com/imagine';

async function ensureGrokTab(): Promise<number> {
  const tabs = await chrome.tabs.query({ url: `${GROK_IMAGINE_URL}*` });
  let tab = tabs.find((t) => t.url?.startsWith(GROK_IMAGINE_URL));
  if (!tab?.id) {
    tab = await chrome.tabs.create({ url: IMAGINE_PAGE });
  }
  if (!tab?.id) throw new Error('Could not open or find Grok Imagine tab');
  return tab.id;
}

export function ensureTabOnImagine(tabId: number): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      const url = tab?.url ?? '';
      const onImagine = url === IMAGINE_PAGE || (url.startsWith(IMAGINE_PAGE) && (url.length === IMAGINE_PAGE.length || url[IMAGINE_PAGE.length] === '?'));
      if (onImagine) {
        resolve();
        return;
      }
      chrome.tabs.update(tabId, { url: IMAGINE_PAGE }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }
        const listener = (id: number, info: chrome.tabs.TabChangeInfo) => {
          if (id !== tabId || info.status !== 'complete') return;
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        };
        chrome.tabs.onUpdated.addListener(listener);
        setTimeout(() => {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }, 60000);
      });
    });
  });
}

function sanitizeProjectName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .trim()
    .slice(0, 100) || 'project';
}

export async function startQueue(projectIds: string[]): Promise<void> {
  if (queueState) return;
  const projects = await getProjects();
  const toRun = projectIds
    .map((id) => projects.find((p) => p.id === id))
    .filter((p): p is Project => !!p && p.prompts.length > 0);
  if (toRun.length === 0) {
    broadcastToPanel({ type: MESSAGE_TYPES.QUEUE_DONE });
    return;
  }
  const tabId = await ensureGrokTab();
  queueState = {
    projectIds: toRun.map((p) => p.id),
    index: 0,
    paused: false,
    tabId,
  };
  runNext();
}

function runNext(): void {
  if (!queueState) return;
  if (queueState.paused) return;
  if (queueState.index >= queueState.projectIds.length) {
    queueState = null;
    broadcastToPanel({ type: MESSAGE_TYPES.QUEUE_DONE });
    return;
  }
  const projectId = queueState.projectIds[queueState.index];
  getProjects().then((projects) => {
    const project = projects.find((p) => p.id === projectId);
    if (!project) {
      queueState!.index++;
      runNext();
      return;
    }
    broadcastToPanel({
      type: MESSAGE_TYPES.PROJECT_STARTED,
      projectId,
      label: `Project: ${project.name} (${queueState!.index + 1}/${queueState!.projectIds.length})`,
    });
    getGlobalSettings().then(async (globalSettings) => {
      const tabId = queueState!.tabId!;
      try {
        await ensureTabOnImagine(tabId);
        await new Promise((r) => setTimeout(r, PAGE_LOAD_DELAY_MS));
      } catch (navErr) {
        broadcastToPanel({
          type: MESSAGE_TYPES.ERROR,
          error: 'Could not navigate to https://grok.com/imagine',
          projectId,
        });
        if (queueState) {
          queueState.index++;
          runNext();
        }
        return;
      }
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['content.js'],
        });
      } catch (injectErr) {
        broadcastToPanel({
          type: MESSAGE_TYPES.ERROR,
          error: 'Could not load automation script. Ensure the tab is on https://grok.com/imagine and try again.',
          projectId,
        });
        if (queueState) {
          queueState.index++;
          runNext();
        }
        return;
      }
      chrome.tabs.sendMessage(tabId, {
        type: MESSAGE_TYPES.RUN_PROJECT,
        payload: { project, globalSettings },
      }).catch((err) => {
        broadcastToPanel({
          type: MESSAGE_TYPES.ERROR,
          error: err?.message ?? 'Content script not ready',
          projectId,
        });
        if (queueState) {
          queueState.index++;
          runNext();
        }
      });
    });
  });
}

export function onProjectDoneFromContent(projectId: string): void {
  broadcastToPanel({ type: MESSAGE_TYPES.PROJECT_DONE, projectId });
  if (queueState) {
    queueState.index++;
    runNext();
  }
}

export function pauseQueue(): void {
  if (queueState) queueState.paused = true;
  broadcastToPanel({ type: MESSAGE_TYPES.QUEUE_PAUSED });
}

export function resumeQueue(): void {
  if (queueState) {
    queueState.paused = false;
    runNext();
  }
}

export function terminateQueue(): void {
  if (queueState) {
    queueState = null;
    broadcastToPanel({ type: MESSAGE_TYPES.QUEUE_DONE });
  }
}

export function handleProjectProgress(label: string): void {
  broadcastToPanel({ type: MESSAGE_TYPES.PROJECT_PROGRESS, label });
}

export function handleContentError(error: string, projectId?: string): void {
  broadcastToPanel({ type: MESSAGE_TYPES.ERROR, error, projectId });
  if (queueState && projectId) {
    queueState.index++;
    runNext();
  }
}

export function getQueueState(): typeof queueState {
  return queueState;
}

export { sanitizeProjectName };
