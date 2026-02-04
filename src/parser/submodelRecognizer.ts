import type { SubmodelInfo, SubmodelElement, SubmodelElementType } from '../shared/types';

/**
 * IDTA Submodel Template Registry
 * Maps semantic IDs to template names and versions
 */
const IDTA_TEMPLATES: Record<string, { name: string; version?: string }> = {
  // Digital Nameplate (IDTA 02006)
  'https://admin-shell.io/zvei/nameplate/2/0/Nameplate': {
    name: 'IDTA-02006 Digital Nameplate',
    version: '2.0',
  },
  'https://admin-shell.io/zvei/nameplate/1/0/Nameplate': {
    name: 'IDTA-02006 Digital Nameplate',
    version: '1.0',
  },
  '0173-1#01-AHD206#001': {
    name: 'IDTA-02006 Digital Nameplate',
    version: '1.0',
  },

  // Handover Documentation (IDTA 02004)
  'https://admin-shell.io/zvei/handoverdocumentation/1/0/Handover': {
    name: 'IDTA-02004 Handover Documentation',
    version: '1.0',
  },
  'https://admin-shell.io/zvei/handover/1/0/HandoverDocumentation': {
    name: 'IDTA-02004 Handover Documentation',
    version: '1.0',
  },

  // Product Carbon Footprint (IDTA 02023)
  'https://admin-shell.io/idta/CarbonFootprint/ProductCarbonFootprint/0/9': {
    name: 'IDTA-02023 Carbon Footprint',
    version: '0.9',
  },
  'https://admin-shell.io/idta/CarbonFootprint/ProductCarbonFootprint/1/0': {
    name: 'IDTA-02023 Carbon Footprint',
    version: '1.0',
  },
  '0173-1#01-AKS018#001': {
    name: 'IDTA-02023 Carbon Footprint',
    version: '1.0',
  },

  // Technical Data (IDTA 02002)
  'https://admin-shell.io/ZVEI/TechnicalData/Submodel/1/2': {
    name: 'IDTA-02002 Technical Data',
    version: '1.2',
  },
  'https://admin-shell.io/ZVEI/TechnicalData/Submodel/1/1': {
    name: 'IDTA-02002 Technical Data',
    version: '1.1',
  },

  // Contact Information (IDTA 02002 subpart)
  'https://admin-shell.io/zvei/nameplate/1/0/ContactInformations': {
    name: 'Contact Information',
    version: '1.0',
  },

  // Bill of Materials (BOM)
  'https://admin-shell.io/idta/hierarchicalstructures/1/0/submodel': {
    name: 'IDTA Hierarchical Structures',
    version: '1.0',
  },

  // Service/Maintenance (IDTA 02005)
  'https://admin-shell.io/zvei/servicerecords/1/0/ServiceRecords': {
    name: 'IDTA-02005 Service Records',
    version: '1.0',
  },

  // Reliability (IDTA 02022)
  'https://admin-shell.io/idta/reliability/1/0/reliability': {
    name: 'IDTA-02022 Reliability',
    version: '1.0',
  },

  // Time Series Data (IDTA 02008)
  'https://admin-shell.io/idta/timeseries/1/1/Submodel': {
    name: 'IDTA-02008 Time Series Data',
    version: '1.1',
  },

  // Software Nameplate (IDTA 02007)
  'https://admin-shell.io/idta/SoftwareNameplate/1/0': {
    name: 'IDTA-02007 Software Nameplate',
    version: '1.0',
  },

  // Asset Interfaces Description (IDTA 02017)
  'https://admin-shell.io/idta/aaid/1/0/AssetInterfaceDescription': {
    name: 'IDTA-02017 Asset Interfaces',
    version: '1.0',
  },

  // Spare Parts (common pattern)
  'https://admin-shell.io/zvei/spareparts/1/0/SpareParts': {
    name: 'Spare Parts',
    version: '1.0',
  },
};

/**
 * Pattern-based template recognition for idShort matching
 */
const IDSHORT_PATTERNS: Array<{ pattern: RegExp; template: { name: string; version?: string } }> = [
  { pattern: /^nameplate$/i, template: { name: 'Digital Nameplate' } },
  { pattern: /^handover/i, template: { name: 'Handover Documentation' } },
  { pattern: /^carbon.*footprint|^pcf$/i, template: { name: 'Carbon Footprint' } },
  { pattern: /^technical.*data$/i, template: { name: 'Technical Data' } },
  { pattern: /^contact/i, template: { name: 'Contact Information' } },
  { pattern: /^bom$|^bill.*material/i, template: { name: 'Bill of Materials' } },
  { pattern: /^service|^maintenance/i, template: { name: 'Service Records' } },
  { pattern: /^spare.*part/i, template: { name: 'Spare Parts' } },
  { pattern: /^document/i, template: { name: 'Documentation' } },
  { pattern: /^software/i, template: { name: 'Software Nameplate' } },
  { pattern: /^asset.*interface/i, template: { name: 'Asset Interfaces' } },
  { pattern: /^reliab/i, template: { name: 'Reliability' } },
  { pattern: /^time.*series/i, template: { name: 'Time Series Data' } },
  { pattern: /^identification/i, template: { name: 'Identification' } },
  { pattern: /^certific/i, template: { name: 'Certificates' } },
  { pattern: /^compliance/i, template: { name: 'Compliance' } },
];

/**
 * Extract submodel list from AAS JSON structure
 */
export function extractSubmodels(parsed: unknown): SubmodelInfo[] {
  const submodels: SubmodelInfo[] = [];

  if (!parsed || typeof parsed !== 'object') {
    return submodels;
  }

  const record = parsed as Record<string, unknown>;

  // Look for submodels array at various locations
  const submodelArrays = findSubmodelArrays(record);

  for (const smArray of submodelArrays) {
    for (const sm of smArray) {
      const info = parseSubmodel(sm);
      if (info) {
        submodels.push(info);
      }
    }
  }

  return submodels;
}

/**
 * Find all submodel arrays in the AAS structure
 */
function findSubmodelArrays(obj: Record<string, unknown>): unknown[][] {
  const arrays: unknown[][] = [];

  // Direct submodels array
  if (Array.isArray(obj.submodels)) {
    arrays.push(obj.submodels);
  }

  // Check in AAS package structure
  if (Array.isArray(obj.assetAdministrationShells)) {
    for (const aas of obj.assetAdministrationShells) {
      if (aas && typeof aas === 'object') {
        const aasRecord = aas as Record<string, unknown>;
        if (Array.isArray(aasRecord.submodels)) {
          arrays.push(aasRecord.submodels);
        }
      }
    }
  }

  // Check for submodelDescriptors in registry responses
  if (Array.isArray(obj.submodelDescriptors)) {
    arrays.push(obj.submodelDescriptors);
  }

  return arrays;
}

/**
 * Parse a single submodel into SubmodelInfo
 */
function parseSubmodel(sm: unknown): SubmodelInfo | null {
  if (!sm || typeof sm !== 'object') {
    return null;
  }

  const record = sm as Record<string, unknown>;
  const idShort = record.idShort as string | undefined;

  if (!idShort) {
    return null;
  }

  // Extract semantic ID
  const semanticId = extractSemanticId(record);

  // Find template match
  const template = findTemplate(semanticId, idShort);

  // Count and extract elements
  const elements = extractElements(record);

  return {
    idShort,
    id: (record.id as string) || undefined,
    semanticId,
    templateName: template?.name,
    templateVersion: template?.version,
    elementCount: elements.length,
    elements: elements.length > 0 ? elements : undefined,
  };
}

/**
 * Extract semantic ID from submodel
 */
function extractSemanticId(record: Record<string, unknown>): string | undefined {
  // Direct string semantic ID
  if (typeof record.semanticId === 'string') {
    return record.semanticId;
  }

  // Object with keys array (AAS format)
  if (record.semanticId && typeof record.semanticId === 'object') {
    const semId = record.semanticId as Record<string, unknown>;

    // Check for keys array
    if (Array.isArray(semId.keys) && semId.keys.length > 0) {
      const firstKey = semId.keys[0] as { value?: string };
      if (firstKey.value) return firstKey.value;
    }

    // Check for value directly
    if (typeof semId.value === 'string') {
      return semId.value;
    }
  }

  return undefined;
}

/**
 * Find template match for a submodel
 */
function findTemplate(
  semanticId: string | undefined,
  idShort: string
): { name: string; version?: string } | undefined {
  // Try semantic ID first (most reliable)
  if (semanticId && IDTA_TEMPLATES[semanticId]) {
    return IDTA_TEMPLATES[semanticId];
  }

  // Try pattern matching on idShort
  for (const { pattern, template } of IDSHORT_PATTERNS) {
    if (pattern.test(idShort)) {
      return template;
    }
  }

  return undefined;
}

/**
 * Extract submodel elements
 */
function extractElements(record: Record<string, unknown>): SubmodelElement[] {
  const elements: SubmodelElement[] = [];

  // Check for submodelElements array
  const smElements = record.submodelElements as unknown[];
  if (!Array.isArray(smElements)) {
    return elements;
  }

  for (const el of smElements) {
    if (!el || typeof el !== 'object') continue;

    const elRecord = el as Record<string, unknown>;
    const idShort = elRecord.idShort as string;
    const modelType = elRecord.modelType as SubmodelElementType | { name?: string };

    if (!idShort) continue;

    // Handle modelType as string or object
    let typeStr: SubmodelElementType = 'Property';
    if (typeof modelType === 'string') {
      typeStr = modelType as SubmodelElementType;
    } else if (modelType && typeof modelType === 'object' && modelType.name) {
      typeStr = modelType.name as SubmodelElementType;
    }

    elements.push({
      idShort,
      modelType: typeStr,
      value: elRecord.value as string | number | boolean | undefined,
      semanticId: extractSemanticId(elRecord),
    });
  }

  return elements;
}

/**
 * Check if a submodel is a known IDTA template
 */
export function isKnownTemplate(semanticId: string | undefined): boolean {
  return semanticId !== undefined && semanticId in IDTA_TEMPLATES;
}

/**
 * Get template info by semantic ID
 */
export function getTemplateInfo(
  semanticId: string
): { name: string; version?: string } | undefined {
  return IDTA_TEMPLATES[semanticId];
}
