import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Check,
  ExternalLink,
  FileJson,
  Folder,
  FolderOpen,
  FolderPlus,
  Loader2,
  RefreshCw,
  Upload,
  X,
} from 'lucide-react';
import {
  buildMissionFolderName,
  DriveMissionFolderEntry,
  PACKAGE_FILE_NAME,
  ROOT_FOLDER_NAME,
} from '../services/googleDriveService';
import { SubmittalPackage } from '../types/submittal';

export interface DriveSaveOptions {
  mode: 'linked' | 'new_folder' | 'existing_folder';
  folderName: string;
  targetFolderId?: string;
  existingFileId?: string;
  includePdf: boolean;
  includeKml: boolean;
  includeGeoJson: boolean;
}

interface DriveBrowserModalProps {
  open: boolean;
  mode: 'open' | 'save';
  pkg: SubmittalPackage;
  userEmail: string;
  loadingFolders: boolean;
  busyAction: string | null;
  entries: DriveMissionFolderEntry[];
  errorMessage: string | null;
  onClose: () => void;
  onRefresh: () => void;
  onOpenDriveFile: (fileId: string, folder?: { id: string; name: string }) => void;
  onPickJsonWithPicker: () => void;
  onPickFolderWithPicker: () => Promise<{ id: string; name: string } | null>;
  onConfirmSave: (options: DriveSaveOptions) => void;
}

function formatDateTime(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export const DriveBrowserModal: React.FC<DriveBrowserModalProps> = ({
  open,
  mode,
  pkg,
  userEmail,
  loadingFolders,
  busyAction,
  entries,
  errorMessage,
  onClose,
  onRefresh,
  onOpenDriveFile,
  onPickJsonWithPicker,
  onPickFolderWithPicker,
  onConfirmSave,
}) => {
  const hasLinkedFile = Boolean(pkg.driveSync?.folderId && pkg.driveSync?.fileId);
  const [saveTargetMode, setSaveTargetMode] = useState<'linked' | 'new_folder' | 'existing_folder'>(
    hasLinkedFile ? 'linked' : 'new_folder'
  );
  const [newFolderName, setNewFolderName] = useState(() => buildMissionFolderName(pkg));
  const [selectedExistingFolder, setSelectedExistingFolder] = useState<{
    id: string;
    name: string;
    existingFileId?: string;
  } | null>(null);
  const [includePdf, setIncludePdf] = useState(false);
  const [includeKml, setIncludeKml] = useState(false);
  const [includeGeoJson, setIncludeGeoJson] = useState(false);
  const [overwriteConfirmed, setOverwriteConfirmed] = useState(false);

  useEffect(() => {
    if (open) {
      const linked = Boolean(pkg.driveSync?.folderId && pkg.driveSync?.fileId);
      setSaveTargetMode(linked ? 'linked' : 'new_folder');
      setNewFolderName(buildMissionFolderName(pkg));
      setSelectedExistingFolder(null);
      setIncludePdf(false);
      setIncludeKml(false);
      setIncludeGeoJson(false);
      setOverwriteConfirmed(false);
    }
  }, [open, pkg.id, pkg.driveSync?.fileId, pkg.driveSync?.folderId]);

  if (!open) return null;

  // Determine whether this save action will overwrite an existing file in Drive
  const matchedExistingEntry =
    saveTargetMode === 'new_folder'
      ? entries.find(
          (e) => e.folder.name.trim().toLowerCase() === newFolderName.trim().toLowerCase()
        )
      : saveTargetMode === 'existing_folder' && selectedExistingFolder
        ? entries.find((e) => e.folder.id === selectedExistingFolder.id)
        : undefined;

  const willOverwriteExistingFile =
    (saveTargetMode === 'linked' && hasLinkedFile) ||
    Boolean(selectedExistingFolder?.existingFileId) ||
    Boolean(matchedExistingEntry?.packageFile?.id);

  const effectiveExistingFileId =
    saveTargetMode === 'linked'
      ? pkg.driveSync?.fileId
      : saveTargetMode === 'existing_folder'
        ? selectedExistingFolder?.existingFileId || matchedExistingEntry?.packageFile?.id
        : matchedExistingEntry?.packageFile?.id;

  const canSubmitSave =
    !busyAction &&
    (saveTargetMode === 'linked'
      ? Boolean(pkg.driveSync?.folderId)
      : saveTargetMode === 'new_folder'
        ? newFolderName.trim().length > 0
        : Boolean(selectedExistingFolder?.id)) &&
    (!willOverwriteExistingFile || overwriteConfirmed);

  const handleSaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmitSave) return;

    if (saveTargetMode === 'linked' && pkg.driveSync) {
      onConfirmSave({
        mode: 'linked',
        folderName: pkg.driveSync.folderName,
        targetFolderId: pkg.driveSync.folderId,
        existingFileId: pkg.driveSync.fileId,
        includePdf,
        includeKml,
        includeGeoJson,
      });
    } else if (saveTargetMode === 'existing_folder' && selectedExistingFolder) {
      onConfirmSave({
        mode: 'existing_folder',
        folderName: selectedExistingFolder.name,
        targetFolderId: selectedExistingFolder.id,
        existingFileId: effectiveExistingFileId,
        includePdf,
        includeKml,
        includeGeoJson,
      });
    } else {
      onConfirmSave({
        mode: 'new_folder',
        folderName: newFolderName.trim(),
        targetFolderId: matchedExistingEntry?.folder.id,
        existingFileId: effectiveExistingFileId,
        includePdf,
        includeKml,
        includeGeoJson,
      });
    }
  };

  const handlePickerFolderClick = async () => {
    const picked = await onPickFolderWithPicker();
    if (!picked) return;
    const knownEntry = entries.find((e) => e.folder.id === picked.id);
    setSelectedExistingFolder({
      id: picked.id,
      name: picked.name,
      existingFileId: knownEntry?.packageFile?.id,
    });
    setSaveTargetMode('existing_folder');
    setOverwriteConfirmed(false);
  };

  return (
    <div
      className="no-print fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="drive-modal-title"
    >
      <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-md shadow-xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4 shrink-0">
          <div className="min-w-0">
            <h2 id="drive-modal-title" className="text-base font-semibold text-slate-900">
              {mode === 'open'
                ? 'Open Submittal Package from Google Drive'
                : 'Sync / Save Submittal Package to Google Drive'}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 font-mono truncate">
              {userEmail} · {ROOT_FOLDER_NAME}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onRefresh}
              disabled={loadingFolders || Boolean(busyAction)}
              aria-label="Refresh Drive folders"
              className="p-1.5 text-slate-500 hover:text-slate-900 border border-slate-200 rounded-md disabled:opacity-45 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingFolders ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={Boolean(busyAction)}
              aria-label="Close modal"
              className="p-1.5 text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Error notice */}
        {errorMessage && (
          <div className="px-6 py-3 bg-red-50 border-b border-red-200 text-xs text-red-800 shrink-0">
            {errorMessage}
          </div>
        )}

        {/* Body */}
        {mode === 'open' ? (
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-slate-600">
                Select a saved mission folder under <span className="font-mono">{ROOT_FOLDER_NAME}</span> or pick any{' '}
                <span className="font-mono">.json</span> package via Google Picker.
              </p>
              <button
                type="button"
                onClick={onPickJsonWithPicker}
                disabled={Boolean(busyAction)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-md whitespace-nowrap cursor-pointer disabled:opacity-50"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                Browse via Google Picker
              </button>
            </div>

            {loadingFolders ? (
              <div className="py-12 flex flex-col items-center justify-center text-xs text-slate-500 gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                <span>Loading folders from Google Drive…</span>
              </div>
            ) : entries.length === 0 ? (
              <div className="py-10 px-6 border border-slate-200 rounded-md bg-slate-50 text-center space-y-2">
                <Folder className="w-6 h-6 text-slate-400 mx-auto" />
                <div className="text-xs font-semibold text-slate-800">
                  No saved packages found in {ROOT_FOLDER_NAME}
                </div>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Save a submittal package to Drive first, or click “Browse via Google Picker” to open a{' '}
                  <span className="font-mono">submittal-package.json</span> from another Drive folder.
                </p>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-md divide-y divide-slate-200">
                {entries.map((entry) => {
                  const hasJson = Boolean(entry.packageFile);
                  return (
                    <div
                      key={entry.folder.id}
                      className="px-4 py-3.5 flex flex-wrap items-center justify-between gap-3 hover:bg-slate-50/70"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Folder className="w-4 h-4 text-slate-500 shrink-0" />
                          <span className="text-xs font-semibold text-slate-900 truncate">
                            {entry.folder.name}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500 font-mono tabular-nums">
                          <span>
                            {hasJson ? entry.packageFile!.name : 'No submittal-package.json'}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>
                            Modified {formatDateTime(entry.packageFile?.modifiedTime || entry.folder.modifiedTime)}
                          </span>
                          {entry.artifacts.length > 0 && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>
                                +{entry.artifacts.length}{' '}
                                {entry.artifacts.length === 1 ? 'artifact' : 'artifacts'}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {entry.folder.webViewLink && (
                          <a
                            href={entry.folder.webViewLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Open ${entry.folder.name} in Google Drive`}
                            className="p-1.5 text-slate-400 hover:text-slate-700"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <button
                          type="button"
                          disabled={!hasJson || Boolean(busyAction)}
                          onClick={() =>
                            entry.packageFile &&
                            onOpenDriveFile(entry.packageFile.id, {
                              id: entry.folder.id,
                              name: entry.folder.name,
                            })
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md disabled:opacity-40 whitespace-nowrap cursor-pointer"
                        >
                          <FileJson className="w-3.5 h-3.5" />
                          Open Package
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSaveSubmit} className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Destination Selection */}
              <div className="space-y-2.5">
                <div className="text-xs font-semibold text-slate-800">
                  1. Choose Destination Mission Folder
                </div>

                {hasLinkedFile && pkg.driveSync && (
                  <label
                    className={`flex items-start gap-3 p-3.5 rounded-md border cursor-pointer ${
                      saveTargetMode === 'linked'
                        ? 'border-slate-900 bg-slate-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="drive-save-mode"
                      checked={saveTargetMode === 'linked'}
                      onChange={() => {
                        setSaveTargetMode('linked');
                        setOverwriteConfirmed(false);
                      }}
                      className="mt-0.5"
                    />
                    <div className="min-w-0 flex-1 text-xs">
                      <div className="font-semibold text-slate-900">
                        Update Linked Drive File (Recommended — no duplicates)
                      </div>
                      <div className="mt-0.5 text-slate-600 font-mono text-[11px] truncate">
                        {pkg.driveSync.folderName} / {pkg.driveSync.fileName || PACKAGE_FILE_NAME}
                      </div>
                      {pkg.driveSync.lastSyncedAt && (
                        <div className="mt-0.5 text-[11px] text-slate-500 font-mono tabular-nums">
                          Last synced: {formatDateTime(pkg.driveSync.lastSyncedAt)}
                        </div>
                      )}
                    </div>
                  </label>
                )}

                <label
                  className={`flex items-start gap-3 p-3.5 rounded-md border cursor-pointer ${
                    saveTargetMode === 'new_folder'
                      ? 'border-slate-900 bg-slate-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="drive-save-mode"
                    checked={saveTargetMode === 'new_folder'}
                    onChange={() => {
                      setSaveTargetMode('new_folder');
                      setOverwriteConfirmed(false);
                    }}
                    className="mt-0.5"
                  />
                  <div className="min-w-0 flex-1 space-y-2 text-xs">
                    <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                      <FolderPlus className="w-3.5 h-3.5 text-slate-600" />
                      <span>
                        Save in Mission Subfolder under {ROOT_FOLDER_NAME}
                      </span>
                    </div>
                    <input
                      type="text"
                      value={newFolderName}
                      onFocus={() => setSaveTargetMode('new_folder')}
                      onChange={(e) => {
                        setNewFolderName(e.target.value);
                        setOverwriteConfirmed(false);
                      }}
                      placeholder="Mission Name - YYYY-MM-DD"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                    />
                    <p className="text-[11px] text-slate-500">
                      Automatically finds or creates <span className="font-mono">{ROOT_FOLDER_NAME}</span> and this mission subfolder.
                    </p>
                  </div>
                </label>

                <div
                  className={`p-3.5 rounded-md border space-y-3 ${
                    saveTargetMode === 'existing_folder'
                      ? 'border-slate-900 bg-slate-50'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-900 cursor-pointer">
                      <input
                        type="radio"
                        name="drive-save-mode"
                        checked={saveTargetMode === 'existing_folder'}
                        onChange={() => {
                          setSaveTargetMode('existing_folder');
                          setOverwriteConfirmed(false);
                        }}
                      />
                      <span>Select an Existing Drive Folder</span>
                    </label>

                    <button
                      type="button"
                      onClick={handlePickerFolderClick}
                      disabled={Boolean(busyAction)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-md whitespace-nowrap cursor-pointer"
                    >
                      <FolderOpen className="w-3 h-3" />
                      Pick Folder via Google Picker
                    </button>
                  </div>

                  {selectedExistingFolder && (
                    <div className="px-3 py-2 bg-white border border-slate-200 rounded text-xs flex items-center justify-between gap-2">
                      <span className="font-mono text-slate-800 truncate">
                        Selected: {selectedExistingFolder.name}
                      </span>
                      <Check className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                    </div>
                  )}

                  {!loadingFolders && entries.length > 0 && (
                    <div className="max-h-36 overflow-y-auto border border-slate-200 rounded bg-white divide-y divide-slate-100">
                      {entries.map((entry) => {
                        const isPicked =
                          saveTargetMode === 'existing_folder' &&
                          selectedExistingFolder?.id === entry.folder.id;
                        return (
                          <button
                            key={entry.folder.id}
                            type="button"
                            onClick={() => {
                              setSaveTargetMode('existing_folder');
                              setSelectedExistingFolder({
                                id: entry.folder.id,
                                name: entry.folder.name,
                                existingFileId: entry.packageFile?.id,
                              });
                              setOverwriteConfirmed(false);
                            }}
                            className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between gap-2 cursor-pointer ${
                              isPicked ? 'bg-blue-50 text-blue-900 font-medium' : 'hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <span className="truncate">{entry.folder.name}</span>
                            <span className="text-[11px] font-mono text-slate-400 shrink-0">
                              {entry.packageFile ? 'has JSON' : 'empty'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Optional Artifacts to Upload Alongside submittal-package.json */}
              <div className="space-y-2.5">
                <div className="text-xs font-semibold text-slate-800">
                  2. Files to Upload to Mission Folder
                </div>
                <div className="border border-slate-200 rounded-md divide-y divide-slate-200 text-xs">
                  <div className="px-3.5 py-2.5 flex items-center justify-between bg-slate-50/70">
                    <span className="font-medium text-slate-900 font-mono">{PACKAGE_FILE_NAME}</span>
                    <span className="text-[11px] text-slate-500">Always included (full package state)</span>
                  </div>
                  <label className="px-3.5 py-2.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/50">
                    <span className="flex items-center gap-2.5 text-slate-700">
                      <input
                        type="checkbox"
                        checked={includePdf}
                        onChange={(e) => setIncludePdf(e.target.checked)}
                      />
                      <span>Submittal Dossier PDF ({pkg.referenceCode}-submittal-package.pdf)</span>
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">PDF</span>
                  </label>
                  <label className="px-3.5 py-2.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/50">
                    <span className="flex items-center gap-2.5 text-slate-700">
                      <input
                        type="checkbox"
                        checked={includeKml}
                        onChange={(e) => setIncludeKml(e.target.checked)}
                        disabled={(pkg.mapElements ?? []).length === 0}
                      />
                      <span>Google Earth Operational Map ({pkg.referenceCode}-operations.kml)</span>
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      {(pkg.mapElements ?? []).length} features
                    </span>
                  </label>
                  <label className="px-3.5 py-2.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/50">
                    <span className="flex items-center gap-2.5 text-slate-700">
                      <input
                        type="checkbox"
                        checked={includeGeoJson}
                        onChange={(e) => setIncludeGeoJson(e.target.checked)}
                        disabled={(pkg.mapElements ?? []).length === 0}
                      />
                      <span>Operational Map GeoJSON ({pkg.referenceCode}-operations.geojson)</span>
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">GeoJSON</span>
                  </label>
                </div>
              </div>

              {/* Mandatory Overwrite Confirmation Block */}
              {willOverwriteExistingFile && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-md space-y-2.5">
                  <div className="flex items-start gap-2.5 text-xs text-amber-950">
                    <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold">Confirm Update to Existing Drive File</div>
                      <p className="mt-0.5 text-amber-900 leading-relaxed">
                        Saving will overwrite the existing{' '}
                        <span className="font-mono">{PACKAGE_FILE_NAME}</span> in Google Drive (and replace any
                        matching selected PDF/KML/GeoJSON files in the same folder).
                      </p>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-xs font-medium text-amber-950 cursor-pointer pl-6">
                    <input
                      type="checkbox"
                      checked={overwriteConfirmed}
                      onChange={(e) => setOverwriteConfirmed(e.target.checked)}
                    />
                    <span>I confirm updating the existing file(s) in my Google Drive.</span>
                  </label>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
              <div className="text-xs text-slate-500">
                {busyAction ? (
                  <span className="inline-flex items-center gap-1.5 text-slate-700">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    {busyAction}
                  </span>
                ) : (
                  <span>Target: Google Drive API v3</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={Boolean(busyAction)}
                  className="px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-md whitespace-nowrap cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!canSubmitSave}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-md disabled:opacity-45 whitespace-nowrap cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{willOverwriteExistingFile ? 'Update in Drive' : 'Save to Drive'}</span>
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
