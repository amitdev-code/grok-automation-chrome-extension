const STORAGE_KEYS = {
  PROJECTS: "projects",
  QUEUE_ORDER: "queueOrder",
  GLOBAL_SETTINGS: "globalSettings"
};
const MESSAGE_TYPES = {
  START_QUEUE: "START_QUEUE",
  PAUSE_QUEUE: "PAUSE_QUEUE",
  RESUME_QUEUE: "RESUME_QUEUE",
  TERMINATE_QUEUE: "TERMINATE_QUEUE",
  GET_PROJECTS: "GET_PROJECTS",
  SAVE_PROJECT: "SAVE_PROJECT",
  DELETE_PROJECT: "DELETE_PROJECT",
  GET_TAB_STATUS: "GET_TAB_STATUS",
  GET_GLOBAL_SETTINGS: "GET_GLOBAL_SETTINGS",
  SAVE_GLOBAL_SETTINGS: "SAVE_GLOBAL_SETTINGS",
  SET_QUEUE_ORDER: "SET_QUEUE_ORDER",
  CLEAR_ALL_DATA: "CLEAR_ALL_DATA",
  PROJECTS_UPDATED: "PROJECTS_UPDATED",
  PROJECT_STARTED: "PROJECT_STARTED",
  PROJECT_PROGRESS: "PROJECT_PROGRESS",
  PROJECT_DONE: "PROJECT_DONE",
  QUEUE_DONE: "QUEUE_DONE",
  QUEUE_PAUSED: "QUEUE_PAUSED",
  TAB_STATUS: "TAB_STATUS",
  GLOBAL_SETTINGS: "GLOBAL_SETTINGS",
  ERROR: "ERROR",
  RUN_PROJECT: "RUN_PROJECT",
  DOWNLOAD_REQUEST: "DOWNLOAD_REQUEST",
  CONTENT_READY: "CONTENT_READY",
  DOWNLOAD_SAVE_AS_TIP: "DOWNLOAD_SAVE_AS_TIP",
  REQUEST_NAVIGATE_TO_IMAGINE: "REQUEST_NAVIGATE_TO_IMAGINE"
};
const GROK_IMAGINE_URL = "https://grok.com/imagine";
const PAGE_LOAD_DELAY_MS = 5e3;

const DEFAULT_GLOBAL_SETTINGS = {
  promptDelayMs: 2e3,
  maxRetries: 5,
  renderTimeoutMs: 3e5,
  queueOrder: [],
  downloadFolderPrefix: "GrokAutomation"
};

async function getProjects() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.PROJECTS);
  return result[STORAGE_KEYS.PROJECTS] ?? [];
}
async function saveProject(project) {
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
async function deleteProject(id) {
  const projects = await getProjects();
  const filtered = projects.filter((p) => p.id !== id);
  await chrome.storage.local.set({ [STORAGE_KEYS.PROJECTS]: filtered });
  const order = await getQueueOrder();
  const newOrder = order.filter((pid) => pid !== id);
  await chrome.storage.local.set({ [STORAGE_KEYS.QUEUE_ORDER]: newOrder });
}
async function getQueueOrder() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.QUEUE_ORDER);
  return result[STORAGE_KEYS.QUEUE_ORDER] ?? [];
}
async function setQueueOrder(projectIds) {
  await chrome.storage.local.set({ [STORAGE_KEYS.QUEUE_ORDER]: projectIds });
}
async function getGlobalSettings() {
  const result = await chrome.storage.local.get([
    STORAGE_KEYS.GLOBAL_SETTINGS,
    STORAGE_KEYS.QUEUE_ORDER
  ]);
  const stored = result[STORAGE_KEYS.GLOBAL_SETTINGS];
  const queueOrder = result[STORAGE_KEYS.QUEUE_ORDER] ?? [];
  return { ...DEFAULT_GLOBAL_SETTINGS, ...stored, queueOrder };
}
async function saveGlobalSettings(settings) {
  const { queueOrder, ...rest } = settings;
  await chrome.storage.local.set({ [STORAGE_KEYS.GLOBAL_SETTINGS]: rest });
  if (queueOrder !== void 0) {
    await chrome.storage.local.set({ [STORAGE_KEYS.QUEUE_ORDER]: queueOrder });
  }
}
async function clearAllData() {
  await chrome.storage.local.remove([
    STORAGE_KEYS.PROJECTS,
    STORAGE_KEYS.QUEUE_ORDER,
    STORAGE_KEYS.GLOBAL_SETTINGS
  ]);
}

let queueState = null;
function broadcastToPanel$1(message) {
  chrome.runtime.sendMessage(message).catch(() => {
  });
}
const IMAGINE_PAGE = "https://grok.com/imagine";
async function ensureGrokTab() {
  const tabs = await chrome.tabs.query({ url: `${GROK_IMAGINE_URL}*` });
  let tab = tabs.find((t) => t.url?.startsWith(GROK_IMAGINE_URL));
  if (!tab?.id) {
    tab = await chrome.tabs.create({ url: IMAGINE_PAGE });
  }
  if (!tab?.id) throw new Error("Could not open or find Grok Imagine tab");
  return tab.id;
}
function ensureTabOnImagine(tabId) {
  return new Promise((resolve, reject) => {
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      const url = tab?.url ?? "";
      const onImagine = url === IMAGINE_PAGE || url.startsWith(IMAGINE_PAGE) && (url.length === IMAGINE_PAGE.length || url[IMAGINE_PAGE.length] === "?");
      if (onImagine) {
        resolve();
        return;
      }
      chrome.tabs.update(tabId, { url: IMAGINE_PAGE }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }
        const listener = (id, info) => {
          if (id !== tabId || info.status !== "complete") return;
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        };
        chrome.tabs.onUpdated.addListener(listener);
        setTimeout(() => {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }, 6e4);
      });
    });
  });
}
function sanitizeProjectName(name) {
  return name.replace(/[<>:"/\\|?*]/g, "_").replace(/\s+/g, "_").trim().slice(0, 100) || "project";
}
async function startQueue(projectIds) {
  if (queueState) return;
  const projects = await getProjects();
  const toRun = projectIds.map((id) => projects.find((p) => p.id === id)).filter((p) => !!p && p.prompts.length > 0);
  if (toRun.length === 0) {
    broadcastToPanel$1({ type: MESSAGE_TYPES.QUEUE_DONE });
    return;
  }
  const tabId = await ensureGrokTab();
  queueState = {
    projectIds: toRun.map((p) => p.id),
    index: 0,
    paused: false,
    tabId
  };
  runNext();
}
function runNext() {
  if (!queueState) return;
  if (queueState.paused) return;
  if (queueState.index >= queueState.projectIds.length) {
    queueState = null;
    broadcastToPanel$1({ type: MESSAGE_TYPES.QUEUE_DONE });
    return;
  }
  const projectId = queueState.projectIds[queueState.index];
  getProjects().then((projects) => {
    const project = projects.find((p) => p.id === projectId);
    if (!project) {
      queueState.index++;
      runNext();
      return;
    }
    broadcastToPanel$1({
      type: MESSAGE_TYPES.PROJECT_STARTED,
      projectId,
      label: `Project: ${project.name} (${queueState.index + 1}/${queueState.projectIds.length})`
    });
    getGlobalSettings().then(async (globalSettings) => {
      const tabId = queueState.tabId;
      try {
        await ensureTabOnImagine(tabId);
        await new Promise((r) => setTimeout(r, PAGE_LOAD_DELAY_MS));
      } catch (navErr) {
        broadcastToPanel$1({
          type: MESSAGE_TYPES.ERROR,
          error: "Could not navigate to https://grok.com/imagine",
          projectId
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
          files: ["content.js"]
        });
      } catch (injectErr) {
        broadcastToPanel$1({
          type: MESSAGE_TYPES.ERROR,
          error: "Could not load automation script. Ensure the tab is on https://grok.com/imagine and try again.",
          projectId
        });
        if (queueState) {
          queueState.index++;
          runNext();
        }
        return;
      }
      chrome.tabs.sendMessage(tabId, {
        type: MESSAGE_TYPES.RUN_PROJECT,
        payload: { project, globalSettings }
      }).catch((err) => {
        broadcastToPanel$1({
          type: MESSAGE_TYPES.ERROR,
          error: err?.message ?? "Content script not ready",
          projectId
        });
        if (queueState) {
          queueState.index++;
          runNext();
        }
      });
    });
  });
}
function onProjectDoneFromContent(projectId) {
  broadcastToPanel$1({ type: MESSAGE_TYPES.PROJECT_DONE, projectId });
  if (queueState) {
    queueState.index++;
    runNext();
  }
}
function pauseQueue() {
  if (queueState) queueState.paused = true;
  broadcastToPanel$1({ type: MESSAGE_TYPES.QUEUE_PAUSED });
}
function resumeQueue() {
  if (queueState) {
    queueState.paused = false;
    runNext();
  }
}
function terminateQueue() {
  if (queueState) {
    queueState = null;
    broadcastToPanel$1({ type: MESSAGE_TYPES.QUEUE_DONE });
  }
}
function handleProjectProgress(label) {
  broadcastToPanel$1({ type: MESSAGE_TYPES.PROJECT_PROGRESS, label });
}
function handleContentError(error, projectId) {
  broadcastToPanel$1({ type: MESSAGE_TYPES.ERROR, error, projectId });
  if (queueState && projectId) {
    queueState.index++;
    runNext();
  }
}

async function handleDownloadRequest(req) {
  const settings = await getGlobalSettings();
  const prefix = settings.downloadFolderPrefix?.trim() || "GrokAutomation";
  const safeName = sanitizeProjectName(req.projectName);
  const folder = `${prefix}/${safeName}`;
  const timestamp = Date.now();
  const ext = req.isVideo ? "mp4" : "png";
  const filename = `${folder}/${safeName}_${timestamp}_${req.promptIndex}.${ext}`;
  chrome.downloads.download({
    url: req.url,
    filename,
    saveAs: false,
    conflictAction: "overwrite"
  });
}

function broadcastToPanel(message) {
  chrome.runtime.sendMessage(message).catch(() => {
  });
}
chrome.runtime.onInstalled.addListener(() => {
  console.log("Grok Automation extension installed");
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {
  });
});
chrome.runtime.onMessage.addListener(
  (message, sender, sendResponse) => {
    if (sender.tab) return false;
    const handle = async () => {
      switch (message.type) {
        case MESSAGE_TYPES.GET_PROJECTS: {
          const projects = await getProjects();
          const queueOrder = await getQueueOrder();
          return { projects, queueOrder };
        }
        case MESSAGE_TYPES.SAVE_PROJECT: {
          const project = message.payload;
          await saveProject(project);
          const projects = await getProjects();
          broadcastToPanel({ type: MESSAGE_TYPES.PROJECTS_UPDATED, projects });
          return { ok: true };
        }
        case MESSAGE_TYPES.DELETE_PROJECT: {
          const id = message.payload;
          await deleteProject(id);
          const projects = await getProjects();
          broadcastToPanel({ type: MESSAGE_TYPES.PROJECTS_UPDATED, projects });
          return { ok: true };
        }
        case MESSAGE_TYPES.GET_GLOBAL_SETTINGS: {
          return await getGlobalSettings();
        }
        case MESSAGE_TYPES.SAVE_GLOBAL_SETTINGS: {
          const settings = message.payload;
          await saveGlobalSettings(settings);
          return { ok: true };
        }
        case MESSAGE_TYPES.SET_QUEUE_ORDER: {
          const projectIds = message.payload;
          await setQueueOrder(projectIds);
          return { ok: true };
        }
        case MESSAGE_TYPES.GET_TAB_STATUS: {
          const tabs = await chrome.tabs.query({ url: `${GROK_IMAGINE_URL}*` });
          const grokTab = tabs.find((t) => t.url?.startsWith(GROK_IMAGINE_URL));
          return {
            hasGrokTab: !!grokTab,
            tabId: grokTab?.id,
            url: grokTab?.url
          };
        }
        case MESSAGE_TYPES.START_QUEUE: {
          const payload = message.payload;
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
    return true;
  }
);
chrome.runtime.onMessage.addListener(
  (message, sender, sendResponse) => {
    if (!sender.tab) return false;
    if (message.type === MESSAGE_TYPES.REQUEST_NAVIGATE_TO_IMAGINE) {
      const tabId = sender.tab.id;
      const payload = message.payload;
      if (tabId == null || !payload?.project || typeof payload.promptIndex !== "number") {
        sendResponse({ ok: false });
        return false;
      }
      (async () => {
        try {
          handleProjectProgress("Navigating to https://grok.com/imagine...");
          await ensureTabOnImagine(tabId);
          await new Promise((r) => setTimeout(r, PAGE_LOAD_DELAY_MS));
          await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
          chrome.tabs.sendMessage(tabId, {
            type: MESSAGE_TYPES.RUN_PROJECT,
            payload: {
              project: payload.project,
              globalSettings: payload.options,
              startFromPromptIndex: payload.promptIndex
            }
          });
          sendResponse({ ok: true });
        } catch (err) {
          handleContentError(err instanceof Error ? err.message : String(err), payload.project.id);
          sendResponse({ ok: false });
        }
      })();
      return true;
    }
    if (message.type === MESSAGE_TYPES.DOWNLOAD_REQUEST) {
      const req = message.payload;
      if (req?.url) {
        handleDownloadRequest(req).then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
        return true;
      }
      sendResponse({ ok: true });
      return false;
    }
    if (message.type === MESSAGE_TYPES.PROJECT_DONE) {
      const projectId = message.payload;
      if (projectId) {
        onProjectDoneFromContent(projectId);
        getProjects().then((projects) => {
          const p = projects.find((x) => x.id === projectId);
          if (p) {
            saveProject({ ...p, status: "completed", lastRunAt: Date.now() });
          }
        });
      }
      sendResponse({ ok: true });
      return false;
    }
    if (message.type === MESSAGE_TYPES.PROJECT_PROGRESS) {
      const label = message.payload;
      if (label) handleProjectProgress(label);
      sendResponse({ ok: true });
      return false;
    }
    if (message.type === MESSAGE_TYPES.ERROR) {
      const { error, projectId } = message.payload || {};
      handleContentError(error ?? "Unknown error", projectId);
      sendResponse({ ok: true });
      return false;
    }
    return false;
  }
);
chrome.downloads.onChanged.addListener((delta) => {
  if (delta.state?.current === "interrupted" && delta.error?.current === "USER_CANCELED") {
    chrome.downloads.search({ id: delta.id }).then((items) => {
      const item = items[0];
      if (item?.byExtensionId === chrome.runtime.id) {
        broadcastToPanel({
          type: MESSAGE_TYPES.DOWNLOAD_SAVE_AS_TIP,
          message: 'Turn off "Ask where to save each file" in Chrome → Settings → Downloads so files save automatically.'
        });
      }
    });
  }
});
//# sourceMappingURL=background.js.map
