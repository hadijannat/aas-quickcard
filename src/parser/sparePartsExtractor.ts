import type { SparePart, SparePartCategory } from '../shared/types';

/**
 * Semantic IDs that identify spare parts submodels
 */
const SPARE_PARTS_SEMANTIC_IDS = [
  'https://admin-shell.io/zvei/spareparts/1/0/SpareParts',
  'https://admin-shell.io/idta/spareparts/1/0/SpareParts',
];

/**
 * idShort patterns that indicate spare parts data
 */
const SPARE_PARTS_IDSHORT_PATTERNS = [
  /^spare.*part/i,
  /^ersatzteil/i,  // German
  /^replacement.*part/i,
  /^consumable/i,
  /^wear.*part/i,
  /^parts.*list/i,
];

/**
 * Property patterns for spare part data
 */
const PART_PROPERTY_PATTERNS = {
  partNumber: [
    /^part.*number$/i,
    /^partnumber$/i,
    /^part.*no$/i,
    /^article.*number$/i,
    /^item.*number$/i,
    /^sku$/i,
    /^sachnummer$/i,  // German
    /^artikelnummer$/i,  // German
  ],
  description: [
    /^description$/i,
    /^part.*description$/i,
    /^name$/i,
    /^designation$/i,
    /^bezeichnung$/i,  // German
  ],
  manufacturerPartNumber: [
    /^manufacturer.*part/i,
    /^oem.*part/i,
    /^original.*part/i,
    /^hersteller.*nummer/i,  // German
  ],
  category: [
    /^category$/i,
    /^part.*category$/i,
    /^type$/i,
    /^kategorie$/i,  // German
  ],
  quantity: [
    /^quantity$/i,
    /^qty$/i,
    /^amount$/i,
    /^count$/i,
    /^menge$/i,  // German
  ],
  unit: [
    /^unit$/i,
    /^unit.*of.*measure$/i,
    /^einheit$/i,  // German
  ],
  leadTime: [
    /^lead.*time$/i,
    /^delivery.*time$/i,
    /^lieferzeit$/i,  // German
  ],
  supplier: [
    /^supplier$/i,
    /^vendor$/i,
    /^lieferant$/i,  // German
  ],
};

/**
 * Category classification keywords
 */
const CATEGORY_KEYWORDS: Record<SparePartCategory, RegExp[]> = {
  wear: [
    /wear/i,
    /verschlei/i,  // German Verschleiß
    /bearing/i,
    /lager/i,
    /seal/i,
    /dichtung/i,
    /brush/i,
    /belt/i,
    /riemen/i,
  ],
  consumable: [
    /consumable/i,
    /verbrauch/i,  // German
    /filter/i,
    /lubricant/i,
    /schmierstoff/i,
    /oil/i,
    /öl/i,
    /grease/i,
    /fett/i,
  ],
  replacement: [
    /replacement/i,
    /ersatz/i,  // German
    /spare/i,
    /backup/i,
  ],
  other: [],
};

/**
 * Extract spare parts from AAS JSON structure
 */
export function extractSpareParts(parsed: unknown): SparePart[] {
  if (!parsed || typeof parsed !== 'object') {
    return [];
  }

  const spareParts: SparePart[] = [];

  // First, look for dedicated spare parts submodel
  const sparePartsSubmodel = findSparePartsSubmodel(parsed);
  if (sparePartsSubmodel) {
    spareParts.push(...extractPartsFromSubmodel(sparePartsSubmodel));
  }

  // Also search for spare parts elements anywhere in the structure
  const additionalParts = findSparePartsElements(parsed);
  for (const part of additionalParts) {
    // Avoid duplicates by checking part number
    if (!spareParts.some((sp) => sp.partNumber === part.partNumber)) {
      spareParts.push(part);
    }
  }

  return spareParts;
}

/**
 * Find spare parts submodel in AAS structure
 */
function findSparePartsSubmodel(obj: unknown): Record<string, unknown> | undefined {
  if (!obj || typeof obj !== 'object') return undefined;

  const record = obj as Record<string, unknown>;

  // Check submodels array
  const submodels = record.submodels as unknown[];
  if (Array.isArray(submodels)) {
    for (const sm of submodels) {
      if (isSparePartsSubmodel(sm)) {
        return sm as Record<string, unknown>;
      }
    }
  }

  // Check in AAS package structure
  if (Array.isArray(record.assetAdministrationShells)) {
    for (const aas of record.assetAdministrationShells) {
      if (aas && typeof aas === 'object') {
        const aasRecord = aas as Record<string, unknown>;
        if (Array.isArray(aasRecord.submodels)) {
          for (const sm of aasRecord.submodels) {
            if (isSparePartsSubmodel(sm)) {
              return sm as Record<string, unknown>;
            }
          }
        }
      }
    }
  }

  return undefined;
}

/**
 * Check if a submodel is a spare parts submodel
 */
function isSparePartsSubmodel(sm: unknown): boolean {
  if (!sm || typeof sm !== 'object') return false;

  const record = sm as Record<string, unknown>;

  // Check semantic ID
  const semanticId = extractSemanticId(record);
  if (semanticId && SPARE_PARTS_SEMANTIC_IDS.includes(semanticId)) {
    return true;
  }

  // Check idShort patterns
  const idShort = record.idShort as string;
  if (idShort) {
    for (const pattern of SPARE_PARTS_IDSHORT_PATTERNS) {
      if (pattern.test(idShort)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Extract semantic ID from object
 */
function extractSemanticId(record: Record<string, unknown>): string | undefined {
  if (typeof record.semanticId === 'string') {
    return record.semanticId;
  }

  if (record.semanticId && typeof record.semanticId === 'object') {
    const semId = record.semanticId as Record<string, unknown>;
    if (Array.isArray(semId.keys) && semId.keys.length > 0) {
      const firstKey = semId.keys[0] as { value?: string };
      if (firstKey.value) return firstKey.value;
    }
    if (typeof semId.value === 'string') {
      return semId.value;
    }
  }

  return undefined;
}

/**
 * Extract spare parts from a submodel
 */
function extractPartsFromSubmodel(submodel: Record<string, unknown>): SparePart[] {
  const parts: SparePart[] = [];

  const elements = submodel.submodelElements as unknown[];
  if (!Array.isArray(elements)) {
    return parts;
  }

  for (const el of elements) {
    if (!el || typeof el !== 'object') continue;

    const elRecord = el as Record<string, unknown>;
    const modelType = elRecord.modelType as string | { name?: string };

    // Look for SubmodelElementCollection or Entity elements (each represents a part)
    let typeStr = '';
    if (typeof modelType === 'string') {
      typeStr = modelType;
    } else if (modelType && typeof modelType === 'object' && modelType.name) {
      typeStr = modelType.name;
    }

    if (typeStr === 'SubmodelElementCollection' || typeStr === 'Entity') {
      const part = extractSinglePart(elRecord);
      if (part) {
        parts.push(part);
      }
    }
  }

  return parts;
}

/**
 * Extract a single spare part from an element collection
 */
function extractSinglePart(element: Record<string, unknown>): SparePart | null {
  const part: Partial<SparePart> = {};

  // Try to get values from nested elements
  const nestedElements = (element.value as unknown[]) || (element.statements as unknown[]);

  if (Array.isArray(nestedElements)) {
    for (const nested of nestedElements) {
      if (!nested || typeof nested !== 'object') continue;

      const nestedRecord = nested as Record<string, unknown>;
      const idShort = nestedRecord.idShort as string;
      const value = nestedRecord.value;

      if (!idShort || value === undefined || value === null) continue;

      // Match against property patterns
      for (const [key, patterns] of Object.entries(PART_PROPERTY_PATTERNS)) {
        for (const pattern of patterns) {
          if (pattern.test(idShort)) {
            assignPartValue(part, key as keyof SparePart, value);
            break;
          }
        }
      }
    }
  }

  // Use element idShort as part number fallback
  if (!part.partNumber && element.idShort) {
    part.partNumber = element.idShort as string;
  }

  // Require at least a part number
  if (!part.partNumber) {
    return null;
  }

  // Classify category if not already set
  if (!part.category) {
    part.category = classifyPartCategory(part);
  }

  return part as SparePart;
}

/**
 * Assign a value to spare part with appropriate type conversion
 */
function assignPartValue(part: Partial<SparePart>, key: keyof SparePart, value: unknown): void {
  if (key === 'quantity') {
    const num = parseFloat(String(value));
    if (!isNaN(num)) {
      part.quantity = num;
    }
  } else if (key === 'category') {
    const cat = classifyCategoryFromValue(String(value));
    part.category = cat;
  } else if (typeof value === 'string') {
    (part as Record<string, unknown>)[key] = value;
  } else if (typeof value === 'number') {
    (part as Record<string, unknown>)[key] = String(value);
  }
}

/**
 * Classify category from a category value string
 */
function classifyCategoryFromValue(value: string): SparePartCategory {
  const lower = value.toLowerCase();

  for (const [category, patterns] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const pattern of patterns) {
      if (pattern.test(lower)) {
        return category as SparePartCategory;
      }
    }
  }

  return 'other';
}

/**
 * Classify part category based on description and other fields
 */
function classifyPartCategory(part: Partial<SparePart>): SparePartCategory {
  const searchText = [
    part.description,
    part.partNumber,
    part.manufacturerPartNumber,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  for (const [category, patterns] of Object.entries(CATEGORY_KEYWORDS)) {
    if (category === 'other') continue;
    for (const pattern of patterns) {
      if (pattern.test(searchText)) {
        return category as SparePartCategory;
      }
    }
  }

  return 'other';
}

/**
 * Search for spare parts elements anywhere in AAS structure
 */
function findSparePartsElements(obj: unknown): SparePart[] {
  const parts: SparePart[] = [];

  const search = (item: unknown, visited = new WeakSet<object>()): void => {
    if (!item || typeof item !== 'object') return;
    if (visited.has(item as object)) return;
    visited.add(item as object);

    const record = item as Record<string, unknown>;
    const idShort = record.idShort as string;

    // Check if this looks like a spare part element
    if (idShort) {
      for (const pattern of SPARE_PARTS_IDSHORT_PATTERNS) {
        if (pattern.test(idShort)) {
          // This element or its children might contain parts
          const modelType = record.modelType as string | { name?: string };
          let typeStr = '';
          if (typeof modelType === 'string') {
            typeStr = modelType;
          } else if (modelType && typeof modelType === 'object' && modelType.name) {
            typeStr = modelType.name;
          }

          if (typeStr === 'SubmodelElementCollection' || typeStr === 'Entity') {
            const part = extractSinglePart(record);
            if (part) {
              parts.push(part);
            }
          }
          break;
        }
      }
    }

    // Recurse
    for (const key of Object.keys(record)) {
      const val = record[key];
      if (Array.isArray(val)) {
        for (const child of val) {
          search(child, visited);
        }
      } else if (typeof val === 'object' && val !== null) {
        search(val, visited);
      }
    }
  };

  search(obj);
  return parts;
}

/**
 * Format spare parts list for clipboard copy
 */
export function formatSparePartsList(parts: SparePart[]): string {
  if (parts.length === 0) {
    return 'No spare parts found';
  }

  const lines = ['Spare Parts List', '='.repeat(40), ''];

  for (const part of parts) {
    lines.push(`Part Number: ${part.partNumber}`);
    if (part.description) {
      lines.push(`Description: ${part.description}`);
    }
    if (part.manufacturerPartNumber) {
      lines.push(`Manufacturer P/N: ${part.manufacturerPartNumber}`);
    }
    if (part.category !== 'other') {
      lines.push(`Category: ${part.category}`);
    }
    if (part.quantity) {
      lines.push(`Quantity: ${part.quantity}${part.unit ? ' ' + part.unit : ''}`);
    }
    if (part.supplier) {
      lines.push(`Supplier: ${part.supplier}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Group spare parts by category
 */
export function groupPartsByCategory(parts: SparePart[]): Record<SparePartCategory, SparePart[]> {
  return {
    wear: parts.filter((p) => p.category === 'wear'),
    consumable: parts.filter((p) => p.category === 'consumable'),
    replacement: parts.filter((p) => p.category === 'replacement'),
    other: parts.filter((p) => p.category === 'other'),
  };
}
