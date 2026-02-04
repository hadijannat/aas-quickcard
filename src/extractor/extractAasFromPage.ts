/**
 * Page extractor - extracts AAS JSON from the current page.
 * This module is designed to be injected via chrome.scripting.executeScript.
 *
 * Note: The actual extraction function is defined in service-worker.ts
 * because chrome.scripting.executeScript requires the function to be
 * self-contained (no imports). This file provides utility functions
 * and types for handling the extraction results.
 */

export interface ExtractionResult {
  success: boolean;
  rawJson?: string;
  url?: string;
  error?: string;
}

/**
 * Validates that a string contains valid JSON
 */
export function isValidJson(text: string): boolean {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks if the JSON looks like AAS data
 */
export function looksLikeAasJson(json: unknown): boolean {
  if (typeof json !== 'object' || json === null) {
    return false;
  }

  const obj = json as Record<string, unknown>;

  // Check for common AAS root properties
  const aasIndicators = [
    'assetAdministrationShells',
    'submodels',
    'assets',
    'conceptDescriptions',
    'assetInformation',
    'idShort',
    'semanticId',
  ];

  return aasIndicators.some((key) => key in obj);
}

/**
 * Attempts to extract and validate AAS JSON from raw text
 */
export function extractAasJson(rawText: string): { json: unknown; error?: string } | null {
  // Try direct parse first
  try {
    const parsed = JSON.parse(rawText);
    if (looksLikeAasJson(parsed)) {
      return { json: parsed };
    }
    return { json: parsed, error: 'JSON parsed but does not appear to be AAS format' };
  } catch {
    // Not valid JSON
    return null;
  }
}
