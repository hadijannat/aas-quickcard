import type { AasSnapshot, AasSource, AasAsset, AasDocument, AasContact, FieldMapping } from '../shared/types';
import { extractField, findDocumentReferences, findContacts, findLifecyclePhase, findCommissioningDate, findLastServiceDate } from './heuristics';
import { extractSubmodels } from './submodelRecognizer';
import { extractPcfData } from './pcfExtractor';
import { extractSpareParts } from './sparePartsExtractor';

/**
 * Normalize raw AAS JSON into a unified AasSnapshot structure.
 * Handles various AAS JSON formats (AAS Package Explorer, AASX Server, etc.)
 */
export function normalizeAasJson(
  rawText: string,
  source: AasSource,
  customMappings?: FieldMapping
): AasSnapshot {
  const errors: string[] = [];
  let parseOk = false;
  let parsed: unknown;

  // Try to parse JSON
  try {
    parsed = JSON.parse(rawText);
    parseOk = true;
  } catch (e) {
    errors.push(`JSON parse error: ${e instanceof Error ? e.message : 'Unknown error'}`);
    return createEmptySnapshot(source, rawText, errors);
  }

  // Extract asset information
  const asset = extractAsset(parsed, customMappings);

  // Extract documents
  const docs = extractDocuments(parsed);

  // Extract contacts
  const contacts = extractContacts(parsed);

  // Extract enhanced features
  const submodels = extractSubmodels(parsed);
  const pcf = extractPcfData(parsed);
  const lifecyclePhase = findLifecyclePhase(parsed);
  const spareParts = extractSpareParts(parsed);

  // Validate that we got something useful
  if (!asset.displayName && !asset.assetId && !asset.serialNumber) {
    errors.push('Could not extract asset identification from JSON');
  }

  if (docs.length === 0) {
    errors.push('No documents found in AAS');
  }

  return {
    source,
    rawText,
    parseOk,
    errors: errors.length > 0 ? errors : undefined,
    asset,
    docs,
    contacts,
    // Enhanced features
    submodels: submodels.length > 0 ? submodels : undefined,
    pcf,
    lifecyclePhase,
    spareParts: spareParts.length > 0 ? spareParts : undefined,
  };
}

/**
 * Extract asset information from parsed AAS JSON
 */
function extractAsset(parsed: unknown, customMappings?: FieldMapping): AasAsset {
  const asset: AasAsset = {};

  // Try to find asset info in various locations
  // AAS packages can have asset info at root, in assetAdministrationShells, or in assets

  asset.displayName = extractField(parsed, 'displayName', customMappings);
  asset.manufacturer = extractField(parsed, 'manufacturer', customMappings);
  asset.serialNumber = extractField(parsed, 'serialNumber', customMappings);
  asset.productDesignation = extractField(parsed, 'productDesignation', customMappings);
  asset.assetId = extractField(parsed, 'assetId', customMappings);

  // Try specific AAS structures if direct extraction didn't work
  if (!asset.assetId) {
    asset.assetId = findAssetId(parsed);
  }

  // Try to find year of construction
  asset.yearOfConstruction = findYearOfConstruction(parsed);

  // Try to find commissioning and service dates
  asset.commissioningDate = findCommissioningDate(parsed);
  asset.lastServiceDate = findLastServiceDate(parsed);

  // Use productDesignation as displayName fallback
  if (!asset.displayName && asset.productDesignation) {
    asset.displayName = asset.productDesignation;
  }

  return asset;
}

/**
 * Find the global asset ID from AAS structure
 */
function findAssetId(obj: unknown): string | undefined {
  if (!obj || typeof obj !== 'object') return undefined;

  const record = obj as Record<string, unknown>;

  // Check for globalAssetId directly
  if (typeof record.globalAssetId === 'string') {
    return record.globalAssetId;
  }

  // Check nested globalAssetId with keys array (AAS format)
  if (record.globalAssetId && typeof record.globalAssetId === 'object') {
    const gai = record.globalAssetId as Record<string, unknown>;
    if (Array.isArray(gai.keys) && gai.keys.length > 0) {
      const firstKey = gai.keys[0] as { value?: string };
      if (firstKey.value) return firstKey.value;
    }
  }

  // Check in assetInformation
  if (record.assetInformation && typeof record.assetInformation === 'object') {
    const found = findAssetId(record.assetInformation);
    if (found) return found;
  }

  // Check in assetAdministrationShells array
  if (Array.isArray(record.assetAdministrationShells)) {
    for (const aas of record.assetAdministrationShells) {
      const found = findAssetId(aas);
      if (found) return found;
    }
  }

  // Check id field
  if (typeof record.id === 'string' && record.id.startsWith('http')) {
    return record.id;
  }

  return undefined;
}

/**
 * Find year of construction from submodel elements
 */
function findYearOfConstruction(obj: unknown): string | undefined {
  if (!obj || typeof obj !== 'object') return undefined;

  const searchYear = (item: unknown, visited = new WeakSet<object>()): string | undefined => {
    if (!item || typeof item !== 'object') return undefined;
    if (visited.has(item as object)) return undefined;
    visited.add(item as object);

    const record = item as Record<string, unknown>;
    const idShort = record.idShort as string | undefined;
    const value = record.value as string | undefined;

    if (
      idShort &&
      /year.*construction|construction.*year|baujahr/i.test(idShort) &&
      value
    ) {
      return value;
    }

    // Recurse
    for (const key of Object.keys(record)) {
      const val = record[key];
      if (Array.isArray(val)) {
        for (const child of val) {
          const found = searchYear(child, visited);
          if (found) return found;
        }
      } else if (typeof val === 'object' && val !== null) {
        const found = searchYear(val, visited);
        if (found) return found;
      }
    }

    return undefined;
  };

  return searchYear(obj);
}

/**
 * Extract documents from parsed AAS JSON
 */
function extractDocuments(parsed: unknown): AasDocument[] {
  const docRefs = findDocumentReferences(parsed);

  return docRefs.map((doc) => ({
    title: doc.title,
    url: doc.url,
    kind: doc.kind,
  }));
}

/**
 * Extract contacts from parsed AAS JSON
 */
function extractContacts(parsed: unknown): AasContact[] {
  return findContacts(parsed);
}

/**
 * Create an empty snapshot for error cases
 */
function createEmptySnapshot(source: AasSource, rawText: string, errors: string[]): AasSnapshot {
  return {
    source,
    rawText,
    parseOk: false,
    errors,
    asset: {},
    docs: [],
    contacts: [],
  };
}

/**
 * Create a snapshot from pasted JSON
 */
export function createSnapshotFromPaste(rawText: string, customMappings?: FieldMapping): AasSnapshot {
  const source: AasSource = {
    type: 'paste',
    capturedAt: Date.now(),
  };
  return normalizeAasJson(rawText, source, customMappings);
}

/**
 * Create a snapshot from page extraction
 */
export function createSnapshotFromPage(
  rawText: string,
  url: string,
  customMappings?: FieldMapping
): AasSnapshot {
  const source: AasSource = {
    type: 'activeTab',
    url,
    capturedAt: Date.now(),
  };
  return normalizeAasJson(rawText, source, customMappings);
}

/**
 * Create a snapshot from AASX file
 */
export function createSnapshotFromFile(
  rawText: string,
  filename: string,
  customMappings?: FieldMapping
): AasSnapshot {
  const source: AasSource = {
    type: 'file',
    filename,
    capturedAt: Date.now(),
  };
  return normalizeAasJson(rawText, source, customMappings);
}
