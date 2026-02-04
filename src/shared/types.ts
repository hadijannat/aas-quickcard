// Source information for where the AAS data came from
export type AasSource = {
  type: 'activeTab' | 'paste' | 'file';
  url?: string;
  filename?: string;
  capturedAt: number;
};

// ====== New Types for Enhanced Features ======

// Lifecycle phase of an asset
export type LifecyclePhase =
  | 'development'
  | 'production'
  | 'operation'
  | 'maintenance'
  | 'disposal'
  | 'unknown';

// Submodel element type classification
export type SubmodelElementType =
  | 'Property'
  | 'MultiLanguageProperty'
  | 'Range'
  | 'Blob'
  | 'File'
  | 'ReferenceElement'
  | 'SubmodelElementCollection'
  | 'SubmodelElementList'
  | 'Entity'
  | 'BasicEventElement'
  | 'Operation'
  | 'Capability'
  | 'AnnotatedRelationshipElement'
  | 'RelationshipElement';

// Submodel element with basic info
export type SubmodelElement = {
  idShort: string;
  modelType: SubmodelElementType;
  value?: string | number | boolean;
  semanticId?: string;
};

// Submodel information
export type SubmodelInfo = {
  idShort: string;
  id?: string;
  semanticId?: string;
  templateName?: string;  // e.g., "IDTA-02006 Digital Nameplate"
  templateVersion?: string;
  elementCount: number;
  elements?: SubmodelElement[];
};

// Product Carbon Footprint data
export type PcfData = {
  co2Equivalent?: number;
  unit?: string;  // kg CO2e, g CO2e, etc.
  calculationMethod?: string;
  scope?: string;  // Scope 1, 2, 3, or combined
  validFrom?: string;
  validTo?: string;
  productLifecycleStage?: string;
  geographicScope?: string;
};

// Spare part category
export type SparePartCategory = 'wear' | 'consumable' | 'replacement' | 'other';

// Spare part information
export type SparePart = {
  partNumber: string;
  description?: string;
  manufacturerPartNumber?: string;
  category: SparePartCategory;
  quantity?: number;
  unit?: string;
  leadTime?: string;
  supplier?: string;
};

// Compliance check result
export type ComplianceCheck = {
  requirement: string;
  description?: string;
  present: boolean;
  source?: string;  // Which submodel/property satisfies this
  mandatory: boolean;
};

// Compliance profile type
export type ComplianceProfileType = 'ce-marking' | 'reach' | 'rohs' | 'dpp';

// Compliance profile result
export type ComplianceResult = {
  profileType: ComplianceProfileType;
  profileName: string;
  checks: ComplianceCheck[];
  passedCount: number;
  totalCount: number;
  mandatoryPassed: number;
  mandatoryTotal: number;
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
  commissioningDate?: string;
  lastServiceDate?: string;
};

// Complete snapshot of parsed AAS data
export type AasSnapshot = {
  source: AasSource;
  rawText?: string;  // Optional - trimmed snapshots won't have this
  parseOk: boolean;
  errors?: string[];
  asset: AasAsset;
  docs: AasDocument[];
  contacts: AasContact[];
  // Enhanced features
  submodels?: SubmodelInfo[];
  pcf?: PcfData;
  lifecyclePhase?: LifecyclePhase;
  spareParts?: SparePart[];
};

// User role for filtering visible content
export type UserRole = 'operator' | 'maintenance' | 'quality' | 'procurement';

// Pinned/favorite asset
export type FavoriteAsset = {
  id: string;
  snapshot: AasSnapshot;
  pinnedAt: number;
  nickname?: string;
  // Enhanced features
  tags?: string[];
  category?: string;
  notes?: string;
  searchableText?: string;  // Pre-computed for fast search
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
  | 'OPEN_SIDE_PANEL';

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
  // Enhanced features
  pcfCard: boolean;
  spareParts: boolean;
  complianceChecklist: boolean;
  submodelExplorer: boolean;
};

export const ROLE_VISIBILITY: Record<UserRole, RoleVisibility> = {
  operator: {
    safetyDocs: true,
    serviceContacts: false,
    certificates: false,
    manuals: true,
    orderingInfo: false,
    pcfCard: true,           // PCF visible to all (regulatory importance)
    spareParts: false,
    complianceChecklist: false,
    submodelExplorer: true,  // All roles can explore submodels
  },
  maintenance: {
    safetyDocs: true,
    serviceContacts: true,
    certificates: false,
    manuals: true,
    orderingInfo: false,
    pcfCard: true,
    spareParts: true,        // Maintenance needs spare parts
    complianceChecklist: false,
    submodelExplorer: true,
  },
  quality: {
    safetyDocs: true,
    serviceContacts: false,
    certificates: true,
    manuals: false,
    orderingInfo: false,
    pcfCard: true,
    spareParts: false,
    complianceChecklist: true,  // Quality needs compliance
    submodelExplorer: true,
  },
  procurement: {
    safetyDocs: false,
    serviceContacts: true,
    certificates: false,
    manuals: false,
    orderingInfo: true,
    pcfCard: true,
    spareParts: true,        // Procurement needs spare parts for ordering
    complianceChecklist: true,
    submodelExplorer: true,
  },
};
