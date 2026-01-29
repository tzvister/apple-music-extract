#!/usr/bin/env node

/**
 * amlib-export-artists - Single-file version
 * Export unique artist names from Apple Music Library to CSV
 * 
 * Usage: node amlib-export-artists.js [--out artists.csv] [--sort]
 */

import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import path from 'node:path';

// ============================================================================
// AppleScript (embedded)
// ============================================================================

const APPLESCRIPT = `
tell application "Music"
    try
        set trackList to every track of library playlist 1
        set artistList to {}
        repeat with t in trackList
            set end of artistList to (artist of t)
        end repeat
        set AppleScript's text item delimiters to linefeed
        return artistList as text
    on error errMsg number errNum
        error errMsg number errNum
    end try
end tell
`;

// ============================================================================
// Exit codes
// ============================================================================

const ExitCodes = {
  SUCCESS: 0,
  MUSIC_UNAVAILABLE: 2,
  PERMISSION_DENIED: 3,
  APPLESCRIPT_ERROR: 4,
  FILE_WRITE_ERROR: 5
};

// ============================================================================
// Argument parsing
// ============================================================================

function parseArgs(args) {
  const options = {
    out: 'artists.csv',
    sort: false,
    help: false
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--out' || arg === '-o') {
      options.out = args[++i] || 'artists.csv';
    } else if (arg === '--sort' || arg === '-s') {
      options.sort = true;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    }
  }
  return options;
}

function printHelp() {
  console.log(`
amlib-export-artists - Export unique artist names from Apple Music Library to CSV

USAGE:
  node amlib-export-artists.js [OPTIONS]

OPTIONS:
  --out, -o <path>    Output CSV file path (default: artists.csv)
  --sort, -s          Sort artists alphabetically
  --help, -h          Show this help message

EXAMPLES:
  node amlib-export-artists.js
  node amlib-export-artists.js --out ~/Desktop/my-artists.csv --sort

PERMISSIONS:
  On first run, macOS will prompt for Automation permission to control Music.app.
  If denied, go to: System Settings → Privacy & Security → Automation
  and enable Music access for your terminal application.
`);
}

// ============================================================================
// Error detection
// ============================================================================

function detectErrorType(stderr) {
  const lower = stderr.toLowerCase();
  if (lower.includes('not authorized') || lower.includes('-1743') || lower.includes('user canceled')) {
    return ExitCodes.PERMISSION_DENIED;
  }
  if (lower.includes('application isn\'t running') || lower.includes('can\'t be found')) {
    return ExitCodes.MUSIC_UNAVAILABLE;
  }
  return ExitCodes.APPLESCRIPT_ERROR;
}

function getErrorMessage(code, details = '') {
  switch (code) {
    case ExitCodes.MUSIC_UNAVAILABLE:
      return 'Error: Music.app is not available or cannot be launched.';
    case ExitCodes.PERMISSION_DENIED:
      return `Error: Automation permission denied.

To fix this:
1. Open System Settings → Privacy & Security → Automation
2. Find your terminal app in the list
3. Enable the toggle for "Music"
4. Re-run this command`;
    case ExitCodes.FILE_WRITE_ERROR:
      return `Error: Failed to write CSV file.\nDetails: ${details}`;
    default:
      return `Error: Unexpected error.\nDetails: ${details}`;
  }
}

// ============================================================================
// Artist extraction
// ============================================================================

function extractArtists() {
  return new Promise((resolve) => {
    const artists = [];
    let stderr = '';
    
    const proc = spawn('osascript', ['-e', APPLESCRIPT]);
    
    const rl = createInterface({ input: proc.stdout, crlfDelay: Infinity });
    rl.on('line', (line) => artists.push(line));
    
    proc.stderr.on('data', (data) => { stderr += data.toString(); });
    
    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ artists, exitCode: ExitCodes.SUCCESS });
      } else {
        resolve({ artists, exitCode: detectErrorType(stderr), error: stderr.trim() });
      }
    });
    
    proc.on('error', (err) => {
      resolve({ artists, exitCode: ExitCodes.APPLESCRIPT_ERROR, error: err.message });
    });
  });
}

// ============================================================================
// Normalization & deduplication
// ============================================================================

function normalizeAndDedupe(rawArtists, sort = false) {
  const seen = new Map();
  for (const artist of rawArtists) {
    const trimmed = artist.trim();
    if (!trimmed) continue;
    const key = trimmed.toLocaleLowerCase();
    if (!seen.has(key)) seen.set(key, trimmed);
  }
  let unique = [...seen.values()];
  if (sort) unique.sort((a, b) => a.localeCompare(b));
  return unique;
}

// ============================================================================
// CSV writing (RFC4180)
// ============================================================================

function escapeField(value) {
  if (/[",\n\r]/.test(value)) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

function writeCSV(filePath, artists) {
  const content = ['artist', ...artists.map(escapeField)].join('\n') + '\n';
  writeFileSync(filePath, content, { encoding: 'utf8' });
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const options = parseArgs(process.argv.slice(2));
  
  if (options.help) {
    printHelp();
    process.exit(0);
  }
  
  const outPath = path.resolve(options.out);
  console.error('Extracting artists from Music.app...');
  
  const { artists, exitCode, error } = await extractArtists();
  
  if (exitCode !== ExitCodes.SUCCESS) {
    console.error(getErrorMessage(exitCode, error));
    process.exit(exitCode);
  }
  
  const unique = normalizeAndDedupe(artists, options.sort);
  
  try {
    writeCSV(outPath, unique);
  } catch (err) {
    console.error(getErrorMessage(ExitCodes.FILE_WRITE_ERROR, err.message));
    process.exit(ExitCodes.FILE_WRITE_ERROR);
  }
  
  console.error(`Exported ${unique.length} unique artists to ${outPath}`);
  process.exit(0);
}

main();
