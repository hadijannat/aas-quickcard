#!/usr/bin/env node

/**
 * Manifest Validator
 *
 * Validates the manifest.json file for Chrome Web Store compliance.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const MANIFEST_PATH = join('public', 'manifest.json');

// Required fields for MV3
const REQUIRED_FIELDS = ['manifest_version', 'name', 'version', 'description'];

// Dangerous permissions that need justification
const SENSITIVE_PERMISSIONS = ['tabs', 'webNavigation', 'webRequest', 'webRequestBlocking', 'cookies', 'browsingData'];

// Host permissions patterns that are too broad
const BROAD_HOST_PATTERNS = ['<all_urls>', '*://*/*', 'http://*/*', 'https://*/*'];

async function main() {
  console.log('Validating manifest.json...\n');

  let manifest;
  try {
    const content = await readFile(MANIFEST_PATH, 'utf-8');
    manifest = JSON.parse(content);
  } catch (error) {
    console.error('Failed to read/parse manifest.json:', error.message);
    process.exit(2);
  }

  const errors = [];
  const warnings = [];

  // Check manifest version
  if (manifest.manifest_version !== 3) {
    errors.push('manifest_version must be 3 for new submissions');
  }

  // Check required fields
  for (const field of REQUIRED_FIELDS) {
    if (!manifest[field]) {
      errors.push('Missing required field: ' + field);
    }
  }

  // Check name length
  if (manifest.name && manifest.name.length > 45) {
    errors.push('Extension name exceeds 45 characters');
  }

  // Check description length
  if (manifest.description && manifest.description.length > 132) {
    warnings.push('Description exceeds 132 characters (may be truncated)');
  }

  // Check for sensitive permissions
  const permissions = manifest.permissions || [];
  for (const perm of permissions) {
    if (SENSITIVE_PERMISSIONS.includes(perm)) {
      warnings.push('Sensitive permission requires justification: ' + perm);
    }
  }

  // Check for broad host permissions
  const hostPermissions = manifest.host_permissions || [];
  for (const host of hostPermissions) {
    if (BROAD_HOST_PATTERNS.includes(host)) {
      warnings.push('Broad host permission may require justification: ' + host);
    }
  }

  // Check for background service worker (required for MV3)
  if (manifest.background) {
    if (manifest.background.scripts) {
      errors.push('MV3 requires service_worker, not background scripts');
    }
    if (!manifest.background.service_worker) {
      errors.push('Missing background.service_worker');
    }
  }

  // Check icons
  if (!manifest.icons) {
    errors.push('Missing icons');
  } else {
    const requiredSizes = ['16', '48', '128'];
    for (const size of requiredSizes) {
      if (!manifest.icons[size]) {
        warnings.push('Missing icon size: ' + size);
      }
    }
  }

  // Check CSP
  if (manifest.content_security_policy) {
    const csp = manifest.content_security_policy;
    if (typeof csp === 'string') {
      errors.push('MV3 CSP must be an object with extension_pages key');
    }
  }

  // Check for remotely hosted code indicators
  if (manifest.externally_connectable) {
    warnings.push('externally_connectable may require additional review');
  }

  // Report
  console.log('Manifest: ' + manifest.name + ' v' + manifest.version);
  console.log('Manifest Version: ' + manifest.manifest_version);
  console.log('Permissions: ' + JSON.stringify(permissions));
  console.log();

  if (errors.length > 0) {
    console.log('ERRORS:');
    for (const e of errors) {
      console.log('  - ' + e);
    }
    console.log();
  }

  if (warnings.length > 0) {
    console.log('WARNINGS:');
    for (const w of warnings) {
      console.log('  - ' + w);
    }
    console.log();
  }

  // Summary
  console.log('─'.repeat(50));
  if (errors.length === 0 && warnings.length === 0) {
    console.log('Manifest validation passed!');
    process.exit(0);
  } else if (errors.length === 0) {
    console.log('Validation passed with ' + warnings.length + ' warning(s).');
    process.exit(0);
  } else {
    console.log('Validation failed with ' + errors.length + ' error(s).');
    process.exit(1);
  }
}

main();
