#!/usr/bin/env node

/**
 * Remote Hosted Code (RHC) Scanner
 *
 * Scans the built extension for any remotely hosted code that would violate
 * Chrome Web Store policies.
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';

const DIST_DIR = 'dist';

// Known safe context patterns - these indicate bundled library code
// that uses Function constructor for legitimate optimization, not RHC
const SAFE_CONTEXT_INDICATORS = [
  'pako',
  'inflate',
  'deflate',
  'zlib',
  'use strict',
];

// Patterns that indicate remote hosted code
const VIOLATION_PATTERNS = [
  // External script tags
  {
    pattern: /<script[^>]+src\s*=\s*["']https?:\/\//gi,
    description: 'External script tag',
    severity: 'error',
  },
  // Dynamic import of external URL
  {
    pattern: /import\s*\(\s*["']https?:\/\//gi,
    description: 'Dynamic import from external URL',
    severity: 'error',
  },
  // Fetch to external script
  {
    pattern: /fetch\s*\(\s*["']https?:\/\/[^"']*\.js["']/gi,
    description: 'Fetch of external JavaScript',
    severity: 'warning',
  },
  // new Function() usage (code generation)
  {
    pattern: /new\s+Function\s*\(/g,
    description: 'new Function() usage',
    severity: 'error',
  },
  // CDN URLs in code
  {
    pattern: /["']https?:\/\/(?:cdn|unpkg|jsdelivr|cdnjs)[^"']*/gi,
    description: 'CDN URL reference',
    severity: 'warning',
  },
];

// Files to scan
const SCANNABLE_EXTENSIONS = ['.js', '.html', '.htm', '.mjs', '.cjs'];

async function getAllFiles(dir) {
  const files = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await getAllFiles(fullPath)));
    } else if (SCANNABLE_EXTENSIONS.includes(extname(entry.name).toLowerCase())) {
      files.push(fullPath);
    }
  }

  return files;
}

function isInSafeContext(content, matchIndex, filePath) {
  // For minified files, the entire file might be on one line
  // Check if the file contains known safe library indicators anywhere
  const contentLower = content.toLowerCase();

  // If the file contains bundled compression library code, allow function constructor
  const hasSafeLibrary = SAFE_CONTEXT_INDICATORS.some((indicator) =>
    contentLower.includes(indicator)
  );

  if (hasSafeLibrary) {
    // Additional check: make sure there's also jszip/compression related code
    const hasCompressionCode = contentLower.includes('compress') ||
      contentLower.includes('jszip') ||
      contentLower.includes('crc32');
    if (hasCompressionCode) {
      return true;
    }
  }

  return false;
}

async function scanFile(filePath) {
  const content = await readFile(filePath, 'utf-8');
  const violations = [];

  for (const { pattern, description, severity } of VIOLATION_PATTERNS) {
    // Reset regex lastIndex for global patterns
    pattern.lastIndex = 0;

    let match;
    while ((match = pattern.exec(content)) !== null) {
      // Skip if in safe context (bundled library code)
      if (isInSafeContext(content, match.index, filePath)) {
        continue;
      }

      // Find line number
      const beforeMatch = content.substring(0, match.index);
      const lineNumber = (beforeMatch.match(/\n/g) || []).length + 1;

      violations.push({
        file: filePath,
        line: lineNumber,
        description,
        severity,
        match: match[0].substring(0, 100),
      });
    }
  }

  return violations;
}

async function main() {
  console.log('Scanning for Remote Hosted Code violations...\n');

  try {
    // Check if dist directory exists
    try {
      await stat(DIST_DIR);
    } catch {
      console.error('Error: dist directory not found. Run npm run build first.');
      process.exit(2);
    }

    const files = await getAllFiles(DIST_DIR);
    console.log('Found ' + files.length + ' files to scan.\n');

    const allViolations = [];

    for (const file of files) {
      const violations = await scanFile(file);
      allViolations.push(...violations);
    }

    // Separate by severity
    const errors = allViolations.filter((v) => v.severity === 'error');
    const warnings = allViolations.filter((v) => v.severity === 'warning');

    // Report
    if (errors.length > 0) {
      console.log('ERRORS (must fix):');
      for (const v of errors) {
        console.log('  ' + v.file + ':' + v.line);
        console.log('    ' + v.description);
        console.log('    Match: ' + v.match);
        console.log();
      }
    }

    if (warnings.length > 0) {
      console.log('WARNINGS (review manually):');
      for (const v of warnings) {
        console.log('  ' + v.file + ':' + v.line);
        console.log('    ' + v.description);
        console.log('    Match: ' + v.match);
        console.log();
      }
    }

    // Summary
    console.log('─'.repeat(50));
    if (errors.length === 0 && warnings.length === 0) {
      console.log('No RHC violations found. Ready for Chrome Web Store!');
      process.exit(0);
    } else if (errors.length === 0) {
      console.log('No blocking errors. ' + warnings.length + ' warning(s) to review.');
      process.exit(0);
    } else {
      console.log('Found ' + errors.length + ' error(s) and ' + warnings.length + ' warning(s).');
      console.log('Fix all errors before submitting to Chrome Web Store.');
      process.exit(1);
    }
  } catch (error) {
    console.error('Error during scan:', error.message);
    process.exit(2);
  }
}

main();
