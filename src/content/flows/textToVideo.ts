import { findByXPath, clickElement, setInputValue, getMediaUrlFromPage, waitForGeneratingThen100Percent, waitForImaginePageReady } from '../xpath';
import { findPromptInput, findGenerateButton } from '../xpath';
import { SELECTORS, FALLBACKS } from '../selectors';
import { MESSAGE_TYPES } from '../messages';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function reportProgress(label: string): void {
  chrome.runtime.sendMessage({ type: MESSAGE_TYPES.PROJECT_PROGRESS, payload: label }).catch(() => {});
}

function reportError(err: string): void {
  chrome.runtime.sendMessage({ type: MESSAGE_TYPES.ERROR, payload: { error: err } }).catch(() => {});
}

function requestDownload(url: string, projectName: string, promptIndex: number): void {
  chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.DOWNLOAD_REQUEST,
    payload: { url, projectName, promptIndex, isVideo: true },
  }).catch(() => {});
}

function clickVideoMode(): boolean {
  let el = findByXPath(SELECTORS.VIDEO_MODE);
  if (!el) el = FALLBACKS.videoMode();
  if (!el) return false;
  clickElement(el);
  return true;
}

function selectAspectRatio(ratio: string): boolean {
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

function selectVideoQuality(quality: string): boolean {
  const is720 = quality === '720p';
  const el = findByXPath(is720 ? SELECTORS.VIDEO_720P : SELECTORS.VIDEO_480P);
  if (el) {
    clickElement(el);
    return true;
  }
  return false;
}

function selectVideoLength(length: string): boolean {
  const is10 = length === '10';
  const el = findByXPath(is10 ? SELECTORS.VIDEO_10S : SELECTORS.VIDEO_6S);
  if (el) {
    clickElement(el);
    return true;
  }
  return false;
}

export async function runTextToVideo(
  project: {
    id: string;
    name: string;
    prompts: string[];
    settings: {
      aspectRatio: string;
      videoQuality: string;
      videoLength: string;
    };
  },
  options: { promptDelayMs: number; renderTimeoutMs: number; maxRetries: number },
  startFromPromptIndex = 0
): Promise<void> {
  const { prompts, settings, name } = project;
  const { promptDelayMs, renderTimeoutMs, maxRetries } = options;

  const imagineBase = 'https://grok.com/imagine';
  const isOnImaginePage = (): boolean => {
    const href = window.location.href;
    return href === imagineBase || href.startsWith(imagineBase + '?');
  };
  for (let i = startFromPromptIndex; i < prompts.length; i++) {
    reportProgress(`[${i + 1}/${prompts.length}] Checking URL...`);
    if (!isOnImaginePage()) {
      reportProgress(`[${i + 1}/${prompts.length}] URL is not base Imagine. Requesting navigation to ${imagineBase}...`);
      chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.REQUEST_NAVIGATE_TO_IMAGINE,
        payload: { project, promptIndex: i, options: { promptDelayMs, renderTimeoutMs, maxRetries } },
      }).catch(() => {});
      return;
    }
    reportProgress(`[${i + 1}/${prompts.length}] Ensuring page ready...`);
    try {
      await waitForImaginePageReady(i === startFromPromptIndex ? 20000 : 10000);
      await delay(1000);
    } catch {
      reportError(`Page not ready before prompt ${i + 1}`);
      return;
    }

    reportProgress(`[${i + 1}/${prompts.length}] Selecting Video mode...`);
    if (!clickVideoMode()) {
      const listItem = findByXPath(SELECTORS.LIST_ITEM_NEXT_PROMPT);
      if (listItem) {
        clickElement(listItem);
        await delay(1000);
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
      let genBtn = findByXPath(SELECTORS.SUBMIT_BUTTON) as HTMLElement | null;
      if (!genBtn) genBtn = findGenerateButton();
      if (!genBtn) {
        reportError(`Could not find Generate button (attempt ${attempt}/${maxRetries})`);
        if (attempt === maxRetries) continue;
        await delay(3000);
        continue;
      }
      reportProgress(`[${i + 1}/${prompts.length}] Clicking Submit...`);
      clickElement(genBtn);
      await delay(1000);

      try {
        await waitForGeneratingThen100Percent(renderTimeoutMs, reportProgress);
      } catch {
        reportError(`Generating did not reach 100% in time (attempt ${attempt}/${maxRetries})`);
        if (attempt < maxRetries) await delay(5000);
        continue;
      }
      reportProgress(`[${i + 1}/${prompts.length}] Reached 100%. Waiting 2 seconds...`);
      await delay(2000);

      reportProgress(`[${i + 1}/${prompts.length}] Getting video URL (no system dialog)...`);
      let url = getMediaUrlFromPage(true);
      if (!url) {
        await delay(1500);
        url = getMediaUrlFromPage(true);
      }
      if (!url) {
        await delay(1500);
        url = getMediaUrlFromPage(true);
      }
      if (url && url.startsWith('http')) {
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
      if (!done && attempt < maxRetries) await delay(5000);
    }
    await delay(promptDelayMs);
  }

  chrome.runtime.sendMessage({ type: MESSAGE_TYPES.PROJECT_DONE, payload: project.id }).catch(() => {});
}
