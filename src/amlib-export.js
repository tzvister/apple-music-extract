#!/usr/bin/env node

import path from 'node:path';
import { runAllChecks } from './system-check.js';
import {
  extractArtists,
  extractTracks,
  extractPlaylists,
  extractPlaylistTracks,
  ExitCodes,
  getErrorMessage
} from './extractor.js';
import {
  createNormalizer,
  normalizeArtists,
  normalizeAlbums,
  normalizeTracks,
  normalizePlaylists,
  normalizeArtistsFromTracks,
  prepareDetailedTracks,
  preparePlaylistTracks
} from './normalizer.js';
import {
  writeSingleColumnCSV,
  writeMultiColumnCSV,
  writeToStdout,
  generateSingleColumnData,
  generateMultiColumnData,
  generateColorizedSingleColumn,
  generateColorizedMultiColumn
} from './csv-writer.js';

// Valid extraction types
const VALID_TYPES = ['artists', 'albums', 'tracks', 'playlists', 'playlist-tracks', 'detailed'];

// Type-specific help information
const TYPE_HELP = {
  artists: {
    description: 'Extract unique artist names from your library. Uses album artist as fallback when track artist is empty.',
    output: 'Single-column CSV with header "artist"',
    flags: ['--sort', '--out', '--strict'],
    example: 'amlib-export --type artists --sort --out artists.csv'
  },
  albums: {
    description: 'Extract unique album names from your library',
    output: 'Single-column CSV with header "album"',
    flags: ['--sort', '--out'],
    example: 'amlib-export --type albums --sort --out albums.csv'
  },
  tracks: {
    description: 'Extract unique track titles from your library',
    output: 'Single-column CSV with header "track"',
    flags: ['--sort', '--out'],
    example: 'amlib-export --type tracks --out tracks.csv'
  },
  playlists: {
    description: 'Extract playlist names from your library',
    output: 'Single-column CSV with header "playlist"',
    flags: ['--sort', '--out'],
    example: 'amlib-export --type playlists --out playlists.csv'
  },
  'playlist-tracks': {
    description: 'Extract playlists with their track listings',
    output: 'Multi-column CSV with headers: playlist, track, artist',
    flags: ['--sort', '--out'],
    example: 'amlib-export --type playlist-tracks --out playlist-tracks.csv'
  },
  detailed: {
    description: 'Extract full track data with all metadata',
    output: 'Multi-column CSV with headers: title, artist, album_artist, album',
    flags: ['--sort', '--out'],
    example: 'amlib-export --type detailed --out library.csv'
  }
};

/**
 * Parse command line arguments
 * @param {string[]} args - Process argv slice (excluding node and script)
 * @returns {Object} Parsed options
 */
function parseArgs(args) {
  const options = {
    type: 'artists',
    out: null,
    sort: false,
    limit: null,
    noTrim: false,
    strict: false,  // When true, disables album artist fallback
    help: false,
    helpType: null
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    // Check for 'help' subcommand
    if (arg === 'help' && i === 0) {
      options.help = true;
      // Check if there's a type specified after help
      if (args[i + 1] && !args[i + 1].startsWith('-')) {
        options.helpType = args[i + 1];
        i++;
      }
      continue;
    }
    
    switch (arg) {
      case '--type':
      case '-t':
        options.type = args[++i];
        if (!options.type || !VALID_TYPES.includes(options.type)) {
          console.error(`Error: Invalid type "${options.type}". Valid types: ${VALID_TYPES.join(', ')}`);
          process.exit(1);
        }
        break;
      
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
      
      case '--strict':
        options.strict = true;
        break;
      
      case '--help':
      case '-h':
        options.help = true;
        break;
      
      default:
        if (arg.startsWith('-')) {
          console.error(`Error: Unknown option: ${arg}`);
          console.error('Run "amlib-export help" for usage information.');
          process.exit(1);
        }
    }
  }
  
  return options;
}

/**
 * Print general help message
 */
function printHelp() {
  console.log(`
amlib-export - Export data from Apple Music Library to CSV

USAGE:
  amlib-export [--type TYPE] [OPTIONS]
  amlib-export help [TYPE]

TYPES:
  artists          Unique artist names (default)
  albums           Unique album names
  tracks           All track titles
  playlists        Playlist names only
  playlist-tracks  Playlists with their track listings
  detailed         Full track data as multi-column CSV

OPTIONS:
  --type, -t <type>    Extraction type (default: artists)
  --out, -o <path>     Write to file instead of stdout
  --sort, -s           Sort output alphabetically
  --strict             Disable album artist fallback (artists type only)
  --help, -h           Show this help message

ADVANCED OPTIONS:
  --limit, -l <N>      Stop after N items (for debugging)
  --no-trim            Disable whitespace trimming (keeps leading/trailing spaces)

EXAMPLES:
  amlib-export                                    # Output artists to stdout
  amlib-export --type albums --sort               # Output sorted albums to stdout
  amlib-export --type artists > artists.csv       # Pipe to file
  amlib-export --type detailed --out library.csv  # Write directly to file
  amlib-export help playlist-tracks               # Show help for a type

PERMISSIONS:
  On first run, macOS will prompt for Automation permission to control Music.app.
  If denied, go to: System Settings → Privacy & Security → Automation
`);
}

/**
 * Print type-specific help
 * @param {string} type - The type to show help for
 */
function printTypeHelp(type) {
  if (!VALID_TYPES.includes(type)) {
    console.error(`Error: Unknown type "${type}". Valid types: ${VALID_TYPES.join(', ')}`);
    process.exit(1);
  }
  
  const info = TYPE_HELP[type];
  console.log(`
amlib-export --type ${type}

DESCRIPTION:
  ${info.description}

OUTPUT FORMAT:
  ${info.output}

RELEVANT FLAGS:
  ${info.flags.join(', ')}

EXAMPLE:
  ${info.example}
`);
}

/**
 * Main entry point
 */
async function main() {
  const args = process.argv.slice(2);
  
  // Launch TUI if no arguments provided
  if (args.length === 0) {
    const { runTUI } = await import('./tui.js');
    await runTUI();
    return;
  }
  
  const options = parseArgs(args);
  
  // Handle help
  if (options.help) {
    if (options.helpType) {
      printTypeHelp(options.helpType);
    } else {
      printHelp();
    }
    process.exit(0);
  }
  
  // Run system checks before proceeding
  const systemCheck = runAllChecks();
  if (!systemCheck.ok) {
    console.error(systemCheck.message);
    process.exit(1);
  }
  
  // outPath is null when outputting to stdout
  const outPath = options.out ? path.resolve(options.out) : null;
  console.error(`Extracting ${options.type} from Music.app...`);
  console.error('This may take a moment for large libraries...');
  
  try {
    switch (options.type) {
      case 'artists':
        await handleArtists(outPath, options);
        break;
      
      case 'albums':
        await handleAlbums(outPath, options);
        break;
      
      case 'tracks':
        await handleTracks(outPath, options);
        break;
      
      case 'playlists':
        await handlePlaylists(outPath, options);
        break;
      
      case 'playlist-tracks':
        await handlePlaylistTracks(outPath, options);
        break;
      
      case 'detailed':
        await handleDetailed(outPath, options);
        break;
    }
  } catch (err) {
    console.error(`Unexpected error: ${err.message}`);
    process.exit(1);
  }
}

/**
 * Handle artists extraction
 * By default, uses album artist as fallback when track artist is empty.
 * Use --strict to disable this behavior.
 */
async function handleArtists(outPath, options) {
  // Default behavior: use album artist fallback (requires full track data)
  // --strict: only use track artist field (faster, uses simple extraction)
  
  let uniqueArtists;
  
  if (options.strict) {
    // Strict mode: only use track artist field
    const { artists, exitCode, error } = await extractArtists({ limit: options.limit });
    
    if (exitCode !== ExitCodes.SUCCESS) {
      console.error(getErrorMessage(exitCode, error));
      process.exit(exitCode);
    }
    
    const normalizer = createNormalizer({ noTrim: options.noTrim, sort: options.sort });
    for (const artist of artists) {
      normalizer.add(artist);
    }
    
    uniqueArtists = normalizer.getUniqueValues();
  } else {
    // Default: use album artist fallback when track artist is empty
    const { tracks, exitCode, error } = await extractTracks({ limit: options.limit });
    
    if (exitCode !== ExitCodes.SUCCESS) {
      console.error(getErrorMessage(exitCode, error));
      process.exit(exitCode);
    }
    
    uniqueArtists = normalizeArtistsFromTracks(tracks, {
      fallbackAlbumArtist: true,
      noTrim: options.noTrim,
      sort: options.sort
    });
  }
  
  if (outPath) {
    writeSingleColumnCSV(outPath, uniqueArtists, 'artist');
    console.error(`Exported ${uniqueArtists.length} unique artists to ${outPath}`);
  } else {
    writeToStdout(generateColorizedSingleColumn(uniqueArtists, 'artist'));
    console.error(`Exported ${uniqueArtists.length} unique artists`);
  }
  
  process.exit(ExitCodes.SUCCESS);
}

/**
 * Handle albums extraction
 */
async function handleAlbums(outPath, options) {
  const { tracks, exitCode, error } = await extractTracks({ limit: options.limit });
  
  if (exitCode !== ExitCodes.SUCCESS) {
    console.error(getErrorMessage(exitCode, error));
    process.exit(exitCode);
  }
  
  const uniqueAlbums = normalizeAlbums(tracks, {
    noTrim: options.noTrim,
    sort: options.sort
  });
  
  if (outPath) {
    writeSingleColumnCSV(outPath, uniqueAlbums, 'album');
    console.error(`Exported ${uniqueAlbums.length} unique albums to ${outPath}`);
  } else {
    writeToStdout(generateColorizedSingleColumn(uniqueAlbums, 'album'));
    console.error(`Exported ${uniqueAlbums.length} unique albums`);
  }
  process.exit(ExitCodes.SUCCESS);
}

/**
 * Handle tracks extraction
 */
async function handleTracks(outPath, options) {
  const { tracks, exitCode, error } = await extractTracks({ limit: options.limit });
  
  if (exitCode !== ExitCodes.SUCCESS) {
    console.error(getErrorMessage(exitCode, error));
    process.exit(exitCode);
  }
  
  const uniqueTracks = normalizeTracks(tracks, {
    noTrim: options.noTrim,
    sort: options.sort
  });
  
  if (outPath) {
    writeSingleColumnCSV(outPath, uniqueTracks, 'track');
    console.error(`Exported ${uniqueTracks.length} unique tracks to ${outPath}`);
  } else {
    writeToStdout(generateColorizedSingleColumn(uniqueTracks, 'track'));
    console.error(`Exported ${uniqueTracks.length} unique tracks`);
  }
  process.exit(ExitCodes.SUCCESS);
}

/**
 * Handle playlists extraction
 */
async function handlePlaylists(outPath, options) {
  const { playlists, exitCode, error } = await extractPlaylists({ limit: options.limit });
  
  if (exitCode !== ExitCodes.SUCCESS) {
    console.error(getErrorMessage(exitCode, error));
    process.exit(exitCode);
  }
  
  const uniquePlaylists = normalizePlaylists(playlists, {
    noTrim: options.noTrim,
    sort: options.sort
  });
  
  if (outPath) {
    writeSingleColumnCSV(outPath, uniquePlaylists, 'playlist');
    console.error(`Exported ${uniquePlaylists.length} playlists to ${outPath}`);
  } else {
    writeToStdout(generateColorizedSingleColumn(uniquePlaylists, 'playlist'));
    console.error(`Exported ${uniquePlaylists.length} playlists`);
  }
  process.exit(ExitCodes.SUCCESS);
}

/**
 * Handle playlist-tracks extraction
 */
async function handlePlaylistTracks(outPath, options) {
  const { playlistTracks, exitCode, error } = await extractPlaylistTracks({ limit: options.limit });
  
  if (exitCode !== ExitCodes.SUCCESS) {
    console.error(getErrorMessage(exitCode, error));
    process.exit(exitCode);
  }
  
  const prepared = preparePlaylistTracks(playlistTracks, { sort: options.sort });
  const headers = ['playlist', 'artist', 'album', 'track'];
  
  if (outPath) {
    writeMultiColumnCSV(outPath, prepared, headers);
    console.error(`Exported ${prepared.length} playlist tracks to ${outPath}`);
  } else {
    writeToStdout(generateColorizedMultiColumn(prepared, headers));
    console.error(`Exported ${prepared.length} playlist tracks`);
  }
  process.exit(ExitCodes.SUCCESS);
}

/**
 * Handle detailed extraction
 */
async function handleDetailed(outPath, options) {
  const { tracks, exitCode, error } = await extractTracks({ limit: options.limit });
  
  if (exitCode !== ExitCodes.SUCCESS) {
    console.error(getErrorMessage(exitCode, error));
    process.exit(exitCode);
  }
  
  const prepared = prepareDetailedTracks(tracks, { sort: options.sort });
  const headers = ['artist', 'album', 'track'];
  
  if (outPath) {
    writeMultiColumnCSV(outPath, prepared, headers);
    console.error(`Exported ${prepared.length} tracks to ${outPath}`);
  } else {
    writeToStdout(generateColorizedMultiColumn(prepared, headers));
    console.error(`Exported ${prepared.length} tracks`);
  }
  process.exit(ExitCodes.SUCCESS);
}

// Run
main().catch((err) => {
  // User cancelled with Ctrl+C
  if (err.name === 'ExitPromptError' || err.message?.includes('User force closed')) {
    console.error('\nCancelled.');
    process.exit(0);
  }
  
  console.error(`Unexpected error: ${err.message}`);
  process.exit(1);
});
