import type { DocKind, ContactType, FieldMapping, LifecyclePhase } from '../shared/types';
import { DEFAULT_FIELD_MAPPINGS } from '../shared/storage';

/**
 * Heuristics for extracting values from AAS JSON structures.
 * AAS JSON can come in many formats, so we use multiple strategies.
 */

/**
 * Deep search for a value by checking multiple possible property paths
 */
export function findValue(
  obj: unknown,
  possiblePaths: string[],
  visited = new WeakSet<object>()
): string | undefined {
  if (!obj || typeof obj !== 'object') {
    return undefined;
  }

  // Prevent circular reference loops
  if (visited.has(obj as object)) {
    return undefined;
  }
  visited.add(obj as object);

  const record = obj as Record<string, unknown>;

  // Check direct properties
  for (const path of possiblePaths) {
    if (path in record) {
      const val = record[path];
      if (typeof val === 'string' && val.trim()) {
        return val.trim();
      }
      // Handle nested value objects
      if (typeof val === 'object' && val !== null) {
        const nested = val as Record<string, unknown>;
        if (typeof nested.value === 'string') {
          return nested.value.trim();
        }
        if (typeof nested.text === 'string') {
          return nested.text.trim();
        }
      }
    }
  }

  // Search in nested objects and arrays
  for (const key of Object.keys(record)) {
    const value = record[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = findValue(item, possiblePaths, visited);
        if (found) return found;
      }
    } else if (typeof value === 'object' && value !== null) {
      const found = findValue(value, possiblePaths, visited);
      if (found) return found;
    }
  }

  return undefined;
}

/**
 * Extract a field using custom or default mappings
 */
export function extractField(
  obj: unknown,
  field: keyof FieldMapping,
  customMappings?: FieldMapping
): string | undefined {
  const mappings = customMappings ?? DEFAULT_FIELD_MAPPINGS;
  const paths = mappings[field];
  return findValue(obj, paths);
}

/**
 * Find all submodel elements that look like documents
 */
export function findDocumentReferences(obj: unknown): Array<{ title: string; url: string; kind: DocKind }> {
  const docs: Array<{ title: string; url: string; kind: DocKind }> = [];

  if (!obj || typeof obj !== 'object') {
    return docs;
  }

  const searchForDocs = (item: unknown, visited = new WeakSet<object>()): void => {
    if (!item || typeof item !== 'object') return;
    if (visited.has(item as object)) return;
    visited.add(item as object);

    const record = item as Record<string, unknown>;

    // Check if this looks like a File or Blob submodel element
    const modelType = record.modelType as string | undefined;
    const contentType = record.contentType as string | undefined;
    const value = record.value as string | undefined;
    const idShort = record.idShort as string | undefined;

    if (
      (modelType === 'File' || modelType === 'Blob') &&
      typeof value === 'string' &&
      value.trim()
    ) {
      docs.push({
        title: idShort || extractFileName(value) || 'Document',
        url: value,
        kind: classifyDocKind(idShort || value, contentType),
      });
    }

    // Check for reference elements pointing to documents
    if (record.type === 'ExternalReference' || record.type === 'ModelReference') {
      const keys = record.keys as Array<{ value?: string }> | undefined;
      if (keys && Array.isArray(keys)) {
        for (const key of keys) {
          if (key.value && isDocumentUrl(key.value)) {
            docs.push({
              title: idShort || extractFileName(key.value) || 'Document',
              url: key.value,
              kind: classifyDocKind(idShort || key.value),
            });
          }
        }
      }
    }

    // Recurse into nested objects and arrays
    for (const key of Object.keys(record)) {
      const val = record[key];
      if (Array.isArray(val)) {
        for (const child of val) {
          searchForDocs(child, visited);
        }
      } else if (typeof val === 'object' && val !== null) {
        searchForDocs(val, visited);
      }
    }
  };

  searchForDocs(obj);
  return docs;
}

/**
 * Find all contact information in the AAS
 */
export function findContacts(obj: unknown): Array<{ label: string; type: ContactType; value: string }> {
  const contacts: Array<{ label: string; type: ContactType; value: string }> = [];

  if (!obj || typeof obj !== 'object') {
    return contacts;
  }

  const contactPatterns = {
    phone: /(?:phone|tel|telephone|fax|mobile)/i,
    email: /(?:email|mail|e-mail)/i,
    url: /(?:website|url|homepage|support)/i,
  };

  const searchForContacts = (item: unknown, visited = new WeakSet<object>()): void => {
    if (!item || typeof item !== 'object') return;
    if (visited.has(item as object)) return;
    visited.add(item as object);

    const record = item as Record<string, unknown>;
    const idShort = record.idShort as string | undefined;
    const value = record.value as string | undefined;

    if (idShort && value && typeof value === 'string' && value.trim()) {
      let contactType: ContactType | null = null;
      const normalizedIdShort = idShort.toLowerCase();
      const normalizedValue = value.toLowerCase();

      // Check by idShort pattern
      if (contactPatterns.phone.test(normalizedIdShort)) {
        contactType = 'phone';
      } else if (contactPatterns.email.test(normalizedIdShort)) {
        contactType = 'email';
      } else if (contactPatterns.url.test(normalizedIdShort)) {
        contactType = 'url';
      }

      // Check by value pattern
      if (!contactType) {
        if (value.includes('@') && value.includes('.')) {
          contactType = 'email';
        } else if (/^\+?[\d\s\-().]+$/.test(value) && value.replace(/\D/g, '').length >= 7) {
          contactType = 'phone';
        } else if (normalizedValue.startsWith('http') || normalizedValue.startsWith('www')) {
          contactType = 'url';
        }
      }

      if (contactType) {
        contacts.push({
          label: formatLabel(idShort),
          type: contactType,
          value: value.trim(),
        });
      }
    }

    // Recurse
    for (const key of Object.keys(record)) {
      const val = record[key];
      if (Array.isArray(val)) {
        for (const child of val) {
          searchForContacts(child, visited);
        }
      } else if (typeof val === 'object' && val !== null) {
        searchForContacts(val, visited);
      }
    }
  };

  searchForContacts(obj);
  return contacts;
}

/**
 * Classify document type based on name and content type
 */
function classifyDocKind(name: string, contentType?: string): DocKind {
  const lower = name.toLowerCase();

  if (/(?:safety|sds|msds|hazard)/i.test(lower)) {
    return 'safety';
  }
  if (/(?:manual|instruction|guide|handbook)/i.test(lower)) {
    return 'manual';
  }
  if (/(?:datasheet|data\s*sheet|specification|spec)/i.test(lower)) {
    return 'datasheet';
  }
  if (/(?:certificate|certification|cert|compliance)/i.test(lower)) {
    return 'certificate';
  }

  // Check content type
  if (contentType) {
    if (contentType.includes('pdf') || contentType.includes('document')) {
      return 'manual';
    }
  }

  return 'other';
}

/**
 * Check if a URL looks like a document reference
 */
function isDocumentUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    lower.endsWith('.pdf') ||
    lower.endsWith('.doc') ||
    lower.endsWith('.docx') ||
    lower.endsWith('.xls') ||
    lower.endsWith('.xlsx') ||
    lower.includes('/documents/') ||
    lower.includes('/files/')
  );
}

/**
 * Extract filename from URL or path
 */
function extractFileName(url: string): string | undefined {
  try {
    const parts = url.split('/');
    const last = parts[parts.length - 1];
    if (last && last.includes('.')) {
      return decodeURIComponent(last);
    }
  } catch {
    // Ignore decoding errors
  }
  return undefined;
}

/**
 * Format camelCase or snake_case to readable label
 */
function formatLabel(str: string): string {
  return str
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());
}

/**
 * Find lifecycle phase from AAS data
 * Searches for LifeCyclePhase, assetKind, status, and related properties
 */
export function findLifecyclePhase(obj: unknown): LifecyclePhase {
  if (!obj || typeof obj !== 'object') return 'unknown';

  const phaseMap: Record<string, LifecyclePhase> = {
    // Direct phase names
    'development': 'development',
    'design': 'development',
    'engineering': 'development',
    'prototype': 'development',
    'production': 'production',
    'manufacturing': 'production',
    'assembly': 'production',
    'operation': 'operation',
    'operational': 'operation',
    'in service': 'operation',
    'active': 'operation',
    'running': 'operation',
    'maintenance': 'maintenance',
    'repair': 'maintenance',
    'service': 'maintenance',
    'overhaul': 'maintenance',
    'disposal': 'disposal',
    'decommissioned': 'disposal',
    'retired': 'disposal',
    'end of life': 'disposal',
    'eol': 'disposal',
    // Asset kind mapping
    'type': 'development',    // Type = template/design
    'instance': 'operation',  // Instance = deployed asset
  };

  const searchPhase = (item: unknown, visited = new WeakSet<object>()): LifecyclePhase | undefined => {
    if (!item || typeof item !== 'object') return undefined;
    if (visited.has(item as object)) return undefined;
    visited.add(item as object);

    const record = item as Record<string, unknown>;
    const idShort = (record.idShort as string)?.toLowerCase();
    const value = record.value as string | undefined;

    // Check for lifecycle-related properties
    if (idShort && value && typeof value === 'string') {
      const normalizedIdShort = idShort.toLowerCase();
      const normalizedValue = value.toLowerCase();

      // Direct lifecycle phase property
      if (
        normalizedIdShort.includes('lifecycle') ||
        normalizedIdShort.includes('phase') ||
        normalizedIdShort.includes('status') ||
        normalizedIdShort === 'assetkind'
      ) {
        const mapped = phaseMap[normalizedValue];
        if (mapped) return mapped;
      }
    }

    // Check assetKind at object level
    if (typeof record.assetKind === 'string') {
      const kind = record.assetKind.toLowerCase();
      const mapped = phaseMap[kind];
      if (mapped) return mapped;
    }

    // Recurse into nested objects
    for (const key of Object.keys(record)) {
      const val = record[key];
      if (Array.isArray(val)) {
        for (const child of val) {
          const found = searchPhase(child, visited);
          if (found) return found;
        }
      } else if (typeof val === 'object' && val !== null) {
        const found = searchPhase(val, visited);
        if (found) return found;
      }
    }

    return undefined;
  };

  return searchPhase(obj) ?? 'unknown';
}

/**
 * Find commissioning date from AAS data
 */
export function findCommissioningDate(obj: unknown): string | undefined {
  const datePatterns = [
    'commissioningdate',
    'commissioning',
    'installationdate',
    'installation',
    'startupdate',
    'startup',
    'dateofcommissioning',
  ];

  return findDateProperty(obj, datePatterns);
}

/**
 * Find last service date from AAS data
 */
export function findLastServiceDate(obj: unknown): string | undefined {
  const datePatterns = [
    'lastservicedate',
    'lastservice',
    'lastmaintenance',
    'lastmaintenancedate',
    'servicedate',
    'maintenancedate',
  ];

  return findDateProperty(obj, datePatterns);
}

/**
 * Generic date property finder
 */
function findDateProperty(obj: unknown, patterns: string[]): string | undefined {
  if (!obj || typeof obj !== 'object') return undefined;

  const searchDate = (item: unknown, visited = new WeakSet<object>()): string | undefined => {
    if (!item || typeof item !== 'object') return undefined;
    if (visited.has(item as object)) return undefined;
    visited.add(item as object);

    const record = item as Record<string, unknown>;
    const idShort = record.idShort as string | undefined;
    const value = record.value as string | undefined;

    if (idShort && value && typeof value === 'string') {
      const normalizedIdShort = idShort.toLowerCase().replace(/[_\-\s]/g, '');
      for (const pattern of patterns) {
        if (normalizedIdShort.includes(pattern.replace(/[_\-\s]/g, ''))) {
          return value;
        }
      }
    }

    // Recurse
    for (const key of Object.keys(record)) {
      const val = record[key];
      if (Array.isArray(val)) {
        for (const child of val) {
          const found = searchDate(child, visited);
          if (found) return found;
        }
      } else if (typeof val === 'object' && val !== null) {
        const found = searchDate(val, visited);
        if (found) return found;
      }
    }

    return undefined;
  };

  return searchDate(obj);
}
