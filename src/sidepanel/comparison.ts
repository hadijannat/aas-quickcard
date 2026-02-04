import type { FavoriteAsset, AasSnapshot } from '../shared/types';

/**
 * Comparison row data
 */
export type ComparisonRow = {
  property: string;
  values: (string | undefined)[];
  isDifferent: boolean;
};

/**
 * Generate comparison data for 2-3 assets
 */
export function compareAssets(favorites: FavoriteAsset[]): ComparisonRow[] {
  if (favorites.length < 2 || favorites.length > 3) {
    throw new Error('Comparison requires 2-3 assets');
  }

  const rows: ComparisonRow[] = [];

  // Basic asset properties
  rows.push(createRow('Name', favorites.map((f) => f.nickname || f.snapshot.asset.displayName)));
  rows.push(createRow('Manufacturer', favorites.map((f) => f.snapshot.asset.manufacturer)));
  rows.push(createRow('Serial Number', favorites.map((f) => f.snapshot.asset.serialNumber)));
  rows.push(createRow('Product', favorites.map((f) => f.snapshot.asset.productDesignation)));
  rows.push(createRow('Asset ID', favorites.map((f) => f.snapshot.asset.assetId)));
  rows.push(createRow('Year', favorites.map((f) => f.snapshot.asset.yearOfConstruction)));
  rows.push(createRow('Lifecycle', favorites.map((f) => f.snapshot.lifecyclePhase)));

  // PCF data
  rows.push(
    createRow(
      'CO₂ Footprint',
      favorites.map((f) => {
        if (f.snapshot.pcf?.co2Equivalent !== undefined) {
          return `${f.snapshot.pcf.co2Equivalent.toFixed(2)} ${f.snapshot.pcf.unit || 'kg CO₂e'}`;
        }
        return undefined;
      })
    )
  );

  // Documents count
  rows.push(createRow('Documents', favorites.map((f) => String(f.snapshot.docs.length))));

  // Contacts count
  rows.push(createRow('Contacts', favorites.map((f) => String(f.snapshot.contacts.length))));

  // Submodels count
  rows.push(
    createRow('Submodels', favorites.map((f) => String(f.snapshot.submodels?.length || 0)))
  );

  // Spare parts count
  rows.push(
    createRow('Spare Parts', favorites.map((f) => String(f.snapshot.spareParts?.length || 0)))
  );

  // Source
  rows.push(
    createRow(
      'Source',
      favorites.map((f) => {
        switch (f.snapshot.source.type) {
          case 'file':
            return f.snapshot.source.filename;
          case 'activeTab':
            return f.snapshot.source.url ? new URL(f.snapshot.source.url).hostname : 'Page';
          case 'paste':
            return 'Pasted JSON';
          default:
            return f.snapshot.source.type;
        }
      })
    )
  );

  // Pinned date
  rows.push(createRow('Pinned', favorites.map((f) => new Date(f.pinnedAt).toLocaleDateString())));

  return rows;
}

/**
 * Create a comparison row
 */
function createRow(property: string, values: (string | undefined)[]): ComparisonRow {
  const normalizedValues = values.map((v) => v || '-');
  const uniqueValues = new Set(normalizedValues);
  const isDifferent = uniqueValues.size > 1;

  return {
    property,
    values: normalizedValues,
    isDifferent,
  };
}

/**
 * Generate HTML table for comparison
 */
export function generateComparisonTable(
  favorites: FavoriteAsset[],
  rows: ComparisonRow[]
): string {
  const headers = favorites.map((f) => {
    const name = f.nickname || f.snapshot.asset.displayName || 'Asset';
    return `<th>${escapeHtml(name)}</th>`;
  });

  const tableRows = rows.map((row) => {
    const cells = row.values.map((val) => {
      const cellClass = row.isDifferent ? 'diff' : 'match';
      return `<td class="${cellClass}">${escapeHtml(val || '-')}</td>`;
    });

    return `<tr>
      <td class="property-name">${escapeHtml(row.property)}</td>
      ${cells.join('')}
    </tr>`;
  });

  return `<table class="comparison-table">
    <thead>
      <tr>
        <th>Property</th>
        ${headers.join('')}
      </tr>
    </thead>
    <tbody>
      ${tableRows.join('')}
    </tbody>
  </table>`;
}

/**
 * Generate markdown table for copy
 */
export function generateComparisonMarkdown(
  favorites: FavoriteAsset[],
  rows: ComparisonRow[]
): string {
  const headers = ['Property', ...favorites.map((f) => f.nickname || f.snapshot.asset.displayName || 'Asset')];
  const divider = headers.map(() => '---');

  const lines: string[] = [];
  lines.push(`| ${headers.join(' | ')} |`);
  lines.push(`| ${divider.join(' | ')} |`);

  for (const row of rows) {
    const cells = [row.property, ...row.values.map((v) => v || '-')];
    lines.push(`| ${cells.join(' | ')} |`);
  }

  return lines.join('\n');
}

/**
 * Get detailed comparison for a specific property
 */
export function compareProperty(
  favorites: FavoriteAsset[],
  accessor: (snapshot: AasSnapshot) => unknown
): { values: unknown[]; allSame: boolean } {
  const values = favorites.map((f) => accessor(f.snapshot));
  const stringified = values.map((v) => JSON.stringify(v));
  const allSame = new Set(stringified).size === 1;

  return { values, allSame };
}

/**
 * Escape HTML for safe rendering
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Find common and different submodels between assets
 */
export function compareSubmodels(
  favorites: FavoriteAsset[]
): { common: string[]; unique: Map<number, string[]> } {
  const submodelSets = favorites.map(
    (f) => new Set(f.snapshot.submodels?.map((sm) => sm.idShort) || [])
  );

  // Find common (intersection of all)
  const common: string[] = [];
  const first = submodelSets[0];
  if (first) {
    for (const sm of first) {
      if (submodelSets.every((set) => set.has(sm))) {
        common.push(sm);
      }
    }
  }

  // Find unique per asset
  const unique = new Map<number, string[]>();
  submodelSets.forEach((set, idx) => {
    const uniqueToThis = [...set].filter(
      (sm) => !submodelSets.some((other, otherIdx) => otherIdx !== idx && other.has(sm))
    );
    if (uniqueToThis.length > 0) {
      unique.set(idx, uniqueToThis);
    }
  });

  return { common, unique };
}
