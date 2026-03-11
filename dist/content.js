const MESSAGE_TYPES = {
  RUN_PROJECT: "RUN_PROJECT",
  PROJECT_DONE: "PROJECT_DONE",
  PROJECT_PROGRESS: "PROJECT_PROGRESS",
  ERROR: "ERROR",
  DOWNLOAD_REQUEST: "DOWNLOAD_REQUEST",
  REQUEST_NAVIGATE_TO_IMAGINE: "REQUEST_NAVIGATE_TO_IMAGINE"
};

function findByXPath(xpath, root = document) {
  const doc = root instanceof Document ? root : root.ownerDocument;
  const result = doc.evaluate(
    xpath,
    root,
    null,
    XPathResult.FIRST_ORDERED_NODE_TYPE,
    null
  );
  return result.singleNodeValue;
}
function clickElement(el, scrollIntoView = true) {
  if (scrollIntoView) el.scrollIntoView({ block: "center" });
  el.click();
}
function setInputValue(el, value) {
  el.focus();
  const input = el;
  if (typeof input.value !== "undefined") {
    input.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  } else {
    el.textContent = value;
    el.dispatchEvent(new InputEvent("input", { bubbles: true, data: value, inputType: "insertText" }));
  }
}
function findPromptInput(promptInputXPath) {
  const byXPath = findByXPath(promptInputXPath);
  if (byXPath && (byXPath instanceof HTMLElement || byXPath instanceof HTMLInputElement || byXPath instanceof HTMLTextAreaElement)) {
    return byXPath;
  }
  const textareas = document.querySelectorAll("textarea");
  for (let i = 0; i < textareas.length; i++) {
    const t = textareas[i];
    const ph = t.placeholder?.toLowerCase() ?? "";
    if (ph.includes("prompt") || ph.includes("describe") || ph.includes("imagine")) {
      return t;
    }
  }
  if (textareas.length > 0) return textareas[0];
  const inputs = document.querySelectorAll('input[type="text"]');
  for (let i = 0; i < inputs.length; i++) {
    const inp = inputs[i];
    if (inp.placeholder?.toLowerCase().includes("prompt") || inp.placeholder?.toLowerCase().includes("describe")) {
      return inp;
    }
  }
  return null;
}
function waitForImaginePageReady(timeoutMs) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const isVisible = (el) => !!el && el.offsetParent !== null;
    const check = () => {
      if (Date.now() > deadline) {
        reject(new Error("Timeout waiting for Imagine page to be ready"));
        return;
      }
      const form = document.querySelector("form");
      if (form) {
        const input = form.querySelector('textarea, [contenteditable="true"], p');
        if (input && isVisible(input)) {
          resolve();
          return;
        }
      }
      const buttons = document.querySelectorAll("button");
      const imageBtn = Array.from(buttons).find((b) => b.textContent?.trim() === "Image");
      const videoBtn = Array.from(buttons).find((b) => b.textContent?.trim() === "Video");
      if (imageBtn && videoBtn && isVisible(imageBtn)) {
        resolve();
        return;
      }
      setTimeout(check, 500);
    };
    check();
  });
}
const STUCK_THRESHOLD_MS = 5e3;
function isGeneratingTextPresent() {
  const all = document.body.getElementsByTagName("*");
  for (let i = 0; i < all.length; i++) {
    if (all[i].textContent?.trim() === "Generating") return true;
  }
  return false;
}
function waitForGeneratingThen100Percent(timeoutMs, onProgress) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    let reportedGenerating = false;
    let lastSeenPercent = null;
    let lastSeenPercentTime = 0;
    const findPercentSpan = () => {
      const all = document.body.getElementsByTagName("*");
      for (let i = 0; i < all.length; i++) {
        const el = all[i];
        if (el.textContent?.trim() !== "Generating") continue;
        const container = el.parentElement;
        if (!container) continue;
        const spans = container.querySelectorAll("span");
        for (let j = 0; j < spans.length; j++) {
          const t = spans[j].textContent?.trim() ?? "";
          if (/^\d+%$/.test(t)) return spans[j];
        }
      }
      return null;
    };
    const check = () => {
      if (Date.now() > deadline) {
        reject(new Error("Timeout waiting for Generating to reach 100%"));
        return;
      }
      const percentSpan = findPercentSpan();
      if (percentSpan) {
        const pct = percentSpan.textContent?.trim() ?? "";
        if (!reportedGenerating) {
          reportedGenerating = true;
          onProgress?.("Generating visible, waiting for 100%...");
        }
        onProgress?.(`Generating ${pct}`);
        if (pct === "100%") {
          onProgress?.("Reached 100%.");
          resolve();
          return;
        }
        const now = Date.now();
        if (pct !== lastSeenPercent) {
          lastSeenPercent = pct;
          lastSeenPercentTime = now;
        } else if (now - lastSeenPercentTime >= STUCK_THRESHOLD_MS) {
          if (!isGeneratingTextPresent()) {
            onProgress?.(`Stuck at ${pct} for 5s and "Generating" gone — considering completed (bypass).`);
            resolve();
            return;
          }
        }
      } else {
        if (reportedGenerating && !isGeneratingTextPresent()) {
          onProgress?.('"Generating" no longer present — considering completed (bypass).');
          resolve();
          return;
        }
      }
      setTimeout(check, 1500);
    };
    const waitForGenerating = () => {
      if (Date.now() > deadline) {
        reject(new Error("Timeout waiting for Generating to appear"));
        return;
      }
      if (findPercentSpan() !== null) {
        reportedGenerating = true;
        onProgress?.("Generating visible, waiting for 100%...");
        lastSeenPercentTime = Date.now();
        setTimeout(check, 1500);
        return;
      }
      setTimeout(waitForGenerating, 1e3);
    };
    onProgress?.("Waiting for Generating to appear...");
    waitForGenerating();
  });
}
function findGenerateButton() {
  const buttons = document.querySelectorAll("button");
  for (let i = 0; i < buttons.length; i++) {
    const b = buttons[i];
    const text = b.textContent?.toLowerCase().trim() ?? "";
    if (text.includes("generate") || text.includes("create") || text === "imagine") {
      return b;
    }
  }
  return null;
}
function getMediaUrlFromPage(isVideo) {
  {
    const video = document.querySelector("video");
    if (video) {
      const src = video.src || video.getAttribute("src");
      if (src && (src.startsWith("http") || src.startsWith("blob:"))) return src;
      const source = video.querySelector("source");
      const sourceSrc = source?.getAttribute("src") || source?.src;
      if (sourceSrc && (sourceSrc.startsWith("http") || sourceSrc.startsWith("blob:"))) return sourceSrc;
    }
    const sourceEl = document.querySelector("video source[src]");
    const s = sourceEl?.src || sourceEl?.getAttribute("src");
    if (s && (s.startsWith("http") || s.startsWith("blob:"))) return s;
    const links = document.querySelectorAll('a[href*=".mp4"], a[href*="video"], a[download]');
    for (let i = 0; i < links.length; i++) {
      const href = links[i].href;
      if (href && (href.includes(".mp4") || href.includes("video") || links[i].download)) return href;
    }
  }
  return null;
}

const SELECTORS = {
  // Mode: Video (we only use Video)
  VIDEO_MODE: "/html/body/div[2]/div/div[2]/div/div/div/div[2]/div/form/div/div/div/div[3]/div[1]/div/button[2]",
  // Aspect ratio dropdown (Radix - IDs can change)
  ASPECT_RATIO_DROPDOWN: '//*[@id="radix-_r_7o_"]',
  ASPECT_RATIO_OPTIONS: '//*[@id="radix-_r_7p_"]/div[1]',
  // Video quality
  VIDEO_480P: "/html/body/div[2]/div/div[2]/div/div/div/div[2]/div/form/div/div/div/div[3]/div[3]/div/button[1]",
  VIDEO_720P: "/html/body/div[2]/div/div[2]/div/div/div/div[2]/div/form/div/div/div/div[3]/div[3]/div/button[2]",
  // Video length
  VIDEO_6S: "/html/body/div[2]/div/div[2]/div/div/div/div[2]/div/form/div/div/div/div[3]/div[4]/div/button[1]",
  VIDEO_10S: "/html/body/div[2]/div/div[2]/div/div/div/div[2]/div/form/div/div/div/div[3]/div[4]/div/button[2]",
  // Prompt input (contenteditable p or similar)
  PROMPT_INPUT: "/html/body/div[2]/div/div[2]/div/div/div/div[2]/div/form/div/div/div/div[1]/div[2]/div/div/div/div/p",
  // Submit / Generate button
  SUBMIT_BUTTON: "/html/body/div[2]/div/div[2]/div/div/div/div[2]/div/form/div/div/div/div[2]/div/button",
  // List item to click after download to return and run next prompt
  LIST_ITEM_NEXT_PROMPT: "/html/body/div[2]/div/div[1]/div/div[1]/div[2]/div[4]/ul/li"};
const FALLBACKS = {
  videoMode: () => findByText("button", "Video"),
  aspectRatioOption: (ratio) => findByText("div", ratio),
  /** Download button by aria-label (stable when DOM structure changes). */
  downloadButton: () => document.querySelector('main article button[aria-label="Download"]') ?? document.querySelector('button[aria-label="Download"]')
};
function findByText(tag, text) {
  const nodes = document.getElementsByTagName(tag);
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].textContent?.trim() === text) return nodes[i];
  }
  return null;
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));
function reportProgress(label) {
  chrome.runtime.sendMessage({ type: MESSAGE_TYPES.PROJECT_PROGRESS, payload: label }).catch(() => {
  });
}
function reportError(err) {
  chrome.runtime.sendMessage({ type: MESSAGE_TYPES.ERROR, payload: { error: err } }).catch(() => {
  });
}
function requestDownload(url, projectName, promptIndex) {
  chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.DOWNLOAD_REQUEST,
    payload: { url, projectName, promptIndex, isVideo: true }
  }).catch(() => {
  });
}
function clickVideoMode() {
  let el = findByXPath(SELECTORS.VIDEO_MODE);
  if (!el) el = FALLBACKS.videoMode();
  if (!el) return false;
  clickElement(el);
  return true;
}
function selectAspectRatio(ratio) {
  const dropdown = findByXPath(SELECTORS.ASPECT_RATIO_DROPDOWN);
  if (dropdown) clickElement(dropdown);
  delay(300);
  const optionsContainer = findByXPath(SELECTORS.ASPECT_RATIO_OPTIONS);
  if (optionsContainer) {
    const options = optionsContainer.querySelectorAll('[role="option"], div');
    for (let i = 0; i < options.length; i++) {
      if (options[i].textContent?.trim() === ratio) {
        clickElement(options[i]);
        return true;
      }
    }
  }
  const byText = FALLBACKS.aspectRatioOption(ratio);
  if (byText) {
    clickElement(byText);
    return true;
  }
  return false;
}
function selectVideoQuality(quality) {
  const is720 = quality === "720p";
  const el = findByXPath(is720 ? SELECTORS.VIDEO_720P : SELECTORS.VIDEO_480P);
  if (el) {
    clickElement(el);
    return true;
  }
  return false;
}
function selectVideoLength(length) {
  const is10 = length === "10";
  const el = findByXPath(is10 ? SELECTORS.VIDEO_10S : SELECTORS.VIDEO_6S);
  if (el) {
    clickElement(el);
    return true;
  }
  return false;
}
async function runTextToVideo(project, options, startFromPromptIndex = 0) {
  const { prompts, settings, name } = project;
  const { promptDelayMs, renderTimeoutMs, maxRetries } = options;
  const imagineBase = "https://grok.com/imagine";
  const isOnImaginePage = () => {
    const href = window.location.href;
    return href === imagineBase || href.startsWith(imagineBase + "?");
  };
  for (let i = startFromPromptIndex; i < prompts.length; i++) {
    reportProgress(`[${i + 1}/${prompts.length}] Checking URL...`);
    if (!isOnImaginePage()) {
      reportProgress(`[${i + 1}/${prompts.length}] URL is not base Imagine. Requesting navigation to ${imagineBase}...`);
      chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.REQUEST_NAVIGATE_TO_IMAGINE,
        payload: { project, promptIndex: i, options: { promptDelayMs, renderTimeoutMs, maxRetries } }
      }).catch(() => {
      });
      return;
    }
    reportProgress(`[${i + 1}/${prompts.length}] Ensuring page ready...`);
    try {
      await waitForImaginePageReady(i === startFromPromptIndex ? 2e4 : 1e4);
      await delay(1e3);
    } catch {
      reportError(`Page not ready before prompt ${i + 1}`);
      return;
    }
    reportProgress(`[${i + 1}/${prompts.length}] Selecting Video mode...`);
    if (!clickVideoMode()) {
      const listItem = findByXPath(SELECTORS.LIST_ITEM_NEXT_PROMPT);
      if (listItem) {
        clickElement(listItem);
        await delay(1e3);
      }
      if (!clickVideoMode()) {
        reportError(`Could not select Video mode (prompt ${i + 1})`);
        return;
      }
    }
    await delay(500);
    reportProgress(`[${i + 1}/${prompts.length}] Setting aspect ratio to ${settings.aspectRatio}...`);
    selectAspectRatio(settings.aspectRatio);
    await delay(300);
    reportProgress(`[${i + 1}/${prompts.length}] Setting video quality to ${settings.videoQuality}...`);
    selectVideoQuality(settings.videoQuality);
    await delay(200);
    reportProgress(`[${i + 1}/${prompts.length}] Setting video length to ${settings.videoLength}s...`);
    selectVideoLength(settings.videoLength);
    await delay(300);
    reportProgress(`[${i + 1}/${prompts.length}] Finding prompt input...`);
    const promptInput = findPromptInput(SELECTORS.PROMPT_INPUT);
    if (!promptInput) {
      reportError(`Could not find prompt input (prompt ${i + 1})`);
      return;
    }
    reportProgress(`[${i + 1}/${prompts.length}] Entering prompt...`);
    setInputValue(promptInput, prompts[i]);
    await delay(400);
    let done = false;
    for (let attempt = 1; attempt <= maxRetries && !done; attempt++) {
      reportProgress(`[${i + 1}/${prompts.length}] Finding Submit button (attempt ${attempt}/${maxRetries})...`);
      let genBtn = findByXPath(SELECTORS.SUBMIT_BUTTON);
      if (!genBtn) genBtn = findGenerateButton();
      if (!genBtn) {
        reportError(`Could not find Generate button (attempt ${attempt}/${maxRetries})`);
        if (attempt === maxRetries) continue;
        await delay(3e3);
        continue;
      }
      reportProgress(`[${i + 1}/${prompts.length}] Clicking Submit...`);
      clickElement(genBtn);
      await delay(1e3);
      try {
        await waitForGeneratingThen100Percent(renderTimeoutMs, reportProgress);
      } catch {
        reportError(`Generating did not reach 100% in time (attempt ${attempt}/${maxRetries})`);
        if (attempt < maxRetries) await delay(5e3);
        continue;
      }
      reportProgress(`[${i + 1}/${prompts.length}] Reached 100%. Waiting 2 seconds...`);
      await delay(2e3);
      reportProgress(`[${i + 1}/${prompts.length}] Getting video URL (no system dialog)...`);
      let url = getMediaUrlFromPage();
      if (!url) {
        await delay(1500);
        url = getMediaUrlFromPage();
      }
      if (!url) {
        await delay(1500);
        url = getMediaUrlFromPage();
      }
      if (url && url.startsWith("http")) {
        reportProgress(`[${i + 1}/${prompts.length}] Saving to folder (bypassing Save As)...`);
        requestDownload(url, name, i);
        done = true;
        await delay(500);
        reportProgress(`[${i + 1}/${prompts.length}] Clicking next prompt (list item)...`);
        const listItem = findByXPath(SELECTORS.LIST_ITEM_NEXT_PROMPT);
        if (listItem) clickElement(listItem);
      } else {
        reportError(`Could not get video URL (attempt ${attempt}/${maxRetries})`);
      }
      if (!done && attempt < maxRetries) await delay(5e3);
    }
    await delay(promptDelayMs);
  }
  chrome.runtime.sendMessage({ type: MESSAGE_TYPES.PROJECT_DONE, payload: project.id }).catch(() => {
  });
}

const DEFAULT_OPTIONS = {
  promptDelayMs: 2e3,
  renderTimeoutMs: 3e5,
  maxRetries: 5
};
chrome.runtime.onMessage.addListener(
  (message, _sender, sendResponse) => {
    if (message.type !== MESSAGE_TYPES.RUN_PROJECT || !message.payload?.project) {
      return false;
    }
    const { project, globalSettings, startFromPromptIndex } = message.payload;
    const options = {
      promptDelayMs: globalSettings?.promptDelayMs ?? DEFAULT_OPTIONS.promptDelayMs,
      renderTimeoutMs: globalSettings?.renderTimeoutMs ?? DEFAULT_OPTIONS.renderTimeoutMs,
      maxRetries: globalSettings?.maxRetries ?? DEFAULT_OPTIONS.maxRetries
    };
    const reportProgress = (label) => {
      chrome.runtime.sendMessage({ type: MESSAGE_TYPES.PROJECT_PROGRESS, payload: label }).catch(() => {
      });
    };
    const run = async () => {
      try {
        reportProgress("Waiting for Imagine page to be ready...");
        await waitForImaginePageReady(2e4);
        reportProgress("Page ready. Waiting 1.5s for UI to settle...");
        await new Promise((r) => setTimeout(r, 1500));
        reportProgress(
          startFromPromptIndex != null ? `Resuming Video from prompt ${startFromPromptIndex + 1}...` : "Starting Video flow..."
        );
        await runTextToVideo(
          {
            ...project,
            settings: {
              aspectRatio: project.settings.aspectRatio ?? "16:9",
              videoQuality: project.settings.videoQuality ?? "720p",
              videoLength: project.settings.videoLength ?? "6"
            }
          },
          {
            promptDelayMs: options.promptDelayMs,
            renderTimeoutMs: options.renderTimeoutMs,
            maxRetries: options.maxRetries
          },
          startFromPromptIndex
        );
      } catch (err) {
        chrome.runtime.sendMessage({
          type: MESSAGE_TYPES.ERROR,
          payload: {
            error: err instanceof Error ? err.message : String(err),
            projectId: project.id
          }
        });
        chrome.runtime.sendMessage({ type: MESSAGE_TYPES.PROJECT_DONE, payload: project.id });
      }
    };
    run().then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
    return true;
  }
);
//# sourceMappingURL=content.js.map
