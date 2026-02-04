// Source information for where the AAS data came from
export type AasSource = {
  type: 'activeTab' | 'paste' | 'file';
  url?: string;
  filename?: string;
  capturedAt: number;
};

// Document classification
export type DocKind = 'manual' | 'safety' | 'datasheet' | 'certificate' | 'other';

// Document reference from AAS
export type AasDocument = {
  title: string;
  url: string;
  kind: DocKind;
  blob?: Blob; // For AASX-extracted files
};

// Contact type classification
export type ContactType = 'phone' | 'email' | 'url' | 'other';

// Contact information from AAS
export type AasContact = {
  label: string;
  type: ContactType;
  value: string;
};

// Core asset information extracted from AAS
export type AasAsset = {
  displayName?: string;
  manufacturer?: string;
  serialNumber?: string;
  productDesignation?: string;
  assetId?: string;
  yearOfConstruction?: string;
  location?: string;
};

// Complete snapshot of parsed AAS data
export type AasSnapshot = {
  source: AasSource;
  rawText: string;
  parseOk: boolean;
  errors?: string[];
  asset: AasAsset;
  docs: AasDocument[];
  contacts: AasContact[];
};

// User role for filtering visible content
export type UserRole = 'operator' | 'maintenance' | 'quality' | 'procurement';

// Pinned/favorite asset
export type FavoriteAsset = {
  id: string;
  snapshot: AasSnapshot;
  pinnedAt: number;
  nickname?: string;
};

// Custom field mapping configuration
export type FieldMapping = {
  displayName: string[];
  manufacturer: string[];
  serialNumber: string[];
  productDesignation: string[];
  assetId: string[];
};

// User settings stored in chrome.storage
export type UserSettings = {
  currentRole: UserRole;
  fieldMappings: FieldMapping;
};

// Message types for chrome.runtime messaging
export type MessageType =
  | 'EXTRACT_FROM_PAGE'
  | 'EXTRACTION_RESULT'
  | 'OPEN_SIDE_PANEL'
  | 'GET_CURRENT_SNAPSHOT';

export type ExtensionMessage = {
  type: MessageType;
  payload?: unknown;
};

// Role visibility configuration
export type RoleVisibility = {
  safetyDocs: boolean;
  serviceContacts: boolean;
  certificates: boolean;
  manuals: boolean;
  orderingInfo: boolean;
};

export const ROLE_VISIBILITY: Record<UserRole, RoleVisibility> = {
  operator: {
    safetyDocs: true,
    serviceContacts: false,
    certificates: false,
    manuals: true,
    orderingInfo: false,
  },
  maintenance: {
    safetyDocs: true,
    serviceContacts: true,
    certificates: false,
    manuals: true,
    orderingInfo: false,
  },
  quality: {
    safetyDocs: true,
    serviceContacts: false,
    certificates: true,
    manuals: false,
    orderingInfo: false,
  },
  procurement: {
    safetyDocs: false,
    serviceContacts: true,
    certificates: false,
    manuals: false,
    orderingInfo: true,
  },
};
