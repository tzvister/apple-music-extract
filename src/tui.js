#!/usr/bin/env node

import { select, confirm, input, checkbox } from '@inquirer/prompts';
import chalk from 'chalk';
import ora from 'ora';
import path from 'node:path';
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
  generateMultiColumnData
} from './csv-writer.js';

// Type definitions
const TYPES = {
  artists: {
    name: 'Artists',
    description: 'Unique artist names from your library',
    header: 'artist',
    multiColumn: false
  },
  albums: {
    name: 'Albums',
    description: 'Unique album names',
    header: 'album',
    multiColumn: false
  },
  tracks: {
    name: 'Tracks',
    description: 'All track titles',
    header: 'track',
    multiColumn: false
  },
  playlists: {
    name: 'Playlists',
    description: 'Playlist names only',
    header: 'playlist',
    multiColumn: false
  },
  'playlist-tracks': {
    name: 'Playlist Tracks',
    description: 'Playlists with their track listings',
    headers: ['playlist', 'track', 'artist'],
    multiColumn: true
  },
  detailed: {
    name: 'Detailed',
    description: 'Full track metadata (title, artist, album artist, album)',
    headers: ['title', 'artist', 'album_artist', 'album'],
    multiColumn: true
  }
};

/**
 * Print the app header
 */
function printHeader() {
  console.clear();
  console.log('');
  console.log(chalk.bold.cyan('  🎵 Apple Music Library Export'));
  console.log(chalk.dim('  ─────────────────────────────────'));
  console.log('');
}

/**
 * Main TUI flow
 */
async function main() {
  printHeader();

  // Step 1: Select extraction type
  const type = await select({
    message: 'What would you like to export?',
    choices: [
      ...Object.entries(TYPES).map(([value, info]) => ({
        name: `${info.name} - ${chalk.dim(info.description)}`,
        value
      })),
      { name: chalk.dim('Exit'), value: 'exit' }
    ]
  });

  if (type === 'exit') {
    console.log(chalk.dim('\n  Goodbye!\n'));
    process.exit(0);
  }

  // Step 2: Type-specific options
  const options = { sort: false, strict: false, selectedPlaylists: null };

  if (type === 'artists') {
    options.strict = !(await confirm({
      message: 'Use album artist as fallback when track artist is empty?',
      default: true
    }));
  }

  // For playlist-tracks, let user select which playlists to export
  if (type === 'playlist-tracks') {
    console.log('');
    const playlistSpinner = ora({
      text: 'Loading playlists...',
      color: 'cyan'
    }).start();

    try {
      const { playlists, exitCode, error } = await extractPlaylists({});
      if (exitCode !== ExitCodes.SUCCESS) {
        playlistSpinner.fail(chalk.red('Failed to load playlists'));
        throw new Error(getErrorMessage(exitCode, error));
      }

      const uniquePlaylists = normalizePlaylists(playlists, { sort: true });
      playlistSpinner.succeed(chalk.green(`Found ${uniquePlaylists.length} playlists`));
      console.log('');

      const selectedPlaylists = await checkbox({
        message: 'Select playlists to export:',
        choices: [
          { name: chalk.italic('All playlists'), value: '__ALL__' },
          ...uniquePlaylists.map(p => ({ name: p, value: p }))
        ],
        pageSize: 15
      });

      if (selectedPlaylists.length === 0) {
        console.log(chalk.yellow('\nNo playlists selected. Exiting.'));
        process.exit(0);
      }

      // If "All playlists" is selected, don't filter
      if (!selectedPlaylists.includes('__ALL__')) {
        options.selectedPlaylists = selectedPlaylists;
      }
    } catch (err) {
      if (err.message.includes('load playlists')) {
        throw err;
      }
      playlistSpinner.fail(chalk.red(`Error: ${err.message}`));
      throw err;
    }
  }

  options.sort = await confirm({
    message: 'Sort results alphabetically?',
    default: true
  });

  // Step 3: Output destination
  const outputChoice = await select({
    message: 'Output to:',
    choices: [
      { name: 'Terminal (stdout)', value: 'stdout' },
      { name: 'CSV file', value: 'file' }
    ]
  });

  let outPath = null;
  if (outputChoice === 'file') {
    const defaultName = `${type}.csv`;
    const filename = await input({
      message: 'Filename:',
      default: defaultName
    });
    outPath = path.resolve(filename);
  }

  // Step 4: Execute extraction
  console.log('');
  const spinner = ora({
    text: `Extracting ${TYPES[type].name.toLowerCase()}...`,
    color: 'cyan'
  }).start();

  try {
    const result = await runExtraction(type, options);
    spinner.succeed(chalk.green(`Found ${result.count} ${TYPES[type].name.toLowerCase()}`));

    // Step 5: Write output
    if (outPath) {
      writeOutput(type, result.data, outPath, options);
      console.log(chalk.dim(`\n  Written to ${outPath}`));
    } else {
      console.log(chalk.dim('\n  ─────────────────────────────────\n'));
      writeOutput(type, result.data, null, options);
    }

    console.log('');
  } catch (err) {
    spinner.fail(chalk.red(`Error: ${err.message}`));
    process.exit(1);
  }
}

/**
 * Run the extraction based on type
 */
async function runExtraction(type, options) {
  switch (type) {
    case 'artists':
      return extractArtistsData(options);
    case 'albums':
      return extractAlbumsData(options);
    case 'tracks':
      return extractTracksData(options);
    case 'playlists':
      return extractPlaylistsData(options);
    case 'playlist-tracks':
      return extractPlaylistTracksData(options);
    case 'detailed':
      return extractDetailedData(options);
    default:
      throw new Error(`Unknown type: ${type}`);
  }
}

/**
 * Extract artists
 */
async function extractArtistsData(options) {
  if (options.strict) {
    const { artists, exitCode, error } = await extractArtists({});
    if (exitCode !== ExitCodes.SUCCESS) {
      throw new Error(getErrorMessage(exitCode, error));
    }
    const normalizer = createNormalizer({ sort: options.sort });
    for (const artist of artists) {
      normalizer.add(artist);
    }
    const data = normalizer.getUniqueValues();
    return { data, count: data.length };
  } else {
    const { tracks, exitCode, error } = await extractTracks({});
    if (exitCode !== ExitCodes.SUCCESS) {
      throw new Error(getErrorMessage(exitCode, error));
    }
    const data = normalizeArtistsFromTracks(tracks, {
      fallbackAlbumArtist: true,
      sort: options.sort
    });
    return { data, count: data.length };
  }
}

/**
 * Extract albums
 */
async function extractAlbumsData(options) {
  const { tracks, exitCode, error } = await extractTracks({});
  if (exitCode !== ExitCodes.SUCCESS) {
    throw new Error(getErrorMessage(exitCode, error));
  }
  const data = normalizeAlbums(tracks, { sort: options.sort });
  return { data, count: data.length };
}

/**
 * Extract tracks
 */
async function extractTracksData(options) {
  const { tracks, exitCode, error } = await extractTracks({});
  if (exitCode !== ExitCodes.SUCCESS) {
    throw new Error(getErrorMessage(exitCode, error));
  }
  const data = normalizeTracks(tracks, { sort: options.sort });
  return { data, count: data.length };
}

/**
 * Extract playlists
 */
async function extractPlaylistsData(options) {
  const { playlists, exitCode, error } = await extractPlaylists({});
  if (exitCode !== ExitCodes.SUCCESS) {
    throw new Error(getErrorMessage(exitCode, error));
  }
  const data = normalizePlaylists(playlists, { sort: options.sort });
  return { data, count: data.length };
}

/**
 * Extract playlist tracks
 */
async function extractPlaylistTracksData(options) {
  const { playlistTracks, exitCode, error } = await extractPlaylistTracks({});
  if (exitCode !== ExitCodes.SUCCESS) {
    throw new Error(getErrorMessage(exitCode, error));
  }
  
  // Filter by selected playlists if specified
  let filteredTracks = playlistTracks;
  if (options.selectedPlaylists) {
    const selectedSet = new Set(options.selectedPlaylists.map(p => p.toLowerCase()));
    filteredTracks = playlistTracks.filter(t => 
      selectedSet.has(t.playlist.toLowerCase())
    );
  }
  
  const data = preparePlaylistTracks(filteredTracks, { sort: options.sort });
  return { data, count: data.length };
}

/**
 * Extract detailed track data
 */
async function extractDetailedData(options) {
  const { tracks, exitCode, error } = await extractTracks({});
  if (exitCode !== ExitCodes.SUCCESS) {
    throw new Error(getErrorMessage(exitCode, error));
  }
  const data = prepareDetailedTracks(tracks, { sort: options.sort });
  return { data, count: data.length };
}

/**
 * Write output to file or stdout
 */
function writeOutput(type, data, outPath, options) {
  const typeInfo = TYPES[type];

  if (typeInfo.multiColumn) {
    const headers = typeInfo.headers;
    if (outPath) {
      writeMultiColumnCSV(outPath, data, headers);
    } else {
      writeToStdout(generateMultiColumnData(data, headers));
    }
  } else {
    const header = typeInfo.header;
    if (outPath) {
      writeSingleColumnCSV(outPath, data, header);
    } else {
      writeToStdout(generateSingleColumnData(data));
    }
  }
}

/**
 * Export for use by index.js
 */
export { main as runTUI };

// Run directly if called as script
const isDirectRun = process.argv[1]?.endsWith('tui.js');
if (isDirectRun) {
  main().catch((err) => {
    console.error(chalk.red(`\nError: ${err.message}`));
    process.exit(1);
  });
}
