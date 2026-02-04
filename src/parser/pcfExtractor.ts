import type { PcfData } from '../shared/types';

/**
 * Semantic IDs that identify PCF submodels
 */
const PCF_SEMANTIC_IDS = [
  'https://admin-shell.io/idta/CarbonFootprint/ProductCarbonFootprint/0/9',
  'https://admin-shell.io/idta/CarbonFootprint/ProductCarbonFootprint/1/0',
  '0173-1#01-AKS018#001',
];

/**
 * idShort patterns that indicate PCF data
 */
const PCF_IDSHORT_PATTERNS = [
  /^carbon.*footprint$/i,
  /^pcf$/i,
  /^product.*carbon/i,
  /^co2.*footprint/i,
];

/**
 * Property name patterns for PCF values
 */
const PCF_PROPERTY_PATTERNS = {
  co2Equivalent: [
    /^pcfgwptotal$/i,
    /^co2.*equivalent$/i,
    /^co2e$/i,
    /^gwp.*total$/i,
    /^carbon.*footprint.*value$/i,
    /^totalco2/i,
  ],
  unit: [
    /^pcfgwpunit$/i,
    /^unit$/i,
    /^co2.*unit$/i,
  ],
  calculationMethod: [
    /^calculation.*method$/i,
    /^pcf.*calculation.*method$/i,
    /^methodology$/i,
    /^standard$/i,
  ],
  scope: [
    /^scope$/i,
    /^pcf.*scope$/i,
    /^emission.*scope$/i,
    /^boundary$/i,
  ],
  validFrom: [
    /^valid.*from$/i,
    /^pcf.*valid.*from$/i,
    /^validity.*start$/i,
    /^reference.*period.*start$/i,
  ],
  validTo: [
    /^valid.*to$/i,
    /^pcf.*valid.*to$/i,
    /^validity.*end$/i,
    /^reference.*period.*end$/i,
  ],
  productLifecycleStage: [
    /^lifecycle.*stage$/i,
    /^product.*lifecycle$/i,
    /^pcf.*lifecycle/i,
  ],
  geographicScope: [
    /^geographic.*scope$/i,
    /^region$/i,
    /^country$/i,
    /^geo.*scope$/i,
  ],
};

/**
 * Extract PCF data from AAS JSON structure
 */
export function extractPcfData(parsed: unknown): PcfData | undefined {
  if (!parsed || typeof parsed !== 'object') {
    return undefined;
  }

  // First, find PCF submodel
  const pcfSubmodel = findPcfSubmodel(parsed);

  if (!pcfSubmodel) {
    // Try searching the entire structure for PCF properties
    const directExtract = extractPcfFromAny(parsed);
    if (directExtract && directExtract.co2Equivalent !== undefined) {
      return directExtract;
    }
    return undefined;
  }

  return extractPcfFromSubmodel(pcfSubmodel);
}

/**
 * Find PCF submodel in AAS structure
 */
function findPcfSubmodel(obj: unknown): Record<string, unknown> | undefined {
  if (!obj || typeof obj !== 'object') return undefined;

  const record = obj as Record<string, unknown>;

  // Check submodels array
  const submodels = record.submodels as unknown[];
  if (Array.isArray(submodels)) {
    for (const sm of submodels) {
      if (isPcfSubmodel(sm)) {
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
            if (isPcfSubmodel(sm)) {
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
 * Check if a submodel is a PCF submodel
 */
function isPcfSubmodel(sm: unknown): boolean {
  if (!sm || typeof sm !== 'object') return false;

  const record = sm as Record<string, unknown>;

  // Check semantic ID
  const semanticId = extractSemanticId(record);
  if (semanticId && PCF_SEMANTIC_IDS.includes(semanticId)) {
    return true;
  }

  // Check idShort patterns
  const idShort = record.idShort as string;
  if (idShort) {
    for (const pattern of PCF_IDSHORT_PATTERNS) {
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
 * Extract PCF data from a PCF submodel
 */
function extractPcfFromSubmodel(submodel: Record<string, unknown>): PcfData {
  const pcf: PcfData = {};

  const elements = submodel.submodelElements as unknown[];
  if (!Array.isArray(elements)) {
    return pcf;
  }

  for (const el of elements) {
    if (!el || typeof el !== 'object') continue;

    const elRecord = el as Record<string, unknown>;
    const idShort = elRecord.idShort as string;
    const value = elRecord.value;

    if (!idShort || value === undefined || value === null) continue;

    // Match against property patterns
    for (const [key, patterns] of Object.entries(PCF_PROPERTY_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(idShort)) {
          assignPcfValue(pcf, key as keyof PcfData, value);
          break;
        }
      }
    }

    // Also check nested elements (SubmodelElementCollections)
    if (Array.isArray(elRecord.value)) {
      const nestedPcf = extractPcfFromElements(elRecord.value as unknown[]);
      Object.assign(pcf, nestedPcf);
    }
  }

  // Normalize the CO2 value and unit
  normalizePcfUnit(pcf);

  return pcf;
}

/**
 * Extract PCF data from an array of elements
 */
function extractPcfFromElements(elements: unknown[]): PcfData {
  const pcf: PcfData = {};

  for (const el of elements) {
    if (!el || typeof el !== 'object') continue;

    const elRecord = el as Record<string, unknown>;
    const idShort = elRecord.idShort as string;
    const value = elRecord.value;

    if (!idShort || value === undefined || value === null) continue;

    for (const [key, patterns] of Object.entries(PCF_PROPERTY_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(idShort)) {
          assignPcfValue(pcf, key as keyof PcfData, value);
          break;
        }
      }
    }
  }

  return pcf;
}

/**
 * Assign a value to PCF data with appropriate type conversion
 */
function assignPcfValue(pcf: PcfData, key: keyof PcfData, value: unknown): void {
  if (key === 'co2Equivalent') {
    const num = parseFloat(String(value));
    if (!isNaN(num)) {
      pcf.co2Equivalent = num;
    }
  } else if (typeof value === 'string') {
    (pcf as Record<string, unknown>)[key] = value;
  } else if (typeof value === 'number') {
    (pcf as Record<string, unknown>)[key] = String(value);
  }
}

/**
 * Search entire structure for PCF-like properties
 */
function extractPcfFromAny(obj: unknown): PcfData {
  const pcf: PcfData = {};

  const search = (item: unknown, visited = new WeakSet<object>()): void => {
    if (!item || typeof item !== 'object') return;
    if (visited.has(item as object)) return;
    visited.add(item as object);

    const record = item as Record<string, unknown>;
    const idShort = record.idShort as string;
    const value = record.value;

    if (idShort && value !== undefined && value !== null) {
      for (const [key, patterns] of Object.entries(PCF_PROPERTY_PATTERNS)) {
        for (const pattern of patterns) {
          if (pattern.test(idShort)) {
            assignPcfValue(pcf, key as keyof PcfData, value);
            break;
          }
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
  normalizePcfUnit(pcf);
  return pcf;
}

/**
 * Normalize PCF unit to standard format
 */
function normalizePcfUnit(pcf: PcfData): void {
  if (!pcf.unit) {
    pcf.unit = 'kg CO₂e';  // Default unit
    return;
  }

  const unit = pcf.unit.toLowerCase();

  // Normalize common variations
  if (unit.includes('kg') && (unit.includes('co2') || unit.includes('co₂'))) {
    pcf.unit = 'kg CO₂e';
  } else if (unit.includes('g') && (unit.includes('co2') || unit.includes('co₂'))) {
    // Convert g to kg for consistency
    if (pcf.co2Equivalent !== undefined) {
      pcf.co2Equivalent = pcf.co2Equivalent / 1000;
    }
    pcf.unit = 'kg CO₂e';
  } else if (unit === 'kg' || unit === 'kilogram' || unit === 'kilograms') {
    pcf.unit = 'kg CO₂e';
  } else if (unit === 'g' || unit === 'gram' || unit === 'grams') {
    if (pcf.co2Equivalent !== undefined) {
      pcf.co2Equivalent = pcf.co2Equivalent / 1000;
    }
    pcf.unit = 'kg CO₂e';
  }
}

/**
 * Format PCF value for display
 */
export function formatPcfValue(pcf: PcfData): string {
  if (pcf.co2Equivalent === undefined) {
    return 'N/A';
  }

  const value = pcf.co2Equivalent;
  const unit = pcf.unit || 'kg CO₂e';

  if (value >= 1000) {
    return `${(value / 1000).toFixed(2)} t CO₂e`;
  } else if (value < 0.01) {
    return `${(value * 1000).toFixed(2)} g CO₂e`;
  } else {
    return `${value.toFixed(2)} ${unit}`;
  }
}
