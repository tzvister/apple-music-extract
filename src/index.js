#!/usr/bin/env node

import path from 'node:path';
import { extractArtists, ExitCodes, getErrorMessage } from './extractor.js';
import { createNormalizer } from './normalizer.js';
import { writeCSV } from './csv-writer.js';

/**
 * Parse command line arguments
 * @param {string[]} args - Process argv slice (excluding node and script)
 * @returns {Object} Parsed options
 */
function parseArgs(args) {
  const options = {
    out: 'artists.csv',
    sort: false,
    limit: null,
    noTrim: false,
    help: false
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--out':
      case '-o':
        options.out = args[++i];
        if (!options.out) {
          console.error('Error: --out requires a file path argument');
          process.exit(1);
        }
        break;
      
      case '--sort':
      case '-s':
        options.sort = true;
        break;
      
      case '--limit':
      case '-l':
        options.limit = parseInt(args[++i], 10);
        if (isNaN(options.limit) || options.limit <= 0) {
          console.error('Error: --limit requires a positive integer');
          process.exit(1);
        }
        break;
      
      case '--no-trim':
        options.noTrim = true;
        break;
      
      case '--help':
      case '-h':
        options.help = true;
        break;
      
      default:
        if (arg.startsWith('-')) {
          console.error(`Error: Unknown option: ${arg}`);
          process.exit(1);
        }
    }
  }
  
  return options;
}

/**
 * Print help message
 */
function printHelp() {
  console.log(`
amlib-export-artists - Export unique artist names from Apple Music Library to CSV

USAGE:
  amlib-export-artists [OPTIONS]

OPTIONS:
  --out, -o <path>    Output CSV file path (default: artists.csv)
  --sort, -s          Sort artists alphabetically
  --limit, -l <N>     Stop after extracting N tracks (for debugging)
  --no-trim           Disable whitespace trimming
  --help, -h          Show this help message

EXAMPLES:
  amlib-export-artists
  amlib-export-artists --out ~/Desktop/my-artists.csv --sort
  amlib-export-artists --limit 100

OUTPUT:
  Creates a CSV file with header "artist" and one unique artist per row.
  Artists are deduplicated case-insensitively (first occurrence kept).

PERMISSIONS:
  On first run, macOS will prompt for Automation permission to control Music.app.
  If denied, go to: System Settings → Privacy & Security → Automation
  and enable Music access for your terminal application.
`);
}

/**
 * Main entry point
 */
async function main() {
  const args = process.argv.slice(2);
  const options = parseArgs(args);
  
  if (options.help) {
    printHelp();
    process.exit(0);
  }
  
  // Resolve output path
  const outPath = path.resolve(options.out);
  
  console.error(`Extracting artists from Music.app...`);
  
  // Create normalizer with options
  const normalizer = createNormalizer({
    noTrim: options.noTrim,
    sort: options.sort
  });
  
  // Extract artists from Music.app
  const { artists: rawArtists, exitCode, error } = await extractArtists({
    limit: options.limit
  });
  
  // Check for extraction errors
  if (exitCode !== ExitCodes.SUCCESS) {
    console.error(getErrorMessage(exitCode, error));
    process.exit(exitCode);
  }
  
  // Process through normalizer
  for (const artist of rawArtists) {
    normalizer.add(artist);
  }
  
  const uniqueArtists = normalizer.getUniqueArtists();
  
  // Write CSV
  try {
    writeCSV(outPath, uniqueArtists);
  } catch (err) {
    console.error(getErrorMessage(ExitCodes.FILE_WRITE_ERROR, err.message));
    process.exit(ExitCodes.FILE_WRITE_ERROR);
  }
  
  // Success message
  const limitNote = options.limit ? ` (limited to ${options.limit} tracks)` : '';
  console.error(`Exported ${uniqueArtists.length} unique artists to ${outPath}${limitNote}`);
  
  process.exit(ExitCodes.SUCCESS);
}

// Run
main().catch((err) => {
  console.error(`Unexpected error: ${err.message}`);
  process.exit(1);
});
