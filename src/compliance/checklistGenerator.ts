import type { AasSnapshot, ComplianceCheck, ComplianceResult, ComplianceProfileType } from '../shared/types';
import { getComplianceProfile, type ComplianceRequirement } from './complianceProfiles';

/**
 * Run compliance check for a given profile against an AAS snapshot
 */
export function runComplianceCheck(
  snapshot: AasSnapshot,
  profileType: ComplianceProfileType
): ComplianceResult {
  const profile = getComplianceProfile(profileType);
  const checks: ComplianceCheck[] = [];

  for (const req of profile.requirements) {
    const check = evaluateRequirement(snapshot, req);
    checks.push(check);
  }

  const passedCount = checks.filter((c) => c.present).length;
  const mandatoryPassed = checks.filter((c) => c.mandatory && c.present).length;
  const mandatoryTotal = checks.filter((c) => c.mandatory).length;

  return {
    profileType,
    profileName: profile.name,
    checks,
    passedCount,
    totalCount: checks.length,
    mandatoryPassed,
    mandatoryTotal,
  };
}

/**
 * Evaluate a single compliance requirement
 */
function evaluateRequirement(
  snapshot: AasSnapshot,
  req: ComplianceRequirement
): ComplianceCheck {
  let present = false;
  let source: string | undefined;

  // Check submodel patterns
  if (req.checkSubmodel && snapshot.submodels) {
    const submodelMatch = findMatchingSubmodel(snapshot, req.checkSubmodel);
    if (submodelMatch) {
      present = true;
      source = `Submodel: ${submodelMatch}`;
    }
  }

  // Check property patterns (search in asset data)
  if (!present && req.checkProperty) {
    const propertyMatch = findMatchingProperty(snapshot, req.checkProperty);
    if (propertyMatch) {
      present = true;
      source = `Property: ${propertyMatch}`;
    }
  }

  // Check document patterns
  if (!present && req.checkDocument) {
    const docMatch = findMatchingDocument(snapshot, req.checkDocument);
    if (docMatch) {
      present = true;
      source = `Document: ${docMatch}`;
    }
  }

  return {
    requirement: req.requirement,
    description: req.description,
    present,
    source,
    mandatory: req.mandatory,
  };
}

/**
 * Find a submodel matching the requirement patterns
 */
function findMatchingSubmodel(
  snapshot: AasSnapshot,
  check: { idShortPatterns?: RegExp[]; semanticIdPatterns?: string[] }
): string | undefined {
  if (!snapshot.submodels) return undefined;

  for (const sm of snapshot.submodels) {
    // Check idShort patterns
    if (check.idShortPatterns) {
      for (const pattern of check.idShortPatterns) {
        if (pattern.test(sm.idShort)) {
          return sm.idShort;
        }
      }
    }

    // Check semantic ID patterns
    if (check.semanticIdPatterns && sm.semanticId) {
      for (const pattern of check.semanticIdPatterns) {
        if (sm.semanticId.includes(pattern)) {
          return sm.idShort;
        }
      }
    }
  }

  return undefined;
}

/**
 * Find a property matching the requirement patterns
 */
function findMatchingProperty(
  snapshot: AasSnapshot,
  check: { idShortPatterns: RegExp[] }
): string | undefined {
  // Check in asset basic properties
  const assetProperties = [
    { name: 'serialNumber', value: snapshot.asset.serialNumber },
    { name: 'manufacturer', value: snapshot.asset.manufacturer },
    { name: 'assetId', value: snapshot.asset.assetId },
    { name: 'displayName', value: snapshot.asset.displayName },
  ];

  for (const prop of assetProperties) {
    if (!prop.value) continue;
    for (const pattern of check.idShortPatterns) {
      if (pattern.test(prop.name)) {
        return prop.name;
      }
    }
  }

  // Check in submodel elements
  if (snapshot.submodels) {
    for (const sm of snapshot.submodels) {
      if (sm.elements) {
        for (const el of sm.elements) {
          for (const pattern of check.idShortPatterns) {
            if (pattern.test(el.idShort)) {
              return `${sm.idShort}.${el.idShort}`;
            }
          }
        }
      }
    }
  }

  // Check PCF data
  if (snapshot.pcf?.co2Equivalent !== undefined) {
    for (const pattern of check.idShortPatterns) {
      if (pattern.test('pcf') || pattern.test('carbon') || pattern.test('co2')) {
        return 'PCF data';
      }
    }
  }

  return undefined;
}

/**
 * Find a document matching the requirement patterns
 */
function findMatchingDocument(
  snapshot: AasSnapshot,
  check: { kindPatterns?: string[]; titlePatterns?: RegExp[] }
): string | undefined {
  for (const doc of snapshot.docs) {
    // Check kind patterns
    if (check.kindPatterns) {
      if (check.kindPatterns.includes(doc.kind)) {
        // Also check title patterns if provided
        if (check.titlePatterns) {
          for (const pattern of check.titlePatterns) {
            if (pattern.test(doc.title)) {
              return doc.title;
            }
          }
        } else {
          return doc.title;
        }
      }
    }

    // Check title patterns only
    if (check.titlePatterns && !check.kindPatterns) {
      for (const pattern of check.titlePatterns) {
        if (pattern.test(doc.title)) {
          return doc.title;
        }
      }
    }
  }

  return undefined;
}

/**
 * Run all compliance checks against an AAS snapshot
 */
export function runAllComplianceChecks(snapshot: AasSnapshot): ComplianceResult[] {
  const profiles: ComplianceProfileType[] = ['ce-marking', 'reach', 'rohs', 'dpp'];
  return profiles.map((p) => runComplianceCheck(snapshot, p));
}

/**
 * Generate markdown report from compliance results
 */
export function generateComplianceReport(
  snapshot: AasSnapshot,
  results: ComplianceResult[]
): string {
  const lines: string[] = [];

  // Header
  lines.push('# Compliance Report');
  lines.push('');
  lines.push(`**Asset:** ${snapshot.asset.displayName || 'Unknown'}`);
  lines.push(`**Manufacturer:** ${snapshot.asset.manufacturer || 'N/A'}`);
  lines.push(`**Serial Number:** ${snapshot.asset.serialNumber || 'N/A'}`);
  lines.push(`**Generated:** ${new Date().toISOString()}`);
  lines.push('');

  // Summary
  lines.push('## Summary');
  lines.push('');
  lines.push('| Profile | Status | Mandatory | Optional |');
  lines.push('|---------|--------|-----------|----------|');

  for (const result of results) {
    const mandatoryStatus =
      result.mandatoryPassed === result.mandatoryTotal
        ? '✅'
        : `⚠️ ${result.mandatoryPassed}/${result.mandatoryTotal}`;
    const optionalPassed = result.passedCount - result.mandatoryPassed;
    const optionalTotal = result.totalCount - result.mandatoryTotal;
    const optionalStatus = `${optionalPassed}/${optionalTotal}`;

    lines.push(
      `| ${result.profileName} | ${mandatoryStatus} | ${result.mandatoryPassed}/${result.mandatoryTotal} | ${optionalStatus} |`
    );
  }
  lines.push('');

  // Detailed results per profile
  for (const result of results) {
    lines.push(`## ${result.profileName}`);
    lines.push('');

    // Group by status
    const passed = result.checks.filter((c) => c.present);
    const failed = result.checks.filter((c) => !c.present);

    if (failed.length > 0) {
      lines.push('### ❌ Missing');
      lines.push('');
      for (const check of failed) {
        const mandatory = check.mandatory ? ' **(Mandatory)**' : '';
        lines.push(`- ${check.requirement}${mandatory}`);
        if (check.description) {
          lines.push(`  - ${check.description}`);
        }
      }
      lines.push('');
    }

    if (passed.length > 0) {
      lines.push('### ✅ Present');
      lines.push('');
      for (const check of passed) {
        lines.push(`- ${check.requirement}`);
        if (check.source) {
          lines.push(`  - Source: ${check.source}`);
        }
      }
      lines.push('');
    }
  }

  // Footer
  lines.push('---');
  lines.push('*Generated by AAS QuickCard*');

  return lines.join('\n');
}

/**
 * Calculate overall compliance score (percentage)
 */
export function calculateComplianceScore(result: ComplianceResult): number {
  if (result.totalCount === 0) return 100;
  return Math.round((result.passedCount / result.totalCount) * 100);
}

/**
 * Calculate mandatory compliance score (percentage)
 */
export function calculateMandatoryScore(result: ComplianceResult): number {
  if (result.mandatoryTotal === 0) return 100;
  return Math.round((result.mandatoryPassed / result.mandatoryTotal) * 100);
}

/**
 * Get compliance status label
 */
export function getComplianceStatusLabel(result: ComplianceResult): 'compliant' | 'partial' | 'non-compliant' {
  if (result.mandatoryPassed === result.mandatoryTotal) {
    return 'compliant';
  } else if (result.mandatoryPassed > 0) {
    return 'partial';
  }
  return 'non-compliant';
}
