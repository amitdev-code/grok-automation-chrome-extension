import { MESSAGE_TYPES } from './messages';
import { waitForImaginePageReady } from './xpath';
import { runTextToImage } from './flows/textToImage';
import { runTextToVideo } from './flows/textToVideo';
import { runFrameToVideo } from './flows/frameToVideo';

interface RunPayload {
  project: {
    id: string;
    name: string;
    mode: string;
    prompts: string[];
    settings: Record<string, unknown> & {
      aspectRatio: string;
      videoQuality?: string;
      videoLength?: string;
    };
  };
  globalSettings?: {
    promptDelayMs: number;
    renderTimeoutMs: number;
    maxRetries: number;
  };
  startFromPromptIndex?: number;
}

const DEFAULT_OPTIONS = {
  promptDelayMs: 2000,
  renderTimeoutMs: 300000,
  maxRetries: 5,
};

chrome.runtime.onMessage.addListener(
  (message: { type: string; payload?: RunPayload }, _sender, sendResponse) => {
    if (message.type !== MESSAGE_TYPES.RUN_PROJECT || !message.payload?.project) {
      return false;
    }
    const { project, globalSettings, startFromPromptIndex } = message.payload;
    const options = {
      promptDelayMs: globalSettings?.promptDelayMs ?? DEFAULT_OPTIONS.promptDelayMs,
      renderTimeoutMs: globalSettings?.renderTimeoutMs ?? DEFAULT_OPTIONS.renderTimeoutMs,
      maxRetries: globalSettings?.maxRetries ?? DEFAULT_OPTIONS.maxRetries,
    };
    const reportProgress = (label: string) => {
      chrome.runtime.sendMessage({ type: MESSAGE_TYPES.PROJECT_PROGRESS, payload: label }).catch(() => {});
    };
    const run = async () => {
      try {
        reportProgress('Waiting for Imagine page to be ready...');
        await waitForImaginePageReady(20000);
        reportProgress('Page ready. Waiting 1.5s for UI to settle...');
        await new Promise((r) => setTimeout(r, 1500));
        if (project.mode === 'text-to-image') {
          reportProgress(startFromPromptIndex != null ? `Resuming Text-to-Image from prompt ${startFromPromptIndex + 1}...` : 'Starting Text-to-Image flow...');
          await runTextToImage(project, options, startFromPromptIndex);
        } else if (project.mode === 'text-to-video') {
          reportProgress(startFromPromptIndex != null ? `Resuming Text-to-Video from prompt ${startFromPromptIndex + 1}...` : 'Starting Text-to-Video flow...');
          await runTextToVideo(
            {
              ...project,
              settings: {
                aspectRatio: project.settings.aspectRatio ?? '16:9',
                videoQuality: project.settings.videoQuality ?? '720p',
                videoLength: project.settings.videoLength ?? '6',
              },
            },
            {
              promptDelayMs: options.promptDelayMs,
              renderTimeoutMs: options.renderTimeoutMs,
              maxRetries: options.maxRetries,
            },
            startFromPromptIndex
          );
        } else if (project.mode === 'frame-to-video') {
          reportProgress(startFromPromptIndex != null ? `Resuming Frame-to-Video from prompt ${startFromPromptIndex + 1}...` : 'Starting Frame-to-Video flow...');
          await runFrameToVideo(
            {
              ...project,
              settings: {
                aspectRatio: project.settings.aspectRatio ?? '16:9',
                videoQuality: project.settings.videoQuality ?? '720p',
                videoLength: project.settings.videoLength ?? '6',
              },
            },
            {
              promptDelayMs: options.promptDelayMs,
              renderTimeoutMs: options.renderTimeoutMs,
              maxRetries: options.maxRetries,
            },
            startFromPromptIndex
          );
        } else {
          chrome.runtime.sendMessage({
            type: MESSAGE_TYPES.ERROR,
            payload: { error: `Unknown mode: ${project.mode}` },
          });
          chrome.runtime.sendMessage({ type: MESSAGE_TYPES.PROJECT_DONE, payload: project.id });
        }
      } catch (err) {
        chrome.runtime.sendMessage({
          type: MESSAGE_TYPES.ERROR,
          payload: {
            error: err instanceof Error ? err.message : String(err),
            projectId: project.id,
          },
        });
        chrome.runtime.sendMessage({ type: MESSAGE_TYPES.PROJECT_DONE, payload: project.id });
      }
    };
    run().then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
    return true; // async response
  }
);
