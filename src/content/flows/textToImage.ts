import { findByXPath, clickElement, setInputValue, waitForGeneratingThen100Percent } from '../xpath';
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
    payload: { url, projectName, promptIndex, isVideo: false },
  }).catch(() => {});
}

function clickImageMode(): boolean {
  let el = findByXPath(SELECTORS.IMAGE_MODE);
  if (!el) el = FALLBACKS.imageMode();
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

export async function runTextToImage(
  project: {
    id: string;
    name: string;
    prompts: string[];
    settings: { aspectRatio: string };
  },
  options: { promptDelayMs: number; renderTimeoutMs: number; maxRetries: number }
): Promise<void> {
  const { prompts, settings, name } = project;
  const { promptDelayMs, renderTimeoutMs, maxRetries } = options;

  reportProgress('Selecting Image mode...');
  if (!clickImageMode()) {
    reportError('Could not select Image mode');
    return;
  }
  await delay(500);
  reportProgress(`Setting aspect ratio to ${settings.aspectRatio}...`);
  selectAspectRatio(settings.aspectRatio);
  await delay(300);

  reportProgress('Finding prompt input...');
  const promptInput = findPromptInput(SELECTORS.PROMPT_INPUT);
  if (!promptInput) {
    reportError('Could not find prompt input');
    return;
  }

  for (let i = 0; i < prompts.length; i++) {
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

      reportProgress(`[${i + 1}/${prompts.length}] Getting image URL (no system dialog)...`);
      const img = document.querySelector('main article img[src*="http"]');
      const url = img?.getAttribute('src');
      if (url && url.startsWith('http')) {
        reportProgress(`[${i + 1}/${prompts.length}] Saving to folder (bypassing Save As)...`);
        requestDownload(url, name, i);
        done = true;
        await delay(500);
        reportProgress(`[${i + 1}/${prompts.length}] Clicking next prompt (list item)...`);
        const listItem = findByXPath(SELECTORS.LIST_ITEM_NEXT_PROMPT);
        if (listItem) clickElement(listItem);
      } else {
        reportError(`Could not get image URL (attempt ${attempt}/${maxRetries})`);
      }
      if (!done && attempt < maxRetries) await delay(5000);
    }
    await delay(promptDelayMs);
  }

  chrome.runtime.sendMessage({ type: MESSAGE_TYPES.PROJECT_DONE, payload: project.id }).catch(() => {});
}
