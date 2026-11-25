import { CLIENT_PROFILES, DOCUMENT_CATALOG } from '../data/clientProfiles';
import {
  AuditSummary,
  DocumentKey,
  DocumentRecord,
  DriveSyncMetadata,
  SubmittalPackage,
} from '../types/submittal';

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
export const ROOT_FOLDER_NAME = 'FlightDossier Submittal Packages';
export const PACKAGE_FILE_NAME = 'submittal-package.json';
const FOLDER_MIME = 'application/vnd.google-apps.folder';

export interface DriveUserProfile {
  displayName: string;
  emailAddress: string;
  photoLink?: string;
}

export interface DriveFileSummary {
  id: string;
  name: string;
  mimeType?: string;
  modifiedTime?: string;
  webViewLink?: string;
  parents?: string[];
}

export interface DriveMissionFolderEntry {
  folder: DriveFileSummary;
  packageFile: DriveFileSummary | null;
  artifacts: DriveFileSummary[];
}

export interface PickerSelection {
  id: string;
  name: string;
  mimeType: string;
  url?: string;
}

export class DriveAuthExpiredError extends Error {
  constructor(message = 'Your Google Drive session expired. Please reconnect to continue.') {
    super(message);
    this.name = 'DriveAuthExpiredError';
  }
}

// Local structural interfaces for Google Identity Services & Google Picker globals
interface TokenResponse {
  access_token?: string;
  expires_in?: number | string;
  error?: string;
  error_description?: string;
}

interface TokenClient {
  requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
}

interface GisWindow {
  google?: {
    accounts?: {
      oauth2?: {
        initTokenClient: (config: {
          client_id: string;
          scope: string;
          callback: (resp: TokenResponse) => void;
          error_callback?: (err: { type?: string; message?: string }) => void;
        }) => TokenClient;
        revoke: (token: string, done?: () => void) => void;
      };
    };
    picker?: {
      ViewId: {
        DOCS: string;
        FOLDERS: string;
      };
      Action: {
        PICKED: string;
        CANCEL: string;
      };
      DocsView: new (viewId?: string) => {
        setIncludeFolders: (include: boolean) => unknown;
        setSelectFolderEnabled: (enabled: boolean) => unknown;
        setMimeTypes: (mimeTypes: string) => unknown;
        setParent: (parentId: string) => unknown;
      };
      PickerBuilder: new () => {
        addView: (view: unknown) => unknown;
        setOAuthToken: (token: string) => unknown;
        setOrigin: (origin: string) => unknown;
        setTitle: (title: string) => unknown;
        setCallback: (cb: (data: {
          action: string;
          docs?: Array<{ id: string; name: string; mimeType: string; url?: string }>;
        }) => void) => unknown;
        build: () => { setVisible: (visible: boolean) => void };
      };
    };
  };
  gapi?: {
    load: (apiName: string, options: { callback: () => void; onerror?: () => void }) => void;
  };
}

// Strictly in-memory OAuth token cache (never persisted to localStorage/sessionStorage)
let cachedAccessToken: string | null = null;
let cachedTokenExpiresAt = 0;

export function getInMemoryAccessToken(): string | null {
  if (!cachedAccessToken) return null;
  if (Date.now() >= cachedTokenExpiresAt - 45_000) {
    return null;
  }
  return cachedAccessToken;
}

export function isAccessTokenNearExpiry(): boolean {
  return Boolean(cachedAccessToken) && Date.now() >= cachedTokenExpiresAt - 45_000;
}

export function clearInMemoryToken(): void {
  cachedAccessToken = null;
  cachedTokenExpiresAt = 0;
}

function getGisWindow(): GisWindow {
  return window as unknown as GisWindow;
}

function loadScriptOnce(src: string, checkReady: () => boolean): Promise<void> {
  if (checkReady()) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const existing = document.querySelector(`script[src="${src}"]`);
    if (!existing) {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    const interval = window.setInterval(() => {
      if (checkReady()) {
        window.clearInterval(interval);
        resolve();
      } else if (Date.now() - startTime > 12_000) {
        window.clearInterval(interval);
        reject(new Error(`Timed out loading Google script (${src}). Check your network connection.`));
      }
    }, 120);
  });
}

async function ensureGsiLoaded(): Promise<void> {
  await loadScriptOnce('https://accounts.google.com/gsi/client', () =>
    Boolean(getGisWindow().google?.accounts?.oauth2?.initTokenClient)
  );
}

async function ensurePickerLoaded(): Promise<void> {
  await loadScriptOnce('https://apis.google.com/js/api.js', () => Boolean(getGisWindow().gapi?.load));
  if (getGisWindow().google?.picker?.PickerBuilder) return;

  await new Promise<void>((resolve, reject) => {
    const gapi = getGisWindow().gapi;
    if (!gapi) {
      reject(new Error('Google API loader is unavailable.'));
      return;
    }
    gapi.load('picker', {
      callback: () => resolve(),
      onerror: () => reject(new Error('Failed to load Google Picker library.')),
    });
  });
}

export async function requestDriveAccessToken(
  clientId: string,
  prompt: '' | 'consent' | 'select_account' = 'select_account'
): Promise<string> {
  if (!clientId.trim()) {
    throw new Error('A Google OAuth Client ID is required. Configure one in Settings.');
  }

  await ensureGsiLoaded();
  const oauth2 = getGisWindow().google?.accounts?.oauth2;
  if (!oauth2) {
    throw new Error('Google Identity Services failed to initialize.');
  }

  return new Promise<string>((resolve, reject) => {
    let settled = false;
    const tokenClient = oauth2.initTokenClient({
      client_id: clientId.trim(),
      scope: DRIVE_SCOPE,
      callback: (response) => {
        if (settled) return;
        settled = true;
        if (response.error || !response.access_token) {
          reject(
            new Error(
              response.error_description ||
                response.error ||
                'Google authorization was not granted.'
            )
          );
          return;
        }
        const expiresInSec = Number(response.expires_in) || 3500;
        cachedAccessToken = response.access_token;
        cachedTokenExpiresAt = Date.now() + expiresInSec * 1000;
        resolve(response.access_token);
      },
      error_callback: (err) => {
        if (settled) return;
        settled = true;
        if (err?.type === 'popup_closed') {
          reject(new Error('Google sign-in popup was closed before completing authentication.'));
        } else if (err?.type === 'popup_failed_to_open') {
          reject(new Error('Sign-in popup was blocked by the browser. Please allow popups and retry.'));
        } else {
          reject(new Error(err?.message || 'Unable to start Google sign-in.'));
        }
      },
    });

    tokenClient.requestAccessToken({ prompt });
  });
}

export function disconnectDriveSession(): void {
  const token = cachedAccessToken;
  clearInMemoryToken();
  const oauth2 = getGisWindow().google?.accounts?.oauth2;
  if (token && oauth2?.revoke) {
    try {
      oauth2.revoke(token);
    } catch {
      // Ignore revoke errors
    }
  }
}

async function driveFetch(url: string, accessToken: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${accessToken}`);

  const response = await fetch(url, { ...init, headers });
  if (response.status === 401) {
    clearInMemoryToken();
    throw new DriveAuthExpiredError();
  }
  if (!response.ok) {
    let detail = `Google Drive request failed (${response.status})`;
    try {
      const errBody = (await response.json()) as { error?: { message?: string } };
      if (errBody?.error?.message) {
        detail = errBody.error.message;
      }
    } catch {
      // Keep status message
    }
    throw new Error(detail);
  }
  return response;
}

function escapeDriveQueryValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export function sanitizeFolderSegment(value: string): string {
  return value
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

export function buildMissionFolderName(pkg: SubmittalPackage): string {
  const baseName = sanitizeFolderSegment(pkg.title || pkg.site.siteName || pkg.referenceCode || 'UAS Mission');
  const datePart = pkg.operations.plannedDate || pkg.updatedAt || new Date().toISOString().slice(0, 10);
  return `${baseName} - ${datePart}`;
}

export async function fetchDriveUserProfile(accessToken: string): Promise<DriveUserProfile> {
  const res = await driveFetch(
    'https://www.googleapis.com/drive/v3/about?fields=user(displayName,emailAddress,photoLink)',
    accessToken
  );
  const data = (await res.json()) as { user?: DriveUserProfile };
  return {
    displayName: data.user?.displayName || 'Google Drive User',
    emailAddress: data.user?.emailAddress || 'Connected Account',
    photoLink: data.user?.photoLink,
  };
}

export async function findOrCreateRootFolder(accessToken: string): Promise<DriveFileSummary> {
  const q = `name = '${escapeDriveQueryValue(ROOT_FOLDER_NAME)}' and mimeType = '${FOLDER_MIME}' and trashed = false`;
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    q
  )}&fields=files(id,name,mimeType,modifiedTime,webViewLink)&orderBy=modifiedTime desc&pageSize=10`;

  const searchRes = await driveFetch(searchUrl, accessToken);
  const searchData = (await searchRes.json()) as { files?: DriveFileSummary[] };
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0];
  }

  const createRes = await driveFetch(
    'https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType,modifiedTime,webViewLink',
    accessToken,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: ROOT_FOLDER_NAME,
        mimeType: FOLDER_MIME,
      }),
    }
  );
  return (await createRes.json()) as DriveFileSummary;
}

export async function findOrCreateMissionFolder(
  accessToken: string,
  rootFolderId: string,
  folderName: string
): Promise<DriveFileSummary> {
  const cleanName = sanitizeFolderSegment(folderName) || 'UAS Mission';
  const q = `'${escapeDriveQueryValue(rootFolderId)}' in parents and name = '${escapeDriveQueryValue(
    cleanName
  )}' and mimeType = '${FOLDER_MIME}' and trashed = false`;
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    q
  )}&fields=files(id,name,mimeType,modifiedTime,webViewLink)&pageSize=5`;

  const searchRes = await driveFetch(searchUrl, accessToken);
  const searchData = (await searchRes.json()) as { files?: DriveFileSummary[] };
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0];
  }

  const createRes = await driveFetch(
    'https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType,modifiedTime,webViewLink',
    accessToken,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: cleanName,
        mimeType: FOLDER_MIME,
        parents: [rootFolderId],
      }),
    }
  );
  return (await createRes.json()) as DriveFileSummary;
}

export async function findFileInFolder(
  accessToken: string,
  folderId: string,
  fileName: string
): Promise<DriveFileSummary | null> {
  const q = `'${escapeDriveQueryValue(folderId)}' in parents and name = '${escapeDriveQueryValue(
    fileName
  )}' and trashed = false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    q
  )}&fields=files(id,name,mimeType,modifiedTime,webViewLink,parents)&orderBy=modifiedTime desc&pageSize=5`;
  const res = await driveFetch(url, accessToken);
  const data = (await res.json()) as { files?: DriveFileSummary[] };
  return data.files && data.files.length > 0 ? data.files[0] : null;
}

export async function listMissionFoldersAndPackages(
  accessToken: string
): Promise<{ rootFolder: DriveFileSummary; entries: DriveMissionFolderEntry[] }> {
  const rootFolder = await findOrCreateRootFolder(accessToken);

  const foldersQ = `'${escapeDriveQueryValue(
    rootFolder.id
  )}' in parents and mimeType = '${FOLDER_MIME}' and trashed = false`;
  const foldersUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    foldersQ
  )}&fields=files(id,name,mimeType,modifiedTime,webViewLink)&orderBy=modifiedTime desc&pageSize=50`;

  const foldersRes = await driveFetch(foldersUrl, accessToken);
  const foldersData = (await foldersRes.json()) as { files?: DriveFileSummary[] };
  const subfolders = foldersData.files || [];

  const entries = await Promise.all(
    subfolders.map(async (folder): Promise<DriveMissionFolderEntry> => {
      const filesQ = `'${escapeDriveQueryValue(folder.id)}' in parents and trashed = false`;
      const filesUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
        filesQ
      )}&fields=files(id,name,mimeType,modifiedTime,webViewLink,parents)&orderBy=modifiedTime desc&pageSize=30`;
      const filesRes = await driveFetch(filesUrl, accessToken);
      const filesData = (await filesRes.json()) as { files?: DriveFileSummary[] };
      const children = filesData.files || [];

      const packageFile =
        children.find((f) => f.name === PACKAGE_FILE_NAME) ||
        children.find((f) => f.name.toLowerCase().endsWith('.json')) ||
        null;

      const artifacts = children.filter((f) => f.id !== packageFile?.id && f.mimeType !== FOLDER_MIME);

      return {
        folder,
        packageFile,
        artifacts,
      };
    })
  );

  return { rootFolder, entries };
}

function buildMultipartBody(
  metadata: Record<string, unknown>,
  content: Blob | string,
  mimeType: string
): { body: Blob; boundary: string } {
  const boundary = `flightdossier_boundary_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const metaPart =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${mimeType}\r\n\r\n`;
  const closeDelim = `\r\n--${boundary}--`;

  const blob = new Blob([metaPart, content, closeDelim], {
    type: `multipart/related; boundary=${boundary}`,
  });

  return { body: blob, boundary };
}

export async function uploadMultipartFile(
  accessToken: string,
  options: {
    folderId: string;
    fileName: string;
    mimeType: string;
    content: Blob | string;
    existingFileId?: string;
  }
): Promise<DriveFileSummary> {
  const { folderId, fileName, mimeType, content, existingFileId } = options;
  const isUpdate = Boolean(existingFileId);

  const metadata: Record<string, unknown> = isUpdate
    ? { name: fileName, mimeType }
    : { name: fileName, mimeType, parents: [folderId] };

  const { body, boundary } = buildMultipartBody(metadata, content, mimeType);
  const endpoint = isUpdate
    ? `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(
        existingFileId!
      )}?uploadType=multipart&fields=id,name,mimeType,modifiedTime,webViewLink,parents`
    : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,modifiedTime,webViewLink,parents`;

  const res = await driveFetch(endpoint, accessToken, {
    method: isUpdate ? 'PATCH' : 'POST',
    headers: {
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  return (await res.json()) as DriveFileSummary;
}

export async function savePackageToDrive(
  accessToken: string,
  pkg: SubmittalPackage,
  audit: AuditSummary,
  target: {
    rootFolderId?: string;
    folderId: string;
    folderName: string;
    existingFileId?: string;
  }
): Promise<{ file: DriveFileSummary; driveSync: DriveSyncMetadata }> {
  const nowIso = new Date().toISOString();
  const preSyncMeta: DriveSyncMetadata = {
    rootFolderId: target.rootFolderId,
    folderId: target.folderId,
    folderName: target.folderName,
    fileId: target.existingFileId,
    fileName: PACKAGE_FILE_NAME,
    lastSyncedAt: nowIso,
  };

  const payload = {
    schemaVersion: '1.0',
    application: 'FlightDossier',
    exportedAt: nowIso,
    submittalPackage: {
      ...pkg,
      driveSync: preSyncMeta,
    },
    complianceAuditSummary: {
      readinessStatus: audit.readinessStatus,
      blockers: audit.blockers,
      missingDocuments: audit.missingDocs,
      warnings: audit.warnings,
      passedChecks: audit.passed,
      totalChecks: audit.totalChecks,
    },
  };

  const savedFile = await uploadMultipartFile(accessToken, {
    folderId: target.folderId,
    fileName: PACKAGE_FILE_NAME,
    mimeType: 'application/json',
    content: JSON.stringify(payload, null, 2),
    existingFileId: target.existingFileId,
  });

  const finalSync: DriveSyncMetadata = {
    rootFolderId: target.rootFolderId,
    folderId: target.folderId,
    folderName: target.folderName,
    fileId: savedFile.id,
    fileName: savedFile.name,
    lastSyncedAt: savedFile.modifiedTime || nowIso,
    webViewLink: savedFile.webViewLink,
  };

  return { file: savedFile, driveSync: finalSync };
}

export async function getFileMetadata(
  accessToken: string,
  fileId: string
): Promise<DriveFileSummary> {
  const res = await driveFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
      fileId
    )}?fields=id,name,mimeType,modifiedTime,webViewLink,parents`,
    accessToken
  );
  return (await res.json()) as DriveFileSummary;
}

function normalizeLoadedPackage(
  raw: unknown,
  driveSync: DriveSyncMetadata
): SubmittalPackage {
  if (!raw || typeof raw !== 'object') {
    throw new Error('The selected Drive file does not contain a valid FlightDossier JSON object.');
  }

  const candidate =
    'submittalPackage' in raw && raw.submittalPackage && typeof raw.submittalPackage === 'object'
      ? (raw.submittalPackage as Partial<SubmittalPackage>)
      : (raw as Partial<SubmittalPackage>);

  if (!candidate.site || !candidate.operations) {
    throw new Error(
      'Selected JSON is missing required FlightDossier site or operations sections.'
    );
  }

  const profileId =
    candidate.clientProfileId && candidate.clientProfileId in CLIENT_PROFILES
      ? candidate.clientProfileId
      : 'commercial_construction';

  const mergedDocs = {} as Record<DocumentKey, DocumentRecord>;
  DOCUMENT_CATALOG.forEach((docDef) => {
    const emptyRec: DocumentRecord = {
      attached: false,
      referenceNumber: '',
      expirationDate: '',
      notes: '',
    };
    const incoming = candidate.documents?.[docDef.key];
    mergedDocs[docDef.key] = incoming ? { ...emptyRec, ...incoming } : emptyRec;
  });

  return {
    id: candidate.id || `pkg-drive-${Date.now()}`,
    referenceCode: candidate.referenceCode || `FD-DRV-${Date.now().toString().slice(-4)}`,
    title: candidate.title || driveSync.folderName || 'Loaded Drive Submittal',
    updatedAt: candidate.updatedAt || new Date().toISOString().slice(0, 10),
    clientProfileId: profileId,
    clientRequirements: {
      ...CLIENT_PROFILES[profileId].defaults,
      ...(candidate.clientRequirements || {}),
    },
    site: candidate.site,
    operations: candidate.operations,
    documents: mergedDocs,
    mitigations: Array.isArray(candidate.mitigations) ? candidate.mitigations : [],
    mapElements: Array.isArray(candidate.mapElements) ? candidate.mapElements : [],
    driveSync,
  };
}

export async function loadPackageFromDriveFile(
  accessToken: string,
  fileId: string,
  knownFolder?: { id: string; name: string }
): Promise<SubmittalPackage> {
  const meta = await getFileMetadata(accessToken, fileId);
  let folderId = knownFolder?.id || meta.parents?.[0] || '';
  let folderName = knownFolder?.name || 'Google Drive';

  if (!knownFolder && folderId) {
    try {
      const parentMeta = await getFileMetadata(accessToken, folderId);
      folderName = parentMeta.name || folderName;
    } catch {
      // Parent folder metadata may not be accessible if only file was picked
    }
  }

  const contentRes = await driveFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
    accessToken
  );
  const rawJson = (await contentRes.json()) as unknown;

  const driveSync: DriveSyncMetadata = {
    folderId,
    folderName,
    fileId: meta.id,
    fileName: meta.name,
    lastSyncedAt: meta.modifiedTime || new Date().toISOString(),
    webViewLink: meta.webViewLink,
  };

  return normalizeLoadedPackage(rawJson, driveSync);
}

export async function openGooglePicker(options: {
  accessToken: string;
  mode: 'folder' | 'json';
  title?: string;
}): Promise<PickerSelection | null> {
  await ensurePickerLoaded();

  const pickerApi = getGisWindow().google?.picker;
  if (!pickerApi) {
    throw new Error('Google Picker is unavailable in this browser session.');
  }

  const pickerOrigin =
    window.location.ancestorOrigins && window.location.ancestorOrigins.length > 0
      ? window.location.ancestorOrigins[window.location.ancestorOrigins.length - 1]
      : window.location.origin;

  return new Promise<PickerSelection | null>((resolve) => {
    const view =
      options.mode === 'folder'
        ? new pickerApi.DocsView(pickerApi.ViewId.FOLDERS)
        : new pickerApi.DocsView(pickerApi.ViewId.DOCS);

    if (options.mode === 'folder') {
      view.setIncludeFolders(true);
      view.setSelectFolderEnabled(true);
      view.setMimeTypes(FOLDER_MIME);
    } else {
      view.setIncludeFolders(true);
      view.setMimeTypes('application/json');
    }

    const builder = new pickerApi.PickerBuilder();
    builder.addView(view);
    builder.setOAuthToken(options.accessToken);
    builder.setOrigin(pickerOrigin);
    if (options.title) {
      builder.setTitle(options.title);
    }
    builder.setCallback((data) => {
      if (data.action === pickerApi.Action.PICKED && data.docs && data.docs[0]) {
        const picked = data.docs[0];
        resolve({
          id: picked.id,
          name: picked.name,
          mimeType: picked.mimeType,
          url: picked.url,
        });
      } else if (data.action === pickerApi.Action.CANCEL) {
        resolve(null);
      }
    });

    const picker = builder.build();
    picker.setVisible(true);
  });
}
