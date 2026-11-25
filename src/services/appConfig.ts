export const DEFAULT_GOOGLE_CLIENT_ID =
  '239679138847-7lkuddg93hks43hc2b9v8mblputonmmo.apps.googleusercontent.com';

const BYOK_STORAGE_KEY = 'flightdossier_byok_settings_v1';

export interface ByokSettings {
  googleMapsApiKey: string;
  googleClientId: string;
}

export type ConfigSource = 'override' | 'env' | 'default' | 'none';

export interface ResolvedAppConfig {
  googleClientId: string;
  googleClientIdSource: ConfigSource;
  googleMapsApiKey: string;
  googleMapsApiKeySource: ConfigSource;
  envMapsApiKey: string;
  envGoogleClientId: string;
  overrides: ByokSettings;
}

function getEnvMapsApiKey(): string {
  return ((import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) || '').trim();
}

function getEnvGoogleClientId(): string {
  return ((import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) || '').trim();
}

export function loadByokOverrides(): ByokSettings {
  try {
    const raw = localStorage.getItem(BYOK_STORAGE_KEY);
    if (!raw) {
      return { googleMapsApiKey: '', googleClientId: '' };
    }
    const parsed = JSON.parse(raw) as Partial<ByokSettings>;
    return {
      googleMapsApiKey: typeof parsed.googleMapsApiKey === 'string' ? parsed.googleMapsApiKey.trim() : '',
      googleClientId: typeof parsed.googleClientId === 'string' ? parsed.googleClientId.trim() : '',
    };
  } catch {
    return { googleMapsApiKey: '', googleClientId: '' };
  }
}

export function saveByokOverrides(settings: ByokSettings): ByokSettings {
  const sanitized: ByokSettings = {
    googleMapsApiKey: settings.googleMapsApiKey.trim(),
    googleClientId: settings.googleClientId.trim(),
  };
  try {
    if (!sanitized.googleMapsApiKey && !sanitized.googleClientId) {
      localStorage.removeItem(BYOK_STORAGE_KEY);
    } else {
      localStorage.setItem(BYOK_STORAGE_KEY, JSON.stringify(sanitized));
    }
  } catch {
    // Ignore storage quota errors
  }
  return sanitized;
}

export function resetByokOverrides(): void {
  try {
    localStorage.removeItem(BYOK_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

export function resolveAppConfig(): ResolvedAppConfig {
  const overrides = loadByokOverrides();
  const envMapsApiKey = getEnvMapsApiKey();
  const envGoogleClientId = getEnvGoogleClientId();

  let googleClientId = DEFAULT_GOOGLE_CLIENT_ID;
  let googleClientIdSource: ConfigSource = 'default';
  if (overrides.googleClientId) {
    googleClientId = overrides.googleClientId;
    googleClientIdSource = 'override';
  } else if (envGoogleClientId) {
    googleClientId = envGoogleClientId;
    googleClientIdSource = 'env';
  }

  let googleMapsApiKey = '';
  let googleMapsApiKeySource: ConfigSource = 'none';
  if (overrides.googleMapsApiKey) {
    googleMapsApiKey = overrides.googleMapsApiKey;
    googleMapsApiKeySource = 'override';
  } else if (envMapsApiKey) {
    googleMapsApiKey = envMapsApiKey;
    googleMapsApiKeySource = 'env';
  }

  return {
    googleClientId,
    googleClientIdSource,
    googleMapsApiKey,
    googleMapsApiKeySource,
    envMapsApiKey,
    envGoogleClientId,
    overrides,
  };
}
