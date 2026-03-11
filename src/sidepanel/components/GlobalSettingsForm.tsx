import { Icon } from '@iconify/react';
import type { GlobalSettings } from '@/shared/types';

interface GlobalSettingsFormProps {
  settings: GlobalSettings;
  onChange: (settings: GlobalSettings) => void;
  onSave: () => void;
}

export default function GlobalSettingsForm({
  settings,
  onChange,
  onSave,
}: GlobalSettingsFormProps) {
  return (
    <div className="space-y-4 font-poppins">
      <div className="border border-gray-200 rounded-2xl p-4 bg-white shadow-sm">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-3">
          <Icon icon="mdi:speedometer" className="w-4 h-4 text-gray-500" />
          Performance &amp; safety
        </h3>
        <div className="space-y-2">
          <div>
            <label className="block text-xs text-gray-600 mb-0.5">
              Delay between prompts (ms)
            </label>
            <input
              type="number"
              min={0}
              max={60000}
              step={500}
              value={settings.promptDelayMs}
              onChange={(e) =>
                onChange({ ...settings, promptDelayMs: Number(e.target.value) })
              }
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-gray-200"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-0.5">Max retries per prompt</label>
            <input
              type="number"
              min={1}
              max={10}
              value={settings.maxRetries}
              onChange={(e) =>
                onChange({ ...settings, maxRetries: Number(e.target.value) })
              }
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-gray-200"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-0.5">
              Render timeout (ms)
            </label>
            <input
              type="number"
              min={60000}
              max={600000}
              step={30000}
              value={settings.renderTimeoutMs}
              onChange={(e) =>
                onChange({ ...settings, renderTimeoutMs: Number(e.target.value) })
              }
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-gray-200"
            />
            <p className="text-xs text-gray-400 mt-0.5">
              e.g. 300000 = 5 min
            </p>
          </div>
        </div>
      </div>

      <div className="border border-gray-200 rounded-2xl p-4 bg-white shadow-sm">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-3">
          <Icon icon="mdi:folder-download-outline" className="w-4 h-4 text-gray-500" />
          Download settings
        </h3>
        <div className="space-y-2">
          <div>
            <label className="block text-xs text-gray-600 mb-0.5">
              Folder prefix (inside Downloads)
            </label>
            <input
              type="text"
              value={settings.downloadFolderPrefix ?? 'GrokAutomation'}
              onChange={(e) =>
                onChange({ ...settings, downloadFolderPrefix: e.target.value.trim() || 'GrokAutomation' })
              }
              placeholder="GrokAutomation"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-gray-200"
            />
            <p className="text-xs text-gray-400 mt-0.5">
              Files save to: Downloads/{settings.downloadFolderPrefix || 'GrokAutomation'}/&#123;project_name&#125;/
            </p>
          </div>
          <div className="mt-2 p-3 rounded-xl bg-amber-50 border border-amber-200 flex gap-2">
            <Icon icon="mdi:information-outline" className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-amber-800 mb-1">No Save As dialog?</p>
            <p className="text-xs text-amber-900">
              If Chrome still shows &quot;Save As&quot;, turn off <strong>Ask where to save each file before downloading</strong>: Chrome → Settings → Downloads (or <code className="bg-amber-100 px-0.5 rounded">chrome://settings/downloads</code>). The extension cannot bypass this setting.
            </p>
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onSave}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <Icon icon="mdi:content-save-outline" className="w-4 h-4" />
        Save settings
      </button>
    </div>
  );
}
