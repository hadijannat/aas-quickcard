import type { FavoriteAsset, UserSettings, UserRole, FieldMapping } from './types';

// Re-export types for convenience
export type { FavoriteAsset, UserSettings, UserRole, FieldMapping };

const STORAGE_KEYS = {
  FAVORITES: 'aas_quickcard_favorites',
  SETTINGS: 'aas_quickcard_settings',
} as const;

// Default field mappings for common AAS property names
export const DEFAULT_FIELD_MAPPINGS: FieldMapping = {
  displayName: [
    'ManufacturerProductDesignation',
    'productDesignation',
    'displayName',
    'name',
    'AssetName',
  ],
  manufacturer: [
    'ManufacturerName',
    'manufacturer',
    'Manufacturer',
    'companyName',
  ],
  serialNumber: [
    'SerialNumber',
    'serialNumber',
    'ManufacturerProductSerialNumber',
  ],
  productDesignation: [
    'ManufacturerProductDesignation',
    'ProductDesignation',
    'productType',
  ],
  assetId: [
    'globalAssetId',
    'assetId',
    'id',
    'identification',
  ],
};

// Default user settings
export const DEFAULT_SETTINGS: UserSettings = {
  currentRole: 'maintenance',
  fieldMappings: DEFAULT_FIELD_MAPPINGS,
};

// Save favorites to chrome.storage.local
export async function saveFavorites(favorites: FavoriteAsset[]): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.FAVORITES]: favorites });
}

// Load favorites from chrome.storage.local
export async function loadFavorites(): Promise<FavoriteAsset[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.FAVORITES);
  return result[STORAGE_KEYS.FAVORITES] ?? [];
}

// Add a favorite asset
export async function addFavorite(snapshot: FavoriteAsset['snapshot'], nickname?: string): Promise<FavoriteAsset> {
  const favorites = await loadFavorites();
  const id = crypto.randomUUID();
  const favorite: FavoriteAsset = {
    id,
    snapshot,
    pinnedAt: Date.now(),
    nickname,
  };
  favorites.push(favorite);
  await saveFavorites(favorites);
  return favorite;
}

// Remove a favorite by ID
export async function removeFavorite(id: string): Promise<void> {
  const favorites = await loadFavorites();
  const filtered = favorites.filter((f) => f.id !== id);
  await saveFavorites(filtered);
}

// Update a favorite's nickname
export async function updateFavoriteNickname(id: string, nickname: string): Promise<void> {
  const favorites = await loadFavorites();
  const favorite = favorites.find((f) => f.id === id);
  if (favorite) {
    favorite.nickname = nickname;
    await saveFavorites(favorites);
  }
}

// Save user settings
export async function saveSettings(settings: UserSettings): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: settings });
}

// Load user settings
export async function loadSettings(): Promise<UserSettings> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
  return result[STORAGE_KEYS.SETTINGS] ?? DEFAULT_SETTINGS;
}

// Update current role
export async function setCurrentRole(role: UserRole): Promise<void> {
  const settings = await loadSettings();
  settings.currentRole = role;
  await saveSettings(settings);
}

// Update field mappings
export async function setFieldMappings(mappings: FieldMapping): Promise<void> {
  const settings = await loadSettings();
  settings.fieldMappings = mappings;
  await saveSettings(settings);
}
