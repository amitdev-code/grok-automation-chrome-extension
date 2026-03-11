import { useState, useRef } from 'react';
import { Icon } from '@iconify/react';
import type { Project, GenerationMode, ModelOption, AspectRatio, VideoQuality, VideoLength } from '@/shared/types';
import { createNewProject, getOutputFolder } from '@/shared/utils';

interface ProjectFormProps {
  project: Project | null;
  onSave: (project: Project) => void;
  onCancel: () => void;
}

const MODES: { value: GenerationMode; label: string; icon: string }[] = [
  { value: 'text-to-image', label: 'Image', icon: 'mdi:image' },
  { value: 'text-to-video', label: 'Video', icon: 'mdi:video' },
  { value: 'frame-to-video', label: 'Frame to Video', icon: 'mdi:image-multiple' },
];

const MODELS: { value: ModelOption; label: string }[] = [
  { value: 'grok-3.1-fast', label: 'Grok 3.1 Fast' },
  { value: 'grok-3.1-quality', label: 'Grok 3.1 Quality' },
  { value: 'grok-2-fast', label: 'Grok 2 Fast' },
  { value: 'grok-2-quality', label: 'Grok 2 Quality' },
];

const ASPECT_RATIOS: AspectRatio[] = ['16:9', '9:16', '1:1', '2:3', '3:2'];
const VIDEO_QUALITIES: VideoQuality[] = ['480p', '720p'];
const VIDEO_LENGTHS: VideoLength[] = ['6', '10'];

const btnBase =
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition-all duration-150 select-none';
const btnUnselected = 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-transparent';
const btnSelected = 'bg-white text-gray-900 border border-gray-200 shadow-sm';

export default function ProjectForm({ project, onSave, onCancel }: ProjectFormProps) {
  const initial = project ?? createNewProject();
  const [name, setName] = useState(initial.name);
  const [mode, setMode] = useState<GenerationMode>(initial.mode);
  const [promptList, setPromptList] = useState<string[]>(
    initial.prompts.length > 0 ? initial.prompts : ['']
  );
  const [settings, setSettings] = useState(initial.settings);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const prompts = promptList.map((p) => p.trim()).filter(Boolean);
    if (prompts.length === 0) {
      return;
    }
    onSave({
      ...initial,
      name: name.trim() || 'Untitled Project',
      mode,
      prompts,
      settings,
      updatedAt: Date.now(),
    });
  };

  const addPrompt = () => {
    setPromptList((prev) => [...prev, '']);
  };

  const updatePrompt = (index: number, value: string) => {
    setPromptList((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const removePrompt = (index: number) => {
    if (promptList.length <= 1) return;
    setPromptList((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.name.endsWith('.txt')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result);
      const lines = text.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
      setPromptList((prev) => (prev.length === 1 && !prev[0] ? lines : [...prev, ...lines]));
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const outputsMax = mode === 'text-to-image' ? 50 : 4;
  const outputsMin = 1;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Project name */}
      <div>
        <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
          <Icon icon="mdi:folder-edit-outline" className="w-3.5 h-3.5" />
          Project name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-2xl border-0 bg-gray-100 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-gray-300 focus:bg-white transition-colors"
          placeholder="My Project"
        />
        <p className="text-xs text-gray-400 mt-1.5">
          Saves to: Downloads/…/{getOutputFolder(name || 'project')}/
        </p>
      </div>

      {/* Mode: Image | Video | Frame to Video */}
      <div>
        <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
          <Icon icon="mdi:format-list-bulleted-type" className="w-3.5 h-3.5" />
          Mode
        </label>
        <div className="flex flex-wrap gap-2">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setMode(m.value)}
              className={`${btnBase} ${mode === m.value ? btnSelected : btnUnselected}`}
            >
              <Icon icon={m.icon} className="w-4 h-4" />
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Aspect ratio (dropdown style) */}
      <div>
        <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
          <Icon icon="mdi:aspect-ratio" className="w-3.5 h-3.5" />
          Aspect ratio
        </label>
        <div className="flex flex-wrap gap-2">
          {ASPECT_RATIOS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setSettings((s) => ({ ...s, aspectRatio: r }))}
              className={`${btnBase} ${settings.aspectRatio === r ? btnSelected : btnUnselected}`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Video: Quality & Duration */}
      {(mode === 'text-to-video' || mode === 'frame-to-video') && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
              <Icon icon="mdi:monitor" className="w-3.5 h-3.5" />
              Resolution
            </label>
            <div className="flex gap-2">
              {VIDEO_QUALITIES.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setSettings((s) => ({ ...s, videoQuality: q }))}
                  className={`flex-1 ${btnBase} ${settings.videoQuality === q ? btnSelected : btnUnselected}`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
              <Icon icon="mdi:clock-outline" className="w-3.5 h-3.5" />
              Duration
            </label>
            <div className="flex gap-2">
              {VIDEO_LENGTHS.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setSettings((s) => ({ ...s, videoLength: l }))}
                  className={`flex-1 ${btnBase} ${settings.videoLength === l ? btnSelected : btnUnselected}`}
                >
                  {l}s
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Prompts list */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide">
            <Icon icon="mdi:text-box-multiple-outline" className="w-3.5 h-3.5" />
            Prompts
          </label>
          <div className="flex gap-1.5">
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt"
              className="hidden"
              onChange={handleFileUpload}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <Icon icon="mdi:upload-outline" className="w-3.5 h-3.5" />
              Upload .txt
            </button>
            <button
              type="button"
              onClick={addPrompt}
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition-colors font-medium"
            >
              <Icon icon="mdi:plus" className="w-3.5 h-3.5" />
              Add prompt
            </button>
          </div>
        </div>
        <div className="space-y-3">
          {promptList.map((value, index) => (
            <div key={index} className="relative group">
              <textarea
                value={value}
                onChange={(e) => updatePrompt(index, e.target.value)}
                rows={2}
                className="font-poppins w-full rounded-2xl border-0 bg-gray-100 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-gray-300 focus:bg-white transition-colors resize-y min-h-[60px]"
                placeholder="Type to imagine…"
              />
              {promptList.length > 1 && (
                <button
                  type="button"
                  onClick={() => removePrompt(index)}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 border border-gray-200 text-gray-500 hover:text-red-600 hover:border-red-200 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                  title="Remove prompt"
                >
                  <Icon icon="mdi:close" className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-1.5">
          {promptList.filter((p) => p.trim()).length} prompt(s). Add at least one.
        </p>
      </div>

      {/* Advanced: Model & outputs (compact) */}
      <details className="rounded-2xl bg-gray-50 border border-gray-100 overflow-hidden">
        <summary className="flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-gray-500 cursor-pointer hover:bg-gray-100">
          <Icon icon="mdi:cog-outline" className="w-3.5 h-3.5" />
          Advanced (model & outputs)
        </summary>
        <div className="px-4 pb-4 pt-1 grid gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Model</label>
            <select
              value={settings.model}
              onChange={(e) =>
                setSettings((s) => ({ ...s, model: e.target.value as ModelOption }))
              }
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
            >
              {MODELS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Outputs per prompt ({outputsMin}–{outputsMax})
            </label>
            <input
              type="number"
              min={outputsMin}
              max={outputsMax}
              value={settings.outputsPerPrompt}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  outputsPerPrompt: Math.min(
                    outputsMax,
                    Math.max(outputsMin, Number(e.target.value))
                  ),
                }))
              }
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
            />
          </div>
        </div>
      </details>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={!promptList.some((p) => p.trim())}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-gray-900 text-white py-3 text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Icon icon="mdi:content-save-outline" className="w-4 h-4" />
          Save project
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <Icon icon="mdi:close" className="w-4 h-4" />
          Cancel
        </button>
      </div>
    </form>
  );
}
