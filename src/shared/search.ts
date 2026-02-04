import type { FavoriteAsset } from './types';
import { loadFavorites } from './storage';

/**
 * Sort options for favorites
 */
export type SortOption = 'date-desc' | 'date-asc' | 'name-asc' | 'name-desc' | 'manufacturer-asc';

/**
 * Filter options for favorites search
 */
export type FilterOptions = {
  query?: string;
  tags?: string[];
  categories?: string[];
  matchAllTags?: boolean;  // If true, must match ALL tags; if false, match ANY tag
};

/**
 * Search and filter favorites
 */
export async function searchFavorites(
  filters: FilterOptions,
  sort: SortOption = 'date-desc'
): Promise<FavoriteAsset[]> {
  const favorites = await loadFavorites();
  let results = [...favorites];

  // Apply text search
  if (filters.query && filters.query.trim()) {
    const query = filters.query.toLowerCase().trim();
    const queryTerms = query.split(/\s+/);

    results = results.filter((fav) => {
      // Use pre-computed searchable text if available
      const searchText = fav.searchableText || buildSearchText(fav);

      // All terms must match
      return queryTerms.every((term) => searchText.includes(term));
    });
  }

  // Apply tag filter
  if (filters.tags && filters.tags.length > 0) {
    results = results.filter((fav) => {
      if (!fav.tags || fav.tags.length === 0) return false;

      if (filters.matchAllTags) {
        // Must have ALL specified tags
        return filters.tags!.every((tag) => fav.tags!.includes(tag));
      } else {
        // Must have ANY of the specified tags
        return filters.tags!.some((tag) => fav.tags!.includes(tag));
      }
    });
  }

  // Apply category filter
  if (filters.categories && filters.categories.length > 0) {
    results = results.filter((fav) => {
      return fav.category && filters.categories!.includes(fav.category);
    });
  }

  // Sort results
  results = sortFavorites(results, sort);

  return results;
}

/**
 * Build search text for a favorite (fallback if searchableText not set)
 */
function buildSearchText(fav: FavoriteAsset): string {
  const parts: string[] = [];
  const { snapshot } = fav;

  if (snapshot.asset.displayName) parts.push(snapshot.asset.displayName);
  if (snapshot.asset.manufacturer) parts.push(snapshot.asset.manufacturer);
  if (snapshot.asset.serialNumber) parts.push(snapshot.asset.serialNumber);
  if (snapshot.asset.assetId) parts.push(snapshot.asset.assetId);
  if (fav.nickname) parts.push(fav.nickname);
  if (fav.notes) parts.push(fav.notes);
  if (fav.tags) parts.push(...fav.tags);
  if (fav.category) parts.push(fav.category);

  return parts.join(' ').toLowerCase();
}

/**
 * Sort favorites by the specified option
 */
function sortFavorites(favorites: FavoriteAsset[], sort: SortOption): FavoriteAsset[] {
  switch (sort) {
    case 'date-desc':
      return favorites.sort((a, b) => b.pinnedAt - a.pinnedAt);

    case 'date-asc':
      return favorites.sort((a, b) => a.pinnedAt - b.pinnedAt);

    case 'name-asc':
      return favorites.sort((a, b) => {
        const nameA = (a.nickname || a.snapshot.asset.displayName || '').toLowerCase();
        const nameB = (b.nickname || b.snapshot.asset.displayName || '').toLowerCase();
        return nameA.localeCompare(nameB);
      });

    case 'name-desc':
      return favorites.sort((a, b) => {
        const nameA = (a.nickname || a.snapshot.asset.displayName || '').toLowerCase();
        const nameB = (b.nickname || b.snapshot.asset.displayName || '').toLowerCase();
        return nameB.localeCompare(nameA);
      });

    case 'manufacturer-asc':
      return favorites.sort((a, b) => {
        const mfgA = (a.snapshot.asset.manufacturer || '').toLowerCase();
        const mfgB = (b.snapshot.asset.manufacturer || '').toLowerCase();
        return mfgA.localeCompare(mfgB);
      });

    default:
      return favorites;
  }
}

/**
 * Quick search with just text query
 */
export async function quickSearch(query: string): Promise<FavoriteAsset[]> {
  return searchFavorites({ query });
}

/**
 * Get favorites by tag
 */
export async function getFavoritesByTag(tag: string): Promise<FavoriteAsset[]> {
  return searchFavorites({ tags: [tag] });
}

/**
 * Get favorites by category
 */
export async function getFavoritesByCategory(category: string): Promise<FavoriteAsset[]> {
  return searchFavorites({ categories: [category] });
}

/**
 * Get recent favorites (last N)
 */
export async function getRecentFavorites(count: number): Promise<FavoriteAsset[]> {
  const sorted = await searchFavorites({}, 'date-desc');
  return sorted.slice(0, count);
}
