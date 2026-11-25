/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';
import {
  CheckCircle2,
  ClipboardCheck,
  Cloud,
  CloudUpload,
  FileText,
  FolderOpen,
  Globe,
  LogOut,
  MapPin,
  Menu,
  Plus,
  Send,
  Settings,
  Trash2,
  X,
  AlertCircle,
} from 'lucide-react';
import { ComplianceAuditView } from './components/ComplianceAuditView';
import { ConfirmDialogModal } from './components/ConfirmDialogModal';
import { DriveBrowserModal, DriveSaveOptions } from './components/DriveBrowserModal';
import { FlightOperationsView } from './components/FlightOperationsView';
import { OperationalMapView } from './components/OperationalMapView';
import { SettingsModal } from './components/SettingsModal';
import { SiteAssessmentView } from './components/SiteAssessmentView';
import { SubmittalPackageView } from './components/SubmittalPackageView';
import { CLIENT_PROFILES } from './data/clientProfiles';
import { exportElementsToGeoJson, exportElementsToKml } from './data/mapCategories';
import { createBlankPackage, SAMPLE_PACKAGES } from './data/samplePackages';
import { evaluateSubmittalCompliance } from './engine/complianceEngine';
import {
  ByokSettings,
  resetByokOverrides,
  resolveAppConfig,
  ResolvedAppConfig,
  saveByokOverrides,
} from './services/appConfig';
import {
  buildMissionFolderName,
  disconnectDriveSession,
  DriveAuthExpiredError,
  DriveMissionFolderEntry,
  DriveUserProfile,
  fetchDriveUserProfile,
  findFileInFolder,
  findOrCreateMissionFolder,
  findOrCreateRootFolder,
  getInMemoryAccessToken,
  listMissionFoldersAndPackages,
  loadPackageFromDriveFile,
  openGooglePicker,
  requestDriveAccessToken,
  savePackageToDrive,
  uploadMultipartFile,
} from './services/googleDriveService';
import { SubmittalPackage, WorkspaceTab } from './types/submittal';
import { generateSubmittalPdfBlob } from './utils/submittalPdf';

const STORAGE_KEY = 'flightdossier_packages_v1';

const TAB_LABELS: Record<WorkspaceTab, string> = {
  site: 'Site & Airspace',
  map: 'Site Map (3D Earth)',
  operations: 'Flight Operations',
  audit: 'Compliance Audit',
  submittal: 'Submittal Package',
};

interface ToastState {
  id: number;
  tone: 'success' | 'error' | 'info';
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface PendingArtifactOverwrite {
  kind: 'pdf' | 'kml' | 'geojson';
  folderId: string;
  folderName: string;
  fileName: string;
  mimeType: string;
  content: Blob | string;
  existingFileId: string;
}

function loadInitialPackages(): SubmittalPackage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return SAMPLE_PACKAGES;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((pkg: SubmittalPackage) => {
        if (Array.isArray(pkg.mapElements)) return pkg;
        const sampleMatch = SAMPLE_PACKAGES.find((s) => s.id === pkg.id);
        return {
          ...pkg,
          mapElements: sampleMatch ? sampleMatch.mapElements : [],
        };
      });
    }
    return SAMPLE_PACKAGES;
  } catch {
    return SAMPLE_PACKAGES;
  }
}

const GoogleGMark: React.FC = () => (
  <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.44a5.5 5.5 0 0 1-2.39 3.61v3h3.87c2.26-2.08 3.57-5.15 3.57-8.64Z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.87-3c-1.07.72-2.44 1.15-4.06 1.15-3.12 0-5.77-2.11-6.72-4.95H1.28v3.1A12 12 0 0 0 12 24Z"
    />
    <path
      fill="#FBBC05"
      d="M5.28 14.29a7.2 7.2 0 0 1 0-4.58v-3.1H1.28a12 12 0 0 0 0 10.78l4-3.1Z"
    />
    <path
      fill="#EA4335"
      d="M12 4.76c1.76 0 3.34.61 4.59 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.28 6.61l4 3.1c.95-2.84 3.6-4.95 6.72-4.95Z"
    />
  </svg>
);

export default function App() {
  const [appConfig, setAppConfig] = useState<ResolvedAppConfig>(() => resolveAppConfig());
  const initialMapsKeyRef = useRef<string>(appConfig.googleMapsApiKey);

  const [packages, setPackages] = useState<SubmittalPackage[]>(loadInitialPackages);
  const [activePackageId, setActivePackageId] = useState<string>(() => {
    const initial = loadInitialPackages();
    return initial[0].id;
  });
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('map');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  // BYOK Settings & Toast State
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  // Google Drive State (access token lives strictly in memory inside googleDriveService)
  const [driveUser, setDriveUser] = useState<DriveUserProfile | null>(null);
  const [connectingDrive, setConnectingDrive] = useState(false);
  const [driveModalMode, setDriveModalMode] = useState<'open' | 'save' | null>(null);
  const [driveEntries, setDriveEntries] = useState<DriveMissionFolderEntry[]>([]);
  const [driveLoadingFolders, setDriveLoadingFolders] = useState(false);
  const [driveBusyAction, setDriveBusyAction] = useState<string | null>(null);
  const [driveModalError, setDriveModalError] = useState<string | null>(null);
  const [uploadingArtifact, setUploadingArtifact] = useState<'pdf' | 'kml' | 'geojson' | null>(
    null
  );
  const [pendingOverwrite, setPendingOverwrite] = useState<PendingArtifactOverwrite | null>(null);

  const showToast = useCallback(
    (
      tone: ToastState['tone'],
      message: string,
      action?: { label: string; onClick: () => void },
      durationMs = 5500
    ) => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
      const next: ToastState = {
        id: Date.now(),
        tone,
        message,
        actionLabel: action?.label,
        onAction: action?.onClick,
      };
      setToast(next);
      toastTimerRef.current = window.setTimeout(() => {
        setToast((curr) => (curr?.id === next.id ? null : curr));
      }, durationMs);
    },
    []
  );

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const handleQuota = () => setQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuota);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuota);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(packages));
    } catch {
      // Ignore storage quota errors
    }
  }, [packages]);

  const activePackage = useMemo(() => {
    return packages.find((p) => p.id === activePackageId) || packages[0];
  }, [packages, activePackageId]);

  const auditsById = useMemo(() => {
    const map: Record<string, ReturnType<typeof evaluateSubmittalCompliance>> = {};
    packages.forEach((p) => {
      map[p.id] = evaluateSubmittalCompliance(p);
    });
    return map;
  }, [packages]);

  const activeAudit = auditsById[activePackage.id];

  const handleUpdateActivePackage = useCallback(
    (updater: (prev: SubmittalPackage) => SubmittalPackage) => {
      setPackages((prev) =>
        prev.map((p) => (p.id === activePackage.id ? updater(p) : p))
      );
    },
    [activePackage.id]
  );

  const handleCreatePackage = () => {
    const nextPkg = createBlankPackage(packages.length + 1);
    setPackages((prev) => [nextPkg, ...prev]);
    setActivePackageId(nextPkg.id);
    setActiveTab('site');
    setMobileMenuOpen(false);
  };

  const handleDeletePackage = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (packages.length <= 1) return;
    const remaining = packages.filter((p) => p.id !== id);
    setPackages(remaining);
    if (activePackageId === id) {
      setActivePackageId(remaining[0].id);
    }
  };

  const handleResetSamples = () => {
    setPackages(SAMPLE_PACKAGES);
    setActivePackageId(SAMPLE_PACKAGES[0].id);
    setActiveTab('map');
    setMobileMenuOpen(false);
  };

  // --- BYOK Settings Handlers ---
  const handleSaveSettings = (nextSettings: ByokSettings) => {
    const previousMapsKey = appConfig.googleMapsApiKey;
    const previousClientId = appConfig.googleClientId;

    saveByokOverrides(nextSettings);
    const updated = resolveAppConfig();
    setAppConfig(updated);
    setSettingsOpen(false);

    if (previousClientId !== updated.googleClientId && driveUser) {
      disconnectDriveSession();
      setDriveUser(null);
    }

    if (initialMapsKeyRef.current && previousMapsKey !== updated.googleMapsApiKey) {
      window.location.reload();
      return;
    }

    if (!initialMapsKeyRef.current && updated.googleMapsApiKey) {
      initialMapsKeyRef.current = updated.googleMapsApiKey;
      setQuotaExceeded(false);
    }

    showToast('success', 'API & integration settings saved locally in this browser.');
  };

  const handleResetSettings = () => {
    const previousMapsKey = appConfig.googleMapsApiKey;
    const previousClientId = appConfig.googleClientId;

    resetByokOverrides();
    const updated = resolveAppConfig();
    setAppConfig(updated);
    setSettingsOpen(false);

    if (previousClientId !== updated.googleClientId && driveUser) {
      disconnectDriveSession();
      setDriveUser(null);
    }

    if (initialMapsKeyRef.current && previousMapsKey !== updated.googleMapsApiKey) {
      window.location.reload();
      return;
    }

    showToast('info', 'Settings reset to workspace defaults.');
  };

  // --- Google Drive Authentication & Error Handling ---
  const handleConnectDrive = useCallback(
    async (prompt: '' | 'consent' | 'select_account' = 'select_account'): Promise<string | null> => {
      setConnectingDrive(true);
      try {
        const token = await requestDriveAccessToken(appConfig.googleClientId, prompt);
        const profile = await fetchDriveUserProfile(token);
        setDriveUser(profile);
        showToast('success', `Connected to Google Drive as ${profile.emailAddress}.`);
        return token;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unable to connect to Google Drive.';
        showToast('error', msg);
        return null;
      } finally {
        setConnectingDrive(false);
      }
    },
    [appConfig.googleClientId, showToast]
  );

  const handleDisconnectDrive = () => {
    disconnectDriveSession();
    setDriveUser(null);
    setDriveModalMode(null);
    setDriveEntries([]);
    showToast('info', 'Disconnected from Google Drive. Local auto-save remains active.');
  };

  const handleDriveError = useCallback(
    (err: unknown, contextMessage?: string) => {
      if (err instanceof DriveAuthExpiredError) {
        setDriveUser(null);
        setDriveModalMode(null);
        showToast(
          'error',
          err.message,
          {
            label: 'Reconnect Drive',
            onClick: () => {
              void handleConnectDrive('consent');
            },
          },
          10000
        );
        return;
      }
      const detail = err instanceof Error ? err.message : contextMessage || 'Google Drive operation failed.';
      setDriveModalError(detail);
      showToast('error', detail);
    },
    [handleConnectDrive, showToast]
  );

  const ensureValidToken = useCallback(async (): Promise<string | null> => {
    const existing = getInMemoryAccessToken();
    if (existing) return existing;

    if (driveUser) {
      showToast(
        'error',
        'Your Google Drive token expired. Reconnect to refresh access.',
        {
          label: 'Reconnect Drive',
          onClick: () => {
            void handleConnectDrive('consent');
          },
        },
        10000
      );
      setDriveUser(null);
      return null;
    }

    return handleConnectDrive('select_account');
  }, [driveUser, handleConnectDrive, showToast]);

  const refreshDriveFolders = useCallback(
    async (explicitToken?: string) => {
      const token = explicitToken || (await ensureValidToken());
      if (!token) return;
      setDriveLoadingFolders(true);
      setDriveModalError(null);
      try {
        const { entries } = await listMissionFoldersAndPackages(token);
        setDriveEntries(entries);
      } catch (err) {
        handleDriveError(err, 'Unable to list folders in Google Drive.');
      } finally {
        setDriveLoadingFolders(false);
      }
    },
    [ensureValidToken, handleDriveError]
  );

  const handleOpenDriveModal = async (mode: 'open' | 'save') => {
    const token = await ensureValidToken();
    if (!token) return;
    setDriveModalError(null);
    setDriveModalMode(mode);
    void refreshDriveFolders(token);
  };

  const buildArtifactPayload = useCallback(
    (kind: 'pdf' | 'kml' | 'geojson'): { fileName: string; mimeType: string; content: Blob | string } => {
      const safeRef = (activePackage.referenceCode || 'uas-submittal').replace(/[^a-zA-Z0-9-_]/g, '-');
      if (kind === 'pdf') {
        const { blob, fileName } = generateSubmittalPdfBlob(activePackage, activeAudit);
        return { fileName, mimeType: 'application/pdf', content: blob };
      }
      if (kind === 'kml') {
        const kml = exportElementsToKml(
          activePackage.title,
          activePackage.referenceCode,
          activePackage.mapElements ?? []
        );
        return {
          fileName: `${safeRef}-operations.kml`,
          mimeType: 'application/vnd.google-earth.kml+xml',
          content: kml,
        };
      }
      const gj = exportElementsToGeoJson(activePackage.mapElements ?? []);
      return {
        fileName: `${safeRef}-operations.geojson`,
        mimeType: 'application/geo+json',
        content: JSON.stringify(gj, null, 2),
      };
    },
    [activeAudit, activePackage]
  );

  const handleConfirmSaveToDrive = async (options: DriveSaveOptions) => {
    const token = await ensureValidToken();
    if (!token) return;

    setDriveBusyAction('Saving submittal-package.json to Drive…');
    setDriveModalError(null);

    try {
      let rootFolderId = activePackage.driveSync?.rootFolderId;
      let targetFolderId = options.targetFolderId || '';
      let targetFolderName = options.folderName;
      let existingFileId = options.existingFileId;

      if (!targetFolderId) {
        const root = await findOrCreateRootFolder(token);
        rootFolderId = root.id;
        const missionFolder = await findOrCreateMissionFolder(token, root.id, options.folderName);
        targetFolderId = missionFolder.id;
        targetFolderName = missionFolder.name;
      }

      if (!existingFileId) {
        const existingJson = await findFileInFolder(token, targetFolderId, 'submittal-package.json');
        if (existingJson) {
          existingFileId = existingJson.id;
        }
      }

      const { driveSync } = await savePackageToDrive(token, activePackage, activeAudit, {
        rootFolderId,
        folderId: targetFolderId,
        folderName: targetFolderName,
        existingFileId,
      });

      const uploadedExtras: string[] = [];
      const artifactKinds: Array<'pdf' | 'kml' | 'geojson'> = [];
      if (options.includePdf) artifactKinds.push('pdf');
      if (options.includeKml && (activePackage.mapElements ?? []).length > 0) {
        artifactKinds.push('kml');
      }
      if (options.includeGeoJson && (activePackage.mapElements ?? []).length > 0) {
        artifactKinds.push('geojson');
      }

      for (const kind of artifactKinds) {
        const payload = buildArtifactPayload(kind);
        setDriveBusyAction(`Uploading ${payload.fileName}…`);
        const existingArt = await findFileInFolder(token, targetFolderId, payload.fileName);
        await uploadMultipartFile(token, {
          folderId: targetFolderId,
          fileName: payload.fileName,
          mimeType: payload.mimeType,
          content: payload.content,
          existingFileId: existingArt?.id,
        });
        uploadedExtras.push(kind.toUpperCase());
      }

      handleUpdateActivePackage((prev) => ({
        ...prev,
        driveSync,
      }));

      setDriveModalMode(null);
      const extraLabel = uploadedExtras.length > 0 ? ` + ${uploadedExtras.join(', ')}` : '';
      showToast(
        'success',
        `${existingFileId ? 'Updated' : 'Saved'} submittal-package.json${extraLabel} in Drive folder "${targetFolderName}".`
      );
    } catch (err) {
      handleDriveError(err, 'Failed to save package to Google Drive.');
    } finally {
      setDriveBusyAction(null);
    }
  };

  const handleOpenDriveFile = async (
    fileId: string,
    knownFolder?: { id: string; name: string }
  ) => {
    const token = await ensureValidToken();
    if (!token) return;

    setDriveBusyAction('Loading package from Google Drive…');
    setDriveModalError(null);
    try {
      const loadedPkg = await loadPackageFromDriveFile(token, fileId, knownFolder);
      setPackages((prev) => {
        const existingIdx = prev.findIndex(
          (p) => p.driveSync?.fileId === fileId || p.id === loadedPkg.id
        );
        if (existingIdx >= 0) {
          const copy = [...prev];
          copy[existingIdx] = loadedPkg;
          return copy;
        }
        return [loadedPkg, ...prev];
      });
      setActivePackageId(loadedPkg.id);
      setDriveModalMode(null);
      showToast(
        'success',
        `Loaded "${loadedPkg.title}" from Google Drive (${loadedPkg.driveSync?.folderName || 'Drive'}).`
      );
    } catch (err) {
      handleDriveError(err, 'Failed to open submittal package from Google Drive.');
    } finally {
      setDriveBusyAction(null);
    }
  };

  const handlePickJsonWithPicker = async () => {
    const token = await ensureValidToken();
    if (!token) return;
    setDriveModalError(null);
    try {
      const picked = await openGooglePicker({
        accessToken: token,
        mode: 'json',
        title: 'Select a FlightDossier submittal-package.json file',
      });
      if (picked) {
        await handleOpenDriveFile(picked.id);
      }
    } catch (err) {
      handleDriveError(err, 'Google Picker could not open. Use the folder list above instead.');
    }
  };

  const handlePickFolderWithPicker = async (): Promise<{ id: string; name: string } | null> => {
    const token = await ensureValidToken();
    if (!token) return null;
    setDriveModalError(null);
    try {
      const picked = await openGooglePicker({
        accessToken: token,
        mode: 'folder',
        title: 'Select destination Google Drive folder',
      });
      return picked ? { id: picked.id, name: picked.name } : null;
    } catch (err) {
      handleDriveError(err, 'Google Picker could not open. Choose a folder from the list instead.');
      return null;
    }
  };

  const executeArtifactUpload = async (
    token: string,
    params: {
      kind: 'pdf' | 'kml' | 'geojson';
      folderId: string;
      folderName: string;
      fileName: string;
      mimeType: string;
      content: Blob | string;
      existingFileId?: string;
    }
  ) => {
    setUploadingArtifact(params.kind);
    try {
      await uploadMultipartFile(token, {
        folderId: params.folderId,
        fileName: params.fileName,
        mimeType: params.mimeType,
        content: params.content,
        existingFileId: params.existingFileId,
      });

      if (!activePackage.driveSync?.folderId) {
        handleUpdateActivePackage((prev) => ({
          ...prev,
          driveSync: {
            folderId: params.folderId,
            folderName: params.folderName,
            lastSyncedAt: new Date().toISOString(),
          },
        }));
      }

      showToast(
        'success',
        `${params.existingFileId ? 'Updated' : 'Uploaded'} ${params.fileName} in Drive folder "${params.folderName}".`
      );
    } catch (err) {
      handleDriveError(err, `Failed to upload ${params.fileName} to Google Drive.`);
    } finally {
      setUploadingArtifact(null);
    }
  };

  const handleUploadSingleArtifact = async (kind: 'pdf' | 'kml' | 'geojson') => {
    const token = await ensureValidToken();
    if (!token) return;

    setUploadingArtifact(kind);
    try {
      let folderId = activePackage.driveSync?.folderId;
      let folderName = activePackage.driveSync?.folderName;

      if (!folderId || !folderName) {
        const root = await findOrCreateRootFolder(token);
        const missionFolder = await findOrCreateMissionFolder(
          token,
          root.id,
          buildMissionFolderName(activePackage)
        );
        folderId = missionFolder.id;
        folderName = missionFolder.name;
      }

      const payload = buildArtifactPayload(kind);
      const existing = await findFileInFolder(token, folderId, payload.fileName);

      if (existing) {
        setUploadingArtifact(null);
        setPendingOverwrite({
          kind,
          folderId,
          folderName,
          fileName: payload.fileName,
          mimeType: payload.mimeType,
          content: payload.content,
          existingFileId: existing.id,
        });
        return;
      }

      await executeArtifactUpload(token, {
        kind,
        folderId,
        folderName,
        fileName: payload.fileName,
        mimeType: payload.mimeType,
        content: payload.content,
      });
    } catch (err) {
      setUploadingArtifact(null);
      handleDriveError(err, 'Failed to prepare Drive artifact upload.');
    }
  };

  const handleConfirmPendingOverwrite = async () => {
    if (!pendingOverwrite) return;
    const token = await ensureValidToken();
    if (!token) {
      setPendingOverwrite(null);
      return;
    }
    const task = pendingOverwrite;
    setPendingOverwrite(null);
    await executeArtifactUpload(token, task);
  };

  const openGapCount = activeAudit.blockers + activeAudit.missingDocs;
  const mapCount = (activePackage.mapElements ?? []).length;

  const navItems: {
    id: WorkspaceTab;
    label: string;
    icon: React.FC<{ className?: string }>;
    meta?: string;
    metaTone?: 'danger' | 'warn' | 'ok' | 'muted';
  }[] = [
    {
      id: 'site',
      label: 'Site & Airspace',
      icon: MapPin,
      meta: `Class ${activePackage.site.airspaceClass}`,
      metaTone: 'muted',
    },
    {
      id: 'map',
      label: 'Site Map (3D Earth)',
      icon: Globe,
      meta: `${mapCount} ${mapCount === 1 ? 'item' : 'items'}`,
      metaTone: mapCount > 0 ? 'muted' : 'warn',
    },
    {
      id: 'operations',
      label: 'Flight Operations',
      icon: Send,
      meta: `${activePackage.operations.maxPlannedAglFt} ft`,
      metaTone: 'muted',
    },
    {
      id: 'audit',
      label: 'Compliance Audit',
      icon: ClipboardCheck,
      meta:
        openGapCount > 0
          ? `${openGapCount} ${openGapCount === 1 ? 'gap' : 'gaps'}`
          : activeAudit.warnings > 0
            ? `${activeAudit.warnings} warn`
            : 'Clear',
      metaTone:
        openGapCount > 0 ? 'danger' : activeAudit.warnings > 0 ? 'warn' : 'ok',
    },
    {
      id: 'submittal',
      label: 'Submittal Package',
      icon: FileText,
    },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white border-r border-slate-200">
      {/* Brand Zone */}
      <div className="h-14 px-5 flex items-center justify-between border-b border-slate-200 shrink-0">
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('audit');
          }}
          className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          FlightDossier
        </a>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Close navigation menu"
          className="lg:hidden p-1.5 text-slate-500 hover:text-slate-900 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Workspace Navigation */}
      <div className="p-4 border-b border-slate-200">
        <div className="px-2 pb-2 text-xs font-medium text-slate-500">
          Active Submittal Workspace
        </div>
        <nav className="space-y-1" aria-label="Workspace sections">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-slate-900 text-white font-medium'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.meta && (
                  <span
                    className={`text-xs font-mono tabular-nums shrink-0 ${
                      active
                        ? 'text-slate-300'
                        : item.metaTone === 'danger'
                          ? 'text-red-700 font-medium'
                          : item.metaTone === 'warn'
                            ? 'text-amber-700 font-medium'
                            : item.metaTone === 'ok'
                              ? 'text-emerald-700 font-medium'
                              : 'text-slate-400'
                    }`}
                  >
                    {item.meta}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Saved Submittal Packages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <div className="flex items-center justify-between px-2">
          <span className="text-xs font-medium text-slate-500">
            Submittal Packages ({packages.length})
          </span>
          <button
            type="button"
            onClick={handleCreatePackage}
            className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-800 whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            New
          </button>
        </div>

        <div className="space-y-1.5">
          {packages.map((p) => {
            const pAudit = auditsById[p.id];
            const pGaps = pAudit.blockers + pAudit.missingDocs;
            const isSelected = p.id === activePackage.id;
            const prof = CLIENT_PROFILES[p.clientProfileId];

            return (
              <div
                key={p.id}
                role="button"
                tabIndex={0}
                onClick={() => {
                  setActivePackageId(p.id);
                  setMobileMenuOpen(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setActivePackageId(p.id);
                    setMobileMenuOpen(false);
                  }
                }}
                className={`group p-3 rounded-md border transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-slate-50 border-slate-300'
                    : 'bg-white border-transparent hover:bg-slate-50/70 hover:border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-900 truncate">
                      {p.title || 'Untitled Submittal'}
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
                      <span className="font-mono tabular-nums">{p.referenceCode}</span>
                      <span aria-hidden="true">·</span>
                      <span className="truncate">{prof.name.split(' ')[0]}</span>
                      {p.driveSync?.fileId && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-blue-700 font-medium shrink-0">Drive</span>
                        </>
                      )}
                    </div>
                  </div>

                  {packages.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => handleDeletePackage(p.id, e)}
                      aria-label={`Delete ${p.title}`}
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 text-slate-400 hover:text-red-600 transition-opacity cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="mt-2 text-[11px] font-mono tabular-nums">
                  {pGaps > 0 ? (
                    <span className="text-red-700 font-medium">
                      {pAudit.blockers} blockers · {pAudit.missingDocs} missing docs
                    </span>
                  ) : pAudit.warnings > 0 ? (
                    <span className="text-amber-700 font-medium">
                      {pAudit.warnings} {pAudit.warnings === 1 ? 'warning' : 'warnings'}
                    </span>
                  ) : (
                    <span className="text-emerald-700 font-medium">Ready for submittal</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quiet Footer Action */}
      <div className="p-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
        <span>{driveUser ? 'Local + Drive' : 'Saved locally'}</span>
        <button
          type="button"
          onClick={handleResetSamples}
          className="text-slate-600 hover:text-slate-900 underline-offset-2 hover:underline cursor-pointer"
        >
          Reset samples
        </button>
      </div>
    </div>
  );

  const workspaceShell = (
    <div id="top" className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Demo Key Quota Exceeded Top Banner */}
      {quotaExceeded && (
        <div className="no-print bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. You can add your own Maps API key in Settings or visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      <div className="flex-1 flex min-w-0">
        {/* Desktop Sidebar */}
        <aside className="no-print hidden lg:block w-66 shrink-0 sticky top-0 h-screen">
          {sidebarContent}
        </aside>

        {/* Mobile Drawer Sidebar */}
        {mobileMenuOpen && (
          <div className="no-print fixed inset-0 z-50 lg:hidden flex">
            <div
              className="fixed inset-0 bg-slate-900/40"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="relative w-72 max-w-[85vw] h-full z-10">{sidebarContent}</div>
          </div>
        )}

        {/* Main Content Column */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Top Navigation Bar */}
          <header className="no-print sticky top-0 z-30 h-14 bg-white border-b border-slate-200 px-4 lg:px-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Open workspace menu"
                className="lg:hidden p-1.5 -ml-1.5 text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                <Menu className="w-5 h-5" />
              </button>

              <nav
                aria-label="Breadcrumb"
                className="flex items-center gap-2 text-xs text-slate-500 min-w-0"
              >
                <span className="hidden xl:inline whitespace-nowrap shrink-0">Packages</span>
                <span className="hidden xl:inline text-slate-300" aria-hidden="true">
                  /
                </span>
                <span className="font-medium text-slate-700 truncate max-w-[140px] sm:max-w-[200px]">
                  {activePackage.title || 'Untitled Submittal'}
                </span>
                <span className="text-slate-300" aria-hidden="true">
                  /
                </span>
                <span className="font-semibold text-slate-900 whitespace-nowrap shrink-0">
                  {TAB_LABELS[activeTab]}
                </span>
              </nav>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              {/* Google Drive Controls */}
              {!driveUser ? (
                <button
                  type="button"
                  onClick={() => void handleConnectDrive('select_account')}
                  disabled={connectingDrive}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-800 bg-white hover:bg-slate-50 border border-slate-300 rounded-md transition-colors disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <GoogleGMark />
                  <span>{connectingDrive ? 'Connecting…' : 'Connect Google Drive'}</span>
                </button>
              ) : (
                <div className="flex items-center gap-2 shrink-0">
                  <div
                    className="hidden xl:flex items-center gap-1.5 text-xs text-slate-600 pr-1 max-w-[180px]"
                    title={`Connected to Google Drive as ${driveUser.emailAddress}`}
                  >
                    <Cloud className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                    <span className="truncate font-mono text-[11px]">{driveUser.emailAddress}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleOpenDriveModal('save')}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-800 bg-white hover:bg-slate-50 border border-slate-300 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <CloudUpload className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                    <span className="hidden sm:inline">Sync / Save to Drive</span>
                    <span className="sm:hidden">Save</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleOpenDriveModal('open')}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-800 bg-white hover:bg-slate-50 border border-slate-300 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                    <span className="hidden sm:inline">Open from Drive</span>
                    <span className="sm:hidden">Open</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDisconnectDrive}
                    title={`Disconnect Google Drive (${driveUser.emailAddress})`}
                    aria-label="Disconnect Google Drive"
                    className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-slate-600 hover:text-red-700 bg-white hover:bg-red-50/50 border border-slate-300 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5 shrink-0" />
                    <span className="hidden 2xl:inline">Disconnect</span>
                  </button>
                </div>
              )}

              {/* BYOK Settings Trigger */}
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                aria-label="API & Integration Settings"
                title="API & Integration Settings (Google Maps Key & OAuth Client ID)"
                className="p-2 text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-300 rounded-md transition-colors shrink-0 cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>

              {/* Primary Workspace Action */}
              {activeTab !== 'submittal' ? (
                <button
                  type="button"
                  onClick={() => setActiveTab('submittal')}
                  className="px-3.5 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Open Submittal
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Print / Save PDF
                </button>
              )}
            </div>
          </header>

          {/* Active Workspace Viewport */}
          <main className="flex-1 w-full max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {activeTab === 'site' && (
              <SiteAssessmentView
                pkg={activePackage}
                onUpdatePackage={handleUpdateActivePackage}
                onNavigateTab={setActiveTab}
              />
            )}
            {activeTab === 'map' && (
              <OperationalMapView
                pkg={activePackage}
                apiKeyPresent={Boolean(appConfig.googleMapsApiKey)}
                driveConnected={Boolean(driveUser)}
                uploadingArtifact={uploadingArtifact}
                onUpdatePackage={handleUpdateActivePackage}
                onNavigateTab={setActiveTab}
                onOpenSettings={() => setSettingsOpen(true)}
                onUploadArtifactToDrive={(kind) => void handleUploadSingleArtifact(kind)}
              />
            )}
            {activeTab === 'operations' && (
              <FlightOperationsView
                pkg={activePackage}
                onUpdatePackage={handleUpdateActivePackage}
                onNavigateTab={setActiveTab}
              />
            )}
            {activeTab === 'audit' && (
              <ComplianceAuditView
                pkg={activePackage}
                audit={activeAudit}
                onUpdatePackage={handleUpdateActivePackage}
                onNavigateTab={setActiveTab}
              />
            )}
            {activeTab === 'submittal' && (
              <SubmittalPackageView
                pkg={activePackage}
                audit={activeAudit}
                driveConnected={Boolean(driveUser)}
                uploadingPdf={uploadingArtifact === 'pdf'}
                onNavigateTab={setActiveTab}
                onUploadPdfToDrive={() => void handleUploadSingleArtifact('pdf')}
              />
            )}
          </main>
        </div>
      </div>

      {/* BYOK Settings Modal */}
      <SettingsModal
        open={settingsOpen}
        config={appConfig}
        mapsScriptAlreadyLoaded={Boolean(initialMapsKeyRef.current)}
        onClose={() => setSettingsOpen(false)}
        onSave={handleSaveSettings}
        onReset={handleResetSettings}
      />

      {/* Google Drive Open / Save Browser Modal */}
      {driveUser && (
        <DriveBrowserModal
          open={driveModalMode !== null}
          mode={driveModalMode || 'open'}
          pkg={activePackage}
          userEmail={driveUser.emailAddress}
          loadingFolders={driveLoadingFolders}
          busyAction={driveBusyAction}
          entries={driveEntries}
          errorMessage={driveModalError}
          onClose={() => setDriveModalMode(null)}
          onRefresh={() => void refreshDriveFolders()}
          onOpenDriveFile={(fileId, folder) => void handleOpenDriveFile(fileId, folder)}
          onPickJsonWithPicker={() => void handlePickJsonWithPicker()}
          onPickFolderWithPicker={handlePickFolderWithPicker}
          onConfirmSave={(options) => void handleConfirmSaveToDrive(options)}
        />
      )}

      {/* Overwrite Confirmation Dialog for Single Artifact Uploads */}
      <ConfirmDialogModal
        open={Boolean(pendingOverwrite)}
        title="Overwrite Existing Google Drive File?"
        description={
          pendingOverwrite
            ? `"${pendingOverwrite.fileName}" already exists in Google Drive folder "${pendingOverwrite.folderName}". Confirming will update the existing file in place.`
            : ''
        }
        confirmLabel="Update File in Drive"
        busy={Boolean(uploadingArtifact)}
        onCancel={() => setPendingOverwrite(null)}
        onConfirm={() => void handleConfirmPendingOverwrite()}
      />

      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="no-print fixed bottom-5 right-5 z-50 max-w-md bg-white border border-slate-300 rounded-md shadow-lg px-4 py-3 flex items-start gap-3"
        >
          {toast.tone === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
          ) : toast.tone === 'error' ? (
            <AlertCircle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
          ) : (
            <Cloud className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
          )}
          <div className="min-w-0 flex-1 text-xs text-slate-800 leading-relaxed">
            <p>{toast.message}</p>
            {toast.actionLabel && toast.onAction && (
              <button
                type="button"
                onClick={() => {
                  const act = toast.onAction;
                  setToast(null);
                  act?.();
                }}
                className="mt-1.5 text-xs font-semibold text-blue-700 hover:text-blue-800 underline underline-offset-2 cursor-pointer"
              >
                {toast.actionLabel}
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="Dismiss notification"
            className="text-slate-400 hover:text-slate-700 shrink-0 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );

  if (!appConfig.googleMapsApiKey) {
    return workspaceShell;
  }

  return (
    <APIProvider
      apiKey={appConfig.googleMapsApiKey}
      version="beta"
      libraries={['maps3d', 'marker', 'geometry']}
      language="en"
      region="US"
    >
      {workspaceShell}
    </APIProvider>
  );
}
