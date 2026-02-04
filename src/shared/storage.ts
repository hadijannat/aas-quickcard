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

// ====== Enhanced Favorites Functions ======

// Build searchable text from a favorite asset
function buildSearchableText(favorite: FavoriteAsset): string {
  const parts: string[] = [];
  const { snapshot } = favorite;

  // Asset info
  if (snapshot.asset.displayName) parts.push(snapshot.asset.displayName);
  if (snapshot.asset.manufacturer) parts.push(snapshot.asset.manufacturer);
  if (snapshot.asset.serialNumber) parts.push(snapshot.asset.serialNumber);
  if (snapshot.asset.assetId) parts.push(snapshot.asset.assetId);
  if (snapshot.asset.productDesignation) parts.push(snapshot.asset.productDesignation);

  // Nickname and notes
  if (favorite.nickname) parts.push(favorite.nickname);
  if (favorite.notes) parts.push(favorite.notes);

  // Tags
  if (favorite.tags) parts.push(...favorite.tags);

  // Category
  if (favorite.category) parts.push(favorite.category);

  // Submodel names
  if (snapshot.submodels) {
    for (const sm of snapshot.submodels) {
      parts.push(sm.idShort);
      if (sm.templateName) parts.push(sm.templateName);
    }
  }

  return parts.join(' ').toLowerCase();
}

// Add a favorite asset with searchable text
export async function addFavoriteEnhanced(
  snapshot: FavoriteAsset['snapshot'],
  options?: { nickname?: string; tags?: string[]; category?: string; notes?: string }
): Promise<FavoriteAsset> {
  const favorites = await loadFavorites();
  const id = crypto.randomUUID();
  const favorite: FavoriteAsset = {
    id,
    snapshot,
    pinnedAt: Date.now(),
    nickname: options?.nickname,
    tags: options?.tags,
    category: options?.category,
    notes: options?.notes,
  };

  // Build searchable text
  favorite.searchableText = buildSearchableText(favorite);

  favorites.push(favorite);
  await saveFavorites(favorites);
  return favorite;
}

// Update favorite with enhanced options
export async function updateFavorite(
  id: string,
  updates: {
    nickname?: string;
    tags?: string[];
    category?: string;
    notes?: string;
  }
): Promise<FavoriteAsset | undefined> {
  const favorites = await loadFavorites();
  const favorite = favorites.find((f) => f.id === id);

  if (!favorite) return undefined;

  if (updates.nickname !== undefined) favorite.nickname = updates.nickname;
  if (updates.tags !== undefined) favorite.tags = updates.tags;
  if (updates.category !== undefined) favorite.category = updates.category;
  if (updates.notes !== undefined) favorite.notes = updates.notes;

  // Rebuild searchable text
  favorite.searchableText = buildSearchableText(favorite);

  await saveFavorites(favorites);
  return favorite;
}

// Add tags to a favorite
export async function addTags(id: string, tags: string[]): Promise<void> {
  const favorites = await loadFavorites();
  const favorite = favorites.find((f) => f.id === id);

  if (favorite) {
    const existingTags = favorite.tags || [];
    const newTags = [...new Set([...existingTags, ...tags])];
    favorite.tags = newTags;
    favorite.searchableText = buildSearchableText(favorite);
    await saveFavorites(favorites);
  }
}

// Remove tags from a favorite
export async function removeTags(id: string, tags: string[]): Promise<void> {
  const favorites = await loadFavorites();
  const favorite = favorites.find((f) => f.id === id);

  if (favorite && favorite.tags) {
    favorite.tags = favorite.tags.filter((t) => !tags.includes(t));
    favorite.searchableText = buildSearchableText(favorite);
    await saveFavorites(favorites);
  }
}

// Get all unique tags across favorites
export async function getAllTags(): Promise<string[]> {
  const favorites = await loadFavorites();
  const tagSet = new Set<string>();

  for (const fav of favorites) {
    if (fav.tags) {
      for (const tag of fav.tags) {
        tagSet.add(tag);
      }
    }
  }

  return Array.from(tagSet).sort();
}

// Get all unique categories across favorites
export async function getAllCategories(): Promise<string[]> {
  const favorites = await loadFavorites();
  const categorySet = new Set<string>();

  for (const fav of favorites) {
    if (fav.category) {
      categorySet.add(fav.category);
    }
  }

  return Array.from(categorySet).sort();
}

// Calculate storage usage
export async function getStorageUsage(): Promise<{ used: number; total: number; percentage: number }> {
  // Chrome extension storage.local has a 10MB limit
  const TOTAL_BYTES = 10 * 1024 * 1024; // 10MB

  const data = await chrome.storage.local.get(null);
  const usedBytes = new Blob([JSON.stringify(data)]).size;

  return {
    used: usedBytes,
    total: TOTAL_BYTES,
    percentage: Math.round((usedBytes / TOTAL_BYTES) * 100),
  };
}

// Format bytes for display
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
