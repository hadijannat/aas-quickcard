import type { ComplianceProfileType } from '../shared/types';

/**
 * Compliance requirement definition
 */
export type ComplianceRequirement = {
  id: string;
  requirement: string;
  description: string;
  mandatory: boolean;
  // Check methods
  checkSubmodel?: {
    idShortPatterns?: RegExp[];
    semanticIdPatterns?: string[];
  };
  checkProperty?: {
    idShortPatterns: RegExp[];
  };
  checkDocument?: {
    kindPatterns?: string[];
    titlePatterns?: RegExp[];
  };
};

/**
 * Compliance profile definition
 */
export type ComplianceProfile = {
  type: ComplianceProfileType;
  name: string;
  description: string;
  region?: string;
  requirements: ComplianceRequirement[];
};

/**
 * CE Marking Requirements (EU)
 * Based on applicable EU directives (Machinery Directive, LVD, EMC, etc.)
 */
const CE_MARKING_PROFILE: ComplianceProfile = {
  type: 'ce-marking',
  name: 'CE Marking',
  description: 'EU Conformity Marking - Declaration of Conformity and related documentation',
  region: 'EU',
  requirements: [
    {
      id: 'ce-doc',
      requirement: 'Declaration of Conformity',
      description: 'EU Declaration of Conformity document required for CE marking',
      mandatory: true,
      checkDocument: {
        kindPatterns: ['certificate'],
        titlePatterns: [
          /declaration.*conformity/i,
          /conformit[äy].*erkl[äa]rung/i,  // German
          /ce.*declaration/i,
          /eu.*declaration/i,
        ],
      },
    },
    {
      id: 'ce-tech-doc',
      requirement: 'Technical Documentation',
      description: 'Technical file with design, manufacturing, and operation information',
      mandatory: true,
      checkDocument: {
        titlePatterns: [
          /technical.*documentation/i,
          /technical.*file/i,
          /technische.*dokumentation/i,
        ],
      },
      checkSubmodel: {
        idShortPatterns: [/technical.*data/i],
      },
    },
    {
      id: 'ce-instructions',
      requirement: 'User Instructions',
      description: 'Instructions for use in official language(s) of destination country',
      mandatory: true,
      checkDocument: {
        kindPatterns: ['manual'],
        titlePatterns: [
          /instruction/i,
          /user.*manual/i,
          /operating.*manual/i,
          /bedienungsanleitung/i,
        ],
      },
    },
    {
      id: 'ce-risk-assessment',
      requirement: 'Risk Assessment',
      description: 'Risk assessment and analysis documentation',
      mandatory: false,
      checkDocument: {
        titlePatterns: [
          /risk.*assessment/i,
          /hazard.*analysis/i,
          /risikobewertung/i,
        ],
      },
    },
    {
      id: 'ce-safety-info',
      requirement: 'Safety Information',
      description: 'Safety warnings and hazard information',
      mandatory: true,
      checkDocument: {
        kindPatterns: ['safety'],
      },
    },
  ],
};

/**
 * REACH Requirements (EU)
 * Registration, Evaluation, Authorisation and Restriction of Chemicals
 */
const REACH_PROFILE: ComplianceProfile = {
  type: 'reach',
  name: 'REACH Compliance',
  description: 'EU REACH Regulation - Substances of Very High Concern (SVHC) compliance',
  region: 'EU',
  requirements: [
    {
      id: 'reach-svhc',
      requirement: 'SVHC Declaration',
      description: 'Declaration of Substances of Very High Concern (>0.1% w/w)',
      mandatory: true,
      checkDocument: {
        titlePatterns: [
          /svhc/i,
          /reach.*declaration/i,
          /substance.*declaration/i,
          /reach.*compliance/i,
        ],
      },
      checkProperty: {
        idShortPatterns: [
          /svhc/i,
          /reach/i,
          /substance.*concern/i,
        ],
      },
    },
    {
      id: 'reach-sds',
      requirement: 'Safety Data Sheet',
      description: 'Safety Data Sheet (SDS) for hazardous substances',
      mandatory: false,
      checkDocument: {
        kindPatterns: ['safety'],
        titlePatterns: [
          /safety.*data.*sheet/i,
          /sds/i,
          /sicherheitsdatenblatt/i,
        ],
      },
    },
    {
      id: 'reach-material-comp',
      requirement: 'Material Composition',
      description: 'Material composition information',
      mandatory: false,
      checkSubmodel: {
        idShortPatterns: [
          /material/i,
          /composition/i,
          /zusammensetzung/i,
        ],
      },
    },
  ],
};

/**
 * RoHS Requirements (EU)
 * Restriction of Hazardous Substances
 */
const ROHS_PROFILE: ComplianceProfile = {
  type: 'rohs',
  name: 'RoHS Compliance',
  description: 'EU RoHS Directive - Restriction of Hazardous Substances in electrical equipment',
  region: 'EU',
  requirements: [
    {
      id: 'rohs-declaration',
      requirement: 'RoHS Declaration',
      description: 'Declaration of compliance with RoHS restricted substances',
      mandatory: true,
      checkDocument: {
        titlePatterns: [
          /rohs/i,
          /hazardous.*substance/i,
          /gefahrstoff/i,
        ],
      },
      checkProperty: {
        idShortPatterns: [
          /rohs/i,
          /restricted.*substance/i,
        ],
      },
    },
    {
      id: 'rohs-test-report',
      requirement: 'Test Report',
      description: 'Laboratory test report for restricted substances',
      mandatory: false,
      checkDocument: {
        titlePatterns: [
          /rohs.*test/i,
          /substance.*test/i,
          /laboratory.*report/i,
        ],
      },
    },
    {
      id: 'rohs-exemption',
      requirement: 'Exemption Documentation',
      description: 'Documentation for any RoHS exemptions claimed',
      mandatory: false,
      checkDocument: {
        titlePatterns: [
          /rohs.*exemption/i,
          /exemption/i,
        ],
      },
    },
  ],
};

/**
 * Digital Product Passport (DPP) Requirements (EU)
 * Upcoming EU regulation for product sustainability information
 */
const DPP_PROFILE: ComplianceProfile = {
  type: 'dpp',
  name: 'Digital Product Passport',
  description: 'EU Digital Product Passport - Sustainability and circularity information',
  region: 'EU',
  requirements: [
    {
      id: 'dpp-pcf',
      requirement: 'Product Carbon Footprint',
      description: 'CO2 equivalent emissions data for the product',
      mandatory: true,
      checkSubmodel: {
        idShortPatterns: [
          /carbon.*footprint/i,
          /pcf/i,
        ],
        semanticIdPatterns: [
          'https://admin-shell.io/idta/CarbonFootprint/ProductCarbonFootprint/',
        ],
      },
    },
    {
      id: 'dpp-materials',
      requirement: 'Material Composition',
      description: 'Detailed material composition and sourcing information',
      mandatory: true,
      checkSubmodel: {
        idShortPatterns: [
          /material/i,
          /composition/i,
          /bom/i,
          /bill.*material/i,
        ],
      },
    },
    {
      id: 'dpp-recyclability',
      requirement: 'Recyclability Information',
      description: 'End-of-life and recyclability information',
      mandatory: true,
      checkSubmodel: {
        idShortPatterns: [
          /recycl/i,
          /end.*life/i,
          /disposal/i,
          /entsorgung/i,
        ],
      },
      checkProperty: {
        idShortPatterns: [
          /recycl/i,
          /disposal/i,
        ],
      },
    },
    {
      id: 'dpp-durability',
      requirement: 'Durability Information',
      description: 'Expected lifetime and durability data',
      mandatory: false,
      checkSubmodel: {
        idShortPatterns: [
          /durability/i,
          /lifetime/i,
          /reliability/i,
        ],
      },
      checkProperty: {
        idShortPatterns: [
          /lifetime/i,
          /mtbf/i,
          /durability/i,
        ],
      },
    },
    {
      id: 'dpp-repair',
      requirement: 'Repair Information',
      description: 'Spare parts and repair instructions',
      mandatory: false,
      checkSubmodel: {
        idShortPatterns: [
          /spare.*part/i,
          /repair/i,
          /maintenance/i,
        ],
      },
      checkDocument: {
        titlePatterns: [
          /repair/i,
          /maintenance/i,
          /service/i,
        ],
      },
    },
    {
      id: 'dpp-unique-id',
      requirement: 'Unique Product Identifier',
      description: 'Globally unique product identifier',
      mandatory: true,
      checkProperty: {
        idShortPatterns: [
          /serial.*number/i,
          /global.*asset.*id/i,
          /unique.*id/i,
        ],
      },
    },
    {
      id: 'dpp-manufacturer',
      requirement: 'Manufacturer Information',
      description: 'Manufacturer identification and contact information',
      mandatory: true,
      checkSubmodel: {
        idShortPatterns: [
          /nameplate/i,
          /contact/i,
          /manufacturer/i,
        ],
      },
    },
  ],
};

/**
 * All available compliance profiles
 */
export const COMPLIANCE_PROFILES: Record<ComplianceProfileType, ComplianceProfile> = {
  'ce-marking': CE_MARKING_PROFILE,
  'reach': REACH_PROFILE,
  'rohs': ROHS_PROFILE,
  'dpp': DPP_PROFILE,
};

/**
 * Get compliance profile by type
 */
export function getComplianceProfile(type: ComplianceProfileType): ComplianceProfile {
  return COMPLIANCE_PROFILES[type];
}

/**
 * Get all compliance profiles
 */
export function getAllComplianceProfiles(): ComplianceProfile[] {
  return Object.values(COMPLIANCE_PROFILES);
}

/**
 * Get profiles applicable to a specific region
 */
export function getProfilesByRegion(region: string): ComplianceProfile[] {
  return Object.values(COMPLIANCE_PROFILES).filter(
    (p) => !p.region || p.region === region
  );
}
