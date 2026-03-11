// XPaths for Grok Imagine UI - may need updates if Grok changes their DOM
// Fallbacks: try by button text or role where possible

export const SELECTORS = {
  // Mode buttons (Image = first, Video = second in the form area)
  IMAGE_MODE:
    '/html/body/div[2]/div/div[2]/div/div/div/div[2]/div/form/div/div/div/div[3]/div[1]/div/button[1]',
  VIDEO_MODE:
    '/html/body/div[2]/div/div[2]/div/div/div/div[2]/div/form/div/div/div/div[3]/div[1]/div/button[2]',
  // Aspect ratio dropdown (Radix - IDs can change)
  ASPECT_RATIO_DROPDOWN: '//*[@id="radix-_r_7o_"]',
  ASPECT_RATIO_OPTIONS: '//*[@id="radix-_r_7p_"]/div[1]',
  // Video quality
  VIDEO_480P:
    '/html/body/div[2]/div/div[2]/div/div/div/div[2]/div/form/div/div/div/div[3]/div[3]/div/button[1]',
  VIDEO_720P:
    '/html/body/div[2]/div/div[2]/div/div/div/div[2]/div/form/div/div/div/div[3]/div[3]/div/button[2]',
  // Video length
  VIDEO_6S:
    '/html/body/div[2]/div/div[2]/div/div/div/div[2]/div/form/div/div/div/div[3]/div[4]/div/button[1]',
  VIDEO_10S:
    '/html/body/div[2]/div/div[2]/div/div/div/div[2]/div/form/div/div/div/div[3]/div[4]/div/button[2]',
  // Prompt input (contenteditable p or similar)
  PROMPT_INPUT:
    '/html/body/div[2]/div/div[2]/div/div/div/div[2]/div/form/div/div/div/div[1]/div[2]/div/div/div/div/p',
  // Submit / Generate button
  SUBMIT_BUTTON:
    '/html/body/div[2]/div/div[2]/div/div/div/div[2]/div/form/div/div/div/div[2]/div/button',
  // Processing UI (visible while generating; we wait for it to disappear)
  PROCESSING_UI:
    '/html/body/div[2]/div/div[2]/div/div/div/div[1]/div/main/article/div/div[2]/div[1]/div[1]/div/div/div[2]/div',
  // Result / download (Partial Clips and Images)
  DOWNLOAD_BUTTON:
    '/html/body/div[2]/div/div[2]/div/div/div/div[1]/div/main/article/div/div[4]/div[2]/button[4]',
  // List item to click after download to return and run next prompt
  LIST_ITEM_NEXT_PROMPT:
    '/html/body/div[2]/div/div[1]/div/div[1]/div[2]/div[4]/ul/li',
  THREE_DOT_MENU: '//*[@id="radix-_r_9p_"]',
} as const;

// Fallbacks by text content or attributes (for resilience)
export const FALLBACKS = {
  imageMode: () => findByText('button', 'Image'),
  videoMode: () => findByText('button', 'Video'),
  aspectRatioOption: (ratio: string) => findByText('div', ratio),
  /** Download button by aria-label (stable when DOM structure changes). */
  downloadButton: (): Element | null =>
    document.querySelector('main article button[aria-label="Download"]') ??
    document.querySelector('button[aria-label="Download"]'),
} as const;

function findByText(tag: string, text: string): Element | null {
  const nodes = document.getElementsByTagName(tag);
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].textContent?.trim() === text) return nodes[i];
  }
  return null;
}
