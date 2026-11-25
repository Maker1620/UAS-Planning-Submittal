import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, KeyRound, RotateCcw, X } from 'lucide-react';
import {
  ByokSettings,
  ConfigSource,
  DEFAULT_GOOGLE_CLIENT_ID,
  ResolvedAppConfig,
} from '../services/appConfig';

interface SettingsModalProps {
  open: boolean;
  config: ResolvedAppConfig;
  mapsScriptAlreadyLoaded: boolean;
  onClose: () => void;
  onSave: (settings: ByokSettings) => void;
  onReset: () => void;
}

function formatSourceLabel(source: ConfigSource): string {
  switch (source) {
    case 'override':
      return 'Browser override (localStorage)';
    case 'env':
      return 'Workspace environment';
    case 'default':
      return 'Built-in default';
    case 'none':
      return 'Not configured';
  }
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  open,
  config,
  mapsScriptAlreadyLoaded,
  onClose,
  onSave,
  onReset,
}) => {
  const [mapsKeyInput, setMapsKeyInput] = useState(config.overrides.googleMapsApiKey);
  const [clientIdInput, setClientIdInput] = useState(config.overrides.googleClientId);
  const [showMapsKey, setShowMapsKey] = useState(false);

  useEffect(() => {
    if (open) {
      setMapsKeyInput(config.overrides.googleMapsApiKey);
      setClientIdInput(config.overrides.googleClientId);
      setShowMapsKey(false);
    }
  }, [open, config.overrides.googleMapsApiKey, config.overrides.googleClientId]);

  if (!open) return null;

  const hasAnyOverride =
    Boolean(config.overrides.googleMapsApiKey) || Boolean(config.overrides.googleClientId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      googleMapsApiKey: mapsKeyInput.trim(),
      googleClientId: clientIdInput.trim(),
    });
  };

  return (
    <div
      className="no-print fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
    >
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-md shadow-xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <KeyRound className="w-4 h-4 text-slate-700 shrink-0" />
            <h2 id="settings-modal-title" className="text-base font-semibold text-slate-900">
              API &amp; Integration Settings
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-6 py-5 space-y-5">
            <p className="text-xs text-slate-600 leading-relaxed">
              Optionally provide your own Google Maps JavaScript API Key or Google OAuth Web Client ID.
              Overrides are saved locally in this browser and take priority over workspace defaults.
            </p>

            {/* Google Maps API Key */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="byok-maps-key"
                  className="text-xs font-semibold text-slate-800"
                >
                  Google Maps JavaScript API Key
                </label>
                <span className="text-[11px] font-mono text-slate-500">
                  Active: {formatSourceLabel(config.googleMapsApiKeySource)}
                </span>
              </div>
              <div className="relative">
                <input
                  id="byok-maps-key"
                  type={showMapsKey ? 'text' : 'password'}
                  value={mapsKeyInput}
                  onChange={(e) => setMapsKeyInput(e.target.value)}
                  placeholder={
                    config.envMapsApiKey
                      ? 'Leave blank to use workspace environment key'
                      : 'Enter Google Maps JavaScript API key (AIza...)'
                  }
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full pl-3 pr-9 py-2 text-xs font-mono bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                />
                <button
                  type="button"
                  onClick={() => setShowMapsKey((v) => !v)}
                  aria-label={showMapsKey ? 'Hide API key' : 'Show API key'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  {showMapsKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-500 leading-snug">
                Required only for the 3D Earth &amp; Satellite Map tab. Leave blank to fall back to the
                workspace environment key.
              </p>
              {mapsScriptAlreadyLoaded && mapsKeyInput.trim() !== config.overrides.googleMapsApiKey && (
                <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5">
                  Saving a new Maps API key will refresh the page so the Google Maps script reloads cleanly with your key.
                </p>
              )}
            </div>

            {/* Google OAuth Client ID */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="byok-client-id"
                  className="text-xs font-semibold text-slate-800"
                >
                  Google OAuth 2.0 Client ID (Google Drive)
                </label>
                <span className="text-[11px] font-mono text-slate-500">
                  Active: {formatSourceLabel(config.googleClientIdSource)}
                </span>
              </div>
              <input
                id="byok-client-id"
                type="text"
                value={clientIdInput}
                onChange={(e) => setClientIdInput(e.target.value)}
                placeholder="Leave blank to use default OAuth Client ID"
                autoComplete="off"
                spellCheck={false}
                className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
              <p className="text-[11px] text-slate-500 leading-snug break-all">
                Default fallback:{' '}
                <span className="font-mono text-slate-600">{DEFAULT_GOOGLE_CLIENT_ID}</span>
              </p>
              <p className="text-[11px] text-slate-500 leading-snug">
                Scope requested: <span className="font-mono text-slate-600">drive.file</span> (access only to
                FlightDossier folders and files you create or explicitly select). OAuth tokens are kept in
                memory only and never saved to disk.
              </p>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                setMapsKeyInput('');
                setClientIdInput('');
                onReset();
              }}
              disabled={!hasAnyOverride && !mapsKeyInput && !clientIdInput}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-md disabled:opacity-45 whitespace-nowrap cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset to Defaults
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-md whitespace-nowrap cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md whitespace-nowrap cursor-pointer"
              >
                Save Settings
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
