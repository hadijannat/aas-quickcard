import JSZip from 'jszip';
import type { AasSnapshot, AasDocument, AasContact, AasAsset, DocKind, ContactType } from '../shared/types';
import { createSnapshotFromFile } from './normalize';

/**
 * Parse an AASX package (ZIP-based) and extract AAS data.
 * Supports both JSON and XML formats.
 */
export async function parseAasxFile(file: File): Promise<AasSnapshot> {
  try {
    const zip = await JSZip.loadAsync(file);

    // First try to find JSON format
    const aasJson = await findAasJson(zip);
    if (aasJson) {
      const snapshot = createSnapshotFromFile(aasJson.content, file.name);
      const embeddedDocs = await extractEmbeddedDocuments(zip);
      snapshot.docs = mergeDocuments(snapshot.docs, embeddedDocs);
      return snapshot;
    }

    // Try XML format (common in AASX packages)
    const aasXml = await findAasXml(zip);
    if (aasXml) {
      const snapshot = parseAasXml(aasXml.content, file.name);
      const embeddedDocs = await extractEmbeddedDocuments(zip);
      snapshot.docs = mergeDocuments(snapshot.docs, embeddedDocs);
      return snapshot;
    }

    return {
      source: { type: 'file', filename: file.name, capturedAt: Date.now() },
      rawText: '',
      parseOk: false,
      errors: ['No AAS data found in AASX package (checked JSON and XML formats)'],
      asset: {},
      docs: [],
      contacts: [],
    };
  } catch (error) {
    return {
      source: { type: 'file', filename: file.name, capturedAt: Date.now() },
      rawText: '',
      parseOk: false,
      errors: [
        `Failed to parse AASX: ${error instanceof Error ? error.message : 'Unknown error'}`,
      ],
      asset: {},
      docs: [],
      contacts: [],
    };
  }
}

/**
 * Find AAS JSON content within the AASX package
 */
async function findAasJson(zip: JSZip): Promise<{ path: string; content: string } | null> {
  const possiblePaths = [
    'aasx/aas.json',
    'aasx/aas/aas.json',
    'aas.json',
    'aas/aas.json',
  ];

  for (const path of possiblePaths) {
    const file = zip.file(path);
    if (file) {
      const content = await file.async('string');
      if (isValidAasJson(content)) {
        return { path, content };
      }
    }
  }

  // Search for any JSON file that looks like AAS
  const jsonFiles: string[] = [];
  zip.forEach((path, entry) => {
    if (!entry.dir && path.endsWith('.json')) {
      jsonFiles.push(path);
    }
  });

  for (const path of jsonFiles) {
    const file = zip.file(path);
    if (file) {
      const content = await file.async('string');
      if (isValidAasJson(content)) {
        return { path, content };
      }
    }
  }

  return null;
}

/**
 * Find AAS XML content within the AASX package
 */
async function findAasXml(zip: JSZip): Promise<{ path: string; content: string } | null> {
  // Search for XML files that contain AAS data
  const xmlFiles: string[] = [];
  zip.forEach((path, entry) => {
    if (!entry.dir && path.endsWith('.xml') && !path.includes('[Content_Types]')) {
      xmlFiles.push(path);
    }
  });

  // Sort to prioritize files with 'aas' in the name
  xmlFiles.sort((a, b) => {
    const aHasAas = a.toLowerCase().includes('aas') ? 0 : 1;
    const bHasAas = b.toLowerCase().includes('aas') ? 0 : 1;
    return aHasAas - bHasAas;
  });

  for (const path of xmlFiles) {
    const file = zip.file(path);
    if (file) {
      const content = await file.async('string');
      if (isValidAasXml(content)) {
        return { path, content };
      }
    }
  }

  return null;
}

/**
 * Check if content is valid AAS JSON
 */
function isValidAasJson(content: string): boolean {
  try {
    const parsed = JSON.parse(content);
    if (typeof parsed !== 'object' || parsed === null) {
      return false;
    }
    const aasIndicators = [
      'assetAdministrationShells',
      'submodels',
      'assets',
      'assetInformation',
      'idShort',
    ];
    return aasIndicators.some((key) => key in parsed);
  } catch {
    return false;
  }
}

/**
 * Check if content is valid AAS XML
 */
function isValidAasXml(content: string): boolean {
  return (
    content.includes('admin-shell.io') ||
    content.includes('aasenv') ||
    content.includes('assetAdministrationShell') ||
    content.includes(':aas')
  );
}

/**
 * Parse AAS XML content using browser's DOMParser
 */
function parseAasXml(xmlContent: string, filename: string): AasSnapshot {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlContent, 'application/xml');

  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    return {
      source: { type: 'file', filename, capturedAt: Date.now() },
      rawText: xmlContent,
      parseOk: false,
      errors: ['XML parsing error: ' + parseError.textContent],
      asset: {},
      docs: [],
      contacts: [],
    };
  }

  // Extract asset information
  const asset = extractAssetFromXml(doc);

  // Extract documents
  const docs = extractDocumentsFromXml(doc);

  // Extract contacts
  const contacts = extractContactsFromXml(doc);

  return {
    source: { type: 'file', filename, capturedAt: Date.now() },
    rawText: xmlContent,
    parseOk: true,
    asset,
    docs,
    contacts,
  };
}

/**
 * Extract asset information from XML document
 */
function extractAssetFromXml(doc: Document): AasAsset {
  const asset: AasAsset = {};

  // Helper to find property by idShort
  const getPropertyByIdShort = (idShort: string): string | undefined => {
    const properties = doc.getElementsByTagNameNS('*', 'property');
    for (let i = 0; i < properties.length; i++) {
      const prop = properties[i];
      const idShortEl = prop.getElementsByTagNameNS('*', 'idShort')[0];
      if (idShortEl?.textContent === idShort) {
        const valueEl = prop.getElementsByTagNameNS('*', 'value')[0];
        return valueEl?.textContent?.trim() || undefined;
      }
    }
    return undefined;
  };

  // Extract common fields
  asset.manufacturer = getPropertyByIdShort('ManufacturerName') ||
    getPropertyByIdShort('Manufacturer');

  asset.displayName = getPropertyByIdShort('ManufacturerProductDesignation') ||
    getPropertyByIdShort('ProductDesignation') ||
    getPropertyByIdShort('AssetName');

  asset.serialNumber = getPropertyByIdShort('SerialNumber') ||
    getPropertyByIdShort('ManufacturerProductSerialNumber');

  asset.productDesignation = getPropertyByIdShort('ManufacturerProductDesignation') ||
    getPropertyByIdShort('ProductType');

  asset.yearOfConstruction = getPropertyByIdShort('YearOfConstruction') ||
    getPropertyByIdShort('DateOfManufacture');

  // Get asset ID from identification or globalAssetId
  const identifications = doc.getElementsByTagNameNS('*', 'identification');
  for (let i = 0; i < identifications.length; i++) {
    const id = identifications[i];
    const parent = id.parentElement;
    // Prefer asset identification over AAS identification
    if (parent?.localName === 'asset' || parent?.localName?.includes('Asset')) {
      asset.assetId = id.textContent?.trim();
      break;
    }
  }

  // Fallback: get first AAS identification
  if (!asset.assetId && identifications.length > 0) {
    asset.assetId = identifications[0].textContent?.trim();
  }

  // Also try idShort from AAS as display name fallback
  if (!asset.displayName) {
    const aas = doc.getElementsByTagNameNS('*', 'assetAdministrationShell')[0];
    if (aas) {
      const idShortEl = aas.getElementsByTagNameNS('*', 'idShort')[0];
      if (idShortEl?.textContent) {
        asset.displayName = formatIdShort(idShortEl.textContent);
      }
    }
  }

  return asset;
}

/**
 * Extract documents from XML
 */
function extractDocumentsFromXml(doc: Document): AasDocument[] {
  const docs: AasDocument[] = [];

  // Find all file elements
  const fileElements = doc.getElementsByTagNameNS('*', 'file');
  for (let i = 0; i < fileElements.length; i++) {
    const fileEl = fileElements[i];

    const idShortEl = fileEl.getElementsByTagNameNS('*', 'idShort')[0];
    const valueEl = fileEl.getElementsByTagNameNS('*', 'value')[0];
    const mimeTypeEl = fileEl.getElementsByTagNameNS('*', 'mimeType')[0];

    const filePath = valueEl?.textContent?.trim();
    if (!filePath) continue;

    // Get the document title from parent collection if available
    let title = idShortEl?.textContent?.trim() || '';
    const parentCollection = findParentCollection(fileEl);
    if (parentCollection) {
      const collectionIdShort = parentCollection.getElementsByTagNameNS('*', 'idShort')[0];
      if (collectionIdShort?.textContent) {
        title = formatIdShort(collectionIdShort.textContent);
      }
    }

    // Fallback to filename from path
    if (!title || title === 'File') {
      title = filePath.split('/').pop() || filePath;
    }

    const mimeType = mimeTypeEl?.textContent?.trim() || '';

    docs.push({
      title,
      url: filePath,
      kind: classifyDocumentKind(title, mimeType),
    });
  }

  return docs;
}

/**
 * Find parent submodelElementCollection
 */
function findParentCollection(el: Element): Element | null {
  let parent = el.parentElement;
  while (parent) {
    if (parent.localName === 'submodelElementCollection') {
      return parent;
    }
    parent = parent.parentElement;
  }
  return null;
}

/**
 * Extract contacts from XML
 */
function extractContactsFromXml(doc: Document): AasContact[] {
  const contacts: AasContact[] = [];

  // Look for properties with contact-related idShorts
  const contactPatterns = [
    { pattern: /phone|tel|fax|mobile/i, type: 'phone' as ContactType },
    { pattern: /email|mail/i, type: 'email' as ContactType },
    { pattern: /website|url|homepage|www/i, type: 'url' as ContactType },
  ];

  const properties = doc.getElementsByTagNameNS('*', 'property');
  for (let i = 0; i < properties.length; i++) {
    const prop = properties[i];
    const idShortEl = prop.getElementsByTagNameNS('*', 'idShort')[0];
    const valueEl = prop.getElementsByTagNameNS('*', 'value')[0];

    const idShort = idShortEl?.textContent?.trim();
    const value = valueEl?.textContent?.trim();

    if (!idShort || !value) continue;

    // Check if this looks like contact info
    for (const { pattern, type } of contactPatterns) {
      if (pattern.test(idShort)) {
        contacts.push({
          label: formatIdShort(idShort),
          type,
          value,
        });
        break;
      }
    }

    // Also detect by value pattern
    if (!contactPatterns.some(p => p.pattern.test(idShort))) {
      if (value.includes('@') && value.includes('.')) {
        contacts.push({
          label: formatIdShort(idShort),
          type: 'email',
          value,
        });
      } else if (/^\+?[\d\s\-().]{7,}$/.test(value)) {
        contacts.push({
          label: formatIdShort(idShort),
          type: 'phone',
          value,
        });
      }
    }
  }

  return contacts;
}

/**
 * Format camelCase/PascalCase to readable label
 */
function formatIdShort(str: string): string {
  return str
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());
}

/**
 * Classify document kind based on title and mime type
 */
function classifyDocumentKind(title: string, mimeType?: string): DocKind {
  const lower = title.toLowerCase();

  if (/safety|sds|msds|hazard|atex/i.test(lower)) {
    return 'safety';
  }
  if (/manual|instruction|guide|handbook|oi_/i.test(lower)) {
    return 'manual';
  }
  if (/datasheet|data.*sheet|specification|spec/i.test(lower)) {
    return 'datasheet';
  }
  if (/certificate|certification|cert|ce_|compliance/i.test(lower)) {
    return 'certificate';
  }

  // Check mime type
  if (mimeType?.includes('pdf')) {
    return 'manual'; // Default PDFs to manual
  }

  return 'other';
}

/**
 * Extract embedded document files from AASX package
 */
async function extractEmbeddedDocuments(zip: JSZip): Promise<AasDocument[]> {
  const docs: AasDocument[] = [];
  const docExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx'];
  const promises: Promise<void>[] = [];

  zip.forEach((path, entry) => {
    if (entry.dir) return;

    const lowerPath = path.toLowerCase();
    const isDocument = docExtensions.some((ext) => lowerPath.endsWith(ext));

    // Skip thumbnails and small images
    if (lowerPath.includes('thumbnail') || lowerPath.endsWith('.png') || lowerPath.endsWith('.jpg')) {
      return;
    }

    if (isDocument) {
      const promise = entry.async('blob').then((blob) => {
        const filename = path.split('/').pop() || path;
        docs.push({
          title: formatFilename(filename),
          url: `aasx:${path}`,
          kind: classifyDocumentKind(filename),
          blob,
        });
      });
      promises.push(promise);
    }
  });

  await Promise.all(promises);
  return docs;
}

/**
 * Format filename for display
 */
function formatFilename(filename: string): string {
  // Remove extension and clean up
  return filename
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Merge documents from XML references with embedded documents
 */
function mergeDocuments(xmlDocs: AasDocument[], embeddedDocs: AasDocument[]): AasDocument[] {
  const merged: AasDocument[] = [];
  const seenPaths = new Set<string>();

  // Add XML docs first, attaching blobs from embedded if available
  for (const xmlDoc of xmlDocs) {
    const normalizedPath = xmlDoc.url.replace(/^\//, '');
    seenPaths.add(normalizedPath);

    // Find matching embedded doc for blob
    const embedded = embeddedDocs.find((e) => {
      const embeddedPath = e.url.replace('aasx:', '');
      return embeddedPath.includes(normalizedPath) || normalizedPath.includes(embeddedPath);
    });

    merged.push({
      ...xmlDoc,
      blob: embedded?.blob,
    });
  }

  // Add any embedded docs not in XML (shouldn't happen often)
  for (const embedded of embeddedDocs) {
    const embeddedPath = embedded.url.replace('aasx:', '');
    const alreadyIncluded = Array.from(seenPaths).some(
      (p) => embeddedPath.includes(p) || p.includes(embeddedPath.split('/').pop() || '')
    );

    if (!alreadyIncluded) {
      merged.push(embedded);
    }
  }

  return merged;
}

/**
 * Check if a file is an AASX package
 */
export function isAasxFile(file: File): boolean {
  return (
    file.name.toLowerCase().endsWith('.aasx') ||
    file.type === 'application/x-aasx'
  );
}

/**
 * Check if a file is a plain JSON file
 */
export function isJsonFile(file: File): boolean {
  return (
    file.name.toLowerCase().endsWith('.json') ||
    file.type === 'application/json'
  );
}

/**
 * Parse a file (either AASX or JSON)
 */
export async function parseFile(file: File): Promise<AasSnapshot> {
  if (isAasxFile(file)) {
    return parseAasxFile(file);
  }

  if (isJsonFile(file)) {
    const content = await file.text();
    return createSnapshotFromFile(content, file.name);
  }

  return {
    source: { type: 'file', filename: file.name, capturedAt: Date.now() },
    rawText: '',
    parseOk: false,
    errors: ['Unsupported file type. Please upload .aasx or .json files.'],
    asset: {},
    docs: [],
    contacts: [],
  };
}
