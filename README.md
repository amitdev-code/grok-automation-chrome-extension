# Grok Automation Chrome Extension

Chrome Extension (Manifest V3) that automates content generation on [Grok Imagine](https://grok.com/imagine). The extension opens in the **Chrome Side Panel** and provides a light-mode dashboard to create projects, queue them, and run generation tasks automatically.

## Features

- **Project Manager**: Create, edit, delete, duplicate projects. Each project has name, mode (Text-to-Image, Text-to-Video, Frame-to-Video), prompts (blank-line separated or from .txt upload), and generation settings.
- **Generation settings**: Model (Grok 3.1/2 Fast/Quality), aspect ratio, outputs per prompt, video quality/length.
- **Queue**: Add projects to a queue, reorder, and run all sequentially. Pause/Resume supported.
- **Automation**: Content script interacts with the Grok Imagine UI via XPath/DOM to set mode, options, enter prompts, trigger generation, and request downloads.
- **Downloads**: Outputs are saved to `Downloads/GrokAutomation/{project_name}/` with filenames `{project}_{timestamp}_{prompt_index}.mp4` or `.png`.
- **Export/Import**: Export all projects and queue order as JSON; import from a previously exported file.
- **Last run**: Projects show last run timestamp after completion.

## Build

```bash
npm install
npm run build
```

Load the extension in Chrome:

1. Open `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `dist` folder

## Usage

1. Open a tab to **https://grok.com/imagine** (log in if required).
2. Click the extension icon to open the side panel.
3. Create projects, add prompts, configure settings, and add projects to the queue.
4. Click **RUN ALL PROJECTS** to run the queue. The extension will use the open Grok tab (or open one) and run each project in order.
5. **Frame-to-Video**: Upload the source image manually on Grok before running the project; the script will then enter prompts and generate.

## Selectors / XPaths

The automation uses XPath selectors that may break if Grok updates their UI. Selectors are in `src/content/selectors.ts`. Fallbacks by button text (e.g. "Image", "Video") are used where possible. To rediscover selectors, inspect the page at https://grok.com/imagine and update `selectors.ts` and the flow files as needed.

## Tech Stack

- **Side panel**: React, TypeScript, Tailwind CSS (light theme only)
- **Build**: Vite
- **Chrome APIs**: sidePanel, storage, scripting, downloads, tabs
- **Automation**: Content script with XPath and DOM helpers
