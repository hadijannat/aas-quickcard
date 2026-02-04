import type { DocKind, ContactType, FieldMapping } from '../shared/types';
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
