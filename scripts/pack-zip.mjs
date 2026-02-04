#!/usr/bin/env node

/**
 * Pack ZIP Script
 *
 * Creates a ZIP file from the dist directory for Chrome Web Store submission.
 */

import { createWriteStream } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';

// We'll use the built-in archiver pattern with manual ZIP creation
// For simplicity, this uses a basic approach that works without external deps

const DIST_DIR = 'dist';
const OUTPUT_FILE = 'dist.zip';

async function getAllFiles(dir, baseDir = dir) {
  const files = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await getAllFiles(fullPath, baseDir)));
    } else {
      files.push({
        path: fullPath,
        name: relative(baseDir, fullPath),
      });
    }
  }

  return files;
}

async function main() {
  console.log('Creating Chrome Web Store package...\n');

  try {
    // Check if dist directory exists
    try {
      await stat(DIST_DIR);
    } catch {
      console.error('Error: dist directory not found. Run npm run build first.');
      process.exit(2);
    }

    // Get all files
    const files = await getAllFiles(DIST_DIR);
    console.log('Found ' + files.length + ' files to package.\n');

    // For actual ZIP creation, we need to use JSZip or similar
    // Since JSZip is already a dependency, let's use it
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();

    for (const file of files) {
      const content = await import('node:fs/promises').then(fs => fs.readFile(file.path));
      zip.file(file.name, content);
      console.log('  Added: ' + file.name);
    }

    // Generate ZIP
    const zipContent = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 },
    });

    // Write to file
    const fs = await import('node:fs/promises');
    await fs.writeFile(OUTPUT_FILE, zipContent);

    const stats = await stat(OUTPUT_FILE);
    const sizeKB = (stats.size / 1024).toFixed(2);

    console.log('\n' + '─'.repeat(50));
    console.log('Package created: ' + OUTPUT_FILE);
    console.log('Size: ' + sizeKB + ' KB');
    console.log('\nReady for Chrome Web Store submission!');
    process.exit(0);
  } catch (error) {
    console.error('Error creating package:', error.message);
    process.exit(2);
  }
}

main();
