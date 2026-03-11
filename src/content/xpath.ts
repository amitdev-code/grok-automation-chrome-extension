/**
 * Resolve XPath to a single element. Returns null if not found.
 */
export function findByXPath(xpath: string, root: Document | Element = document): Element | null {
  const doc = root instanceof Document ? root : root.ownerDocument;
  const result = doc.evaluate(
    xpath,
    root,
    null,
    XPathResult.FIRST_ORDERED_NODE_TYPE,
    null
  );
  return result.singleNodeValue as Element | null;
}

/**
 * Wait for an element matching XPath to appear, with timeout.
 */
export function waitForXPath(
  xpath: string,
  timeoutMs: number,
  root: Document | Element = document
): Promise<Element> {
  return new Promise((resolve, reject) => {
    const existing = findByXPath(xpath, root);
    if (existing) {
      resolve(existing);
      return;
    }
    const deadline = Date.now() + timeoutMs;
    const check = (): void => {
      if (Date.now() > deadline) {
        reject(new Error(`Timeout waiting for XPath: ${xpath}`));
        return;
      }
      const el = findByXPath(xpath, root);
      if (el) {
        resolve(el);
        return;
      }
      requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  });
}

/**
 * Wait for an element to disappear (not in DOM or not visible). Polls every 2s.
 */
export function waitForElementToDisappear(
  xpath: string,
  timeoutMs: number,
  root: Document | Element = document
): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const check = (): void => {
      if (Date.now() > deadline) {
        reject(new Error(`Timeout waiting for element to disappear: ${xpath}`));
        return;
      }
      const el = findByXPath(xpath, root);
      const gone = !el || (el as HTMLElement).offsetParent === null;
      if (gone) {
        resolve();
        return;
      }
      setTimeout(check, 2000);
    };
    check();
  });
}

/**
 * Click an element (with optional scroll into view).
 */
export function clickElement(el: Element, scrollIntoView = true): void {
  if (scrollIntoView) el.scrollIntoView({ block: 'center' });
  (el as HTMLElement).click();
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Try to find the download button with retries (DOM may update shortly after 100%).
 */
export async function findDownloadButtonWithRetry(
  getButton: () => Element | null,
  options: { maxAttempts?: number; delayMs?: number; onProgress?: (msg: string) => void } = {}
): Promise<Element | null> {
  const { maxAttempts = 3, delayMs = 1000, onProgress } = options;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    onProgress?.(`Looking for download button (attempt ${attempt}/${maxAttempts})...`);
    const btn = getButton();
    if (btn) {
      onProgress?.('Download button found.');
      return btn;
    }
    if (attempt < maxAttempts) await delay(delayMs);
  }
  onProgress?.('Download button not found after all attempts.');
  return null;
}

/**
 * Set value on input/textarea or contenteditable element. Dispatches events for React.
 */
export function setInputValue(
  el: HTMLInputElement | HTMLTextAreaElement | HTMLElement,
  value: string
): void {
  el.focus();
  const input = el as HTMLInputElement | HTMLTextAreaElement;
  if (typeof input.value !== 'undefined') {
    input.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    (el as HTMLElement).textContent = value;
    el.dispatchEvent(new InputEvent('input', { bubbles: true, data: value, inputType: 'insertText' }));
  }
}

/**
 * Find prompt input - tries XPath first (Grok contenteditable p), then textarea/input.
 */
export function findPromptInput(
  promptInputXPath: string
): HTMLInputElement | HTMLTextAreaElement | HTMLElement | null {
  const byXPath = findByXPath(promptInputXPath);
  if (byXPath && (byXPath instanceof HTMLElement || byXPath instanceof HTMLInputElement || byXPath instanceof HTMLTextAreaElement)) {
    return byXPath as HTMLElement;
  }
  const textareas = document.querySelectorAll('textarea');
  for (let i = 0; i < textareas.length; i++) {
    const t = textareas[i] as HTMLTextAreaElement;
    const ph = t.placeholder?.toLowerCase() ?? '';
    if (ph.includes('prompt') || ph.includes('describe') || ph.includes('imagine')) {
      return t;
    }
  }
  if (textareas.length > 0) return textareas[0] as HTMLTextAreaElement;
  const inputs = document.querySelectorAll('input[type="text"]');
  for (let i = 0; i < inputs.length; i++) {
    const inp = inputs[i] as HTMLInputElement;
    if (inp.placeholder?.toLowerCase().includes('prompt') || inp.placeholder?.toLowerCase().includes('describe')) {
      return inp;
    }
  }
  return null;
}

/**
 * Wait for the Imagine page to be fully loaded (form and main controls visible)
 * before performing any actions. Polls until prompt input or Image/Video mode
 * buttons are present and visible.
 */
export function waitForImaginePageReady(timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const isVisible = (el: Element | null): boolean =>
      !!el && (el as HTMLElement).offsetParent !== null;
    const check = (): void => {
      if (Date.now() > deadline) {
        reject(new Error('Timeout waiting for Imagine page to be ready'));
        return;
      }
      const form = document.querySelector('form');
      if (form) {
        const input = form.querySelector('textarea, [contenteditable="true"], p');
        if (input && isVisible(input)) {
          resolve();
          return;
        }
      }
      const buttons = document.querySelectorAll('button');
      const imageBtn = Array.from(buttons).find((b) => b.textContent?.trim() === 'Image');
      const videoBtn = Array.from(buttons).find((b) => b.textContent?.trim() === 'Video');
      if (imageBtn && videoBtn && isVisible(imageBtn)) {
        resolve();
        return;
      }
      setTimeout(check, 500);
    };
    check();
  });
}

const STUCK_THRESHOLD_MS = 5000;

function isGeneratingTextPresent(): boolean {
  const all = document.body.getElementsByTagName('*');
  for (let i = 0; i < all.length; i++) {
    if (all[i].textContent?.trim() === 'Generating') return true;
  }
  return false;
}

/**
 * Wait for "Generating" text to be visible, then poll until percentage shows 100%.
 * Bypass: if we've seen a percent (processing started) and the same value persists
 * for >5s, check if "Generating" is still in the DOM; if not, consider completed.
 * Grok UI: <div class="..."><span>Generating</span><span>34%</span></div>
 */
export function waitForGeneratingThen100Percent(
  timeoutMs: number,
  onProgress?: (msg: string) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    let reportedGenerating = false;
    let lastSeenPercent: string | null = null;
    let lastSeenPercentTime = 0;
    const findPercentSpan = (): Element | null => {
      const all = document.body.getElementsByTagName('*');
      for (let i = 0; i < all.length; i++) {
        const el = all[i];
        if (el.textContent?.trim() !== 'Generating') continue;
        const container = el.parentElement;
        if (!container) continue;
        const spans = container.querySelectorAll('span');
        for (let j = 0; j < spans.length; j++) {
          const t = spans[j].textContent?.trim() ?? '';
          if (/^\d+%$/.test(t)) return spans[j];
        }
      }
      return null;
    };
    const check = (): void => {
      if (Date.now() > deadline) {
        reject(new Error('Timeout waiting for Generating to reach 100%'));
        return;
      }
      const percentSpan = findPercentSpan();
      if (percentSpan) {
        const pct = percentSpan.textContent?.trim() ?? '';
        if (!reportedGenerating) {
          reportedGenerating = true;
          onProgress?.('Generating visible, waiting for 100%...');
        }
        onProgress?.(`Generating ${pct}`);
        if (pct === '100%') {
          onProgress?.('Reached 100%.');
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
    const waitForGenerating = (): void => {
      if (Date.now() > deadline) {
        reject(new Error('Timeout waiting for Generating to appear'));
        return;
      }
      if (findPercentSpan() !== null) {
        reportedGenerating = true;
        onProgress?.('Generating visible, waiting for 100%...');
        lastSeenPercentTime = Date.now();
        setTimeout(check, 1500);
        return;
      }
      setTimeout(waitForGenerating, 1000);
    };
    onProgress?.('Waiting for Generating to appear...');
    waitForGenerating();
  });
}

/**
 * Find submit/generate button (e.g. "Generate", "Create", or primary button in form).
 */
export function findGenerateButton(): HTMLElement | null {
  const buttons = document.querySelectorAll('button');
  for (let i = 0; i < buttons.length; i++) {
    const b = buttons[i];
    const text = b.textContent?.toLowerCase().trim() ?? '';
    if (text.includes('generate') || text.includes('create') || text === 'imagine') {
      return b;
    }
  }
  return null;
}

/**
 * Get video or image URL from the result area. Tries multiple selectors.
 * Returns the first valid http(s) or blob URL found (blob may not work from background).
 */
export function getMediaUrlFromPage(isVideo: boolean): string | null {
  if (isVideo) {
    const video = document.querySelector('video');
    if (video) {
      const src = video.src || video.getAttribute('src');
      if (src && (src.startsWith('http') || src.startsWith('blob:'))) return src;
      const source = video.querySelector('source');
      const sourceSrc = source?.getAttribute('src') || (source as HTMLSourceElement)?.src;
      if (sourceSrc && (sourceSrc.startsWith('http') || sourceSrc.startsWith('blob:'))) return sourceSrc;
    }
    const sourceEl = document.querySelector('video source[src]');
    const s = (sourceEl as HTMLSourceElement)?.src || sourceEl?.getAttribute('src');
    if (s && (s.startsWith('http') || s.startsWith('blob:'))) return s;
    const links = document.querySelectorAll('a[href*=".mp4"], a[href*="video"], a[download]');
    for (let i = 0; i < links.length; i++) {
      const href = (links[i] as HTMLAnchorElement).href;
      if (href && (href.includes('.mp4') || href.includes('video') || (links[i] as HTMLAnchorElement).download)) return href;
    }
  } else {
    const img = document.querySelector('main article img[src*="http"]') || document.querySelector('img[src*="http"]');
    const src = img?.getAttribute('src');
    if (src) return src;
  }
  return null;
}
