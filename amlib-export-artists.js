#!/usr/bin/env node

/**
 * amlib-export - Single-file version
 * Export data from Apple Music Library to CSV
 * 
 * Usage: node amlib-export-artists.js [--type TYPE] [--out PATH] [--sort]
 */

import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import path from 'node:path';

// ============================================================================
// AppleScripts (embedded)
// ============================================================================

const APPLESCRIPTS = {
  artists: `
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
`,

  tracks: `
tell application "Music"
    try
        set trackList to every track of library playlist 1
        set outputList to {}
        repeat with t in trackList
            set trackTitle to name of t
            set trackArtist to artist of t
            set trackAlbumArtist to album artist of t
            set trackAlbum to album of t
            set trackData to trackTitle & "|||" & trackArtist & "|||" & trackAlbumArtist & "|||" & trackAlbum
            set end of outputList to trackData
        end repeat
        set AppleScript's text item delimiters to linefeed
        return outputList as text
    on error errMsg number errNum
        error errMsg number errNum
    end try
end tell
`,

  playlists: `
tell application "Music"
    try
        set playlistList to every user playlist
        set outputList to {}
        repeat with p in playlistList
            set end of outputList to (name of p)
        end repeat
        set AppleScript's text item delimiters to linefeed
        return outputList as text
    on error errMsg number errNum
        error errMsg number errNum
    end try
end tell
`,

  playlistTracks: `
tell application "Music"
    try
        set playlistList to every user playlist
        set outputList to {}
        repeat with p in playlistList
            set playlistName to name of p
            set trackList to every track of p
            repeat with t in trackList
                set trackTitle to name of t
                set trackArtist to artist of t
                set trackData to playlistName & "|||" & trackTitle & "|||" & trackArtist
                set end of outputList to trackData
            end repeat
        end repeat
        set AppleScript's text item delimiters to linefeed
        return outputList as text
    on error errMsg number errNum
        error errMsg number errNum
    end try
end tell
`
};

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
// Valid types and help information
// ============================================================================

const VALID_TYPES = ['artists', 'albums', 'tracks', 'playlists', 'playlist-tracks', 'detailed'];

const TYPE_HELP = {
  artists: {
    description: 'Extract unique artist names from your library',
    output: 'Single-column CSV with header "artist"',
    flags: ['--sort', '--out', '--fallback-album-artist'],
    example: 'node amlib-export-artists.js --type artists --sort --out artists.csv'
  },
  albums: {
    description: 'Extract unique album names from your library',
    output: 'Single-column CSV with header "album"',
    flags: ['--sort', '--out'],
    example: 'node amlib-export-artists.js --type albums --sort --out albums.csv'
  },
  tracks: {
    description: 'Extract unique track titles from your library',
    output: 'Single-column CSV with header "track"',
    flags: ['--sort', '--out'],
    example: 'node amlib-export-artists.js --type tracks --out tracks.csv'
  },
  playlists: {
    description: 'Extract playlist names from your library',
    output: 'Single-column CSV with header "playlist"',
    flags: ['--sort', '--out'],
    example: 'node amlib-export-artists.js --type playlists --out playlists.csv'
  },
  'playlist-tracks': {
    description: 'Extract playlists with their track listings',
    output: 'Multi-column CSV with headers: playlist, track, artist',
    flags: ['--sort', '--out'],
    example: 'node amlib-export-artists.js --type playlist-tracks --out playlist-tracks.csv'
  },
  detailed: {
    description: 'Extract full track data with all metadata',
    output: 'Multi-column CSV with headers: title, artist, album_artist, album',
    flags: ['--sort', '--out'],
    example: 'node amlib-export-artists.js --type detailed --out library.csv'
  }
};

// ============================================================================
// Argument parsing
// ============================================================================

function parseArgs(args) {
  const options = {
    type: 'artists',
    out: null,
    sort: false,
    limit: null,
    noTrim: false,
    fallbackAlbumArtist: false,
    help: false,
    helpType: null
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === 'help' && i === 0) {
      options.help = true;
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
        options.out = args[++i] || 'output.csv';
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
      case '--fallback-album-artist':
        options.fallbackAlbumArtist = true;
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
      default:
        if (arg.startsWith('-')) {
          console.error(`Error: Unknown option: ${arg}`);
          console.error('Run with "help" for usage information.');
          process.exit(1);
        }
    }
  }
  
  if (!options.out) {
    const defaultNames = {
      artists: 'artists.csv',
      albums: 'albums.csv',
      tracks: 'tracks.csv',
      playlists: 'playlists.csv',
      'playlist-tracks': 'playlist-tracks.csv',
      detailed: 'library.csv'
    };
    options.out = defaultNames[options.type];
  }
  
  return options;
}

function printHelp() {
  console.log(`
amlib-export - Export data from Apple Music Library to CSV

USAGE:
  node amlib-export-artists.js [--type TYPE] [OPTIONS]
  node amlib-export-artists.js help [TYPE]

TYPES:
  artists          Unique artist names (default)
  albums           Unique album names
  tracks           All track titles
  playlists        Playlist names only
  playlist-tracks  Playlists with their track listings
  detailed         Full track data as multi-column CSV

OPTIONS:
  --type, -t <type>         Extraction type (default: artists)
  --out, -o <path>          Output CSV file path
  --sort, -s                Sort output alphabetically
  --limit, -l <N>           Stop after N items (for debugging)
  --no-trim                 Disable whitespace trimming
  --fallback-album-artist   Use album artist when artist is empty (artists type only)
  --help, -h                Show this help message

EXAMPLES:
  node amlib-export-artists.js                                    # Export artists
  node amlib-export-artists.js --type albums --sort               # Export sorted albums
  node amlib-export-artists.js --type detailed --out library.csv  # Export full track data
  node amlib-export-artists.js help playlist-tracks               # Show help for type

PERMISSIONS:
  On first run, macOS will prompt for Automation permission to control Music.app.
  If denied, go to: System Settings → Privacy & Security → Automation
`);
}

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

// ============================================================================
// Error detection and messages
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
// AppleScript execution
// ============================================================================

function runAppleScript(script, options = {}) {
  return new Promise((resolve) => {
    const { limit, onLine } = options;
    const lines = [];
    let stderr = '';
    let lineCount = 0;
    let limitReached = false;
    
    const proc = spawn('osascript', ['-e', script]);
    
    const rl = createInterface({ input: proc.stdout, crlfDelay: Infinity });
    
    rl.on('line', (line) => {
      if (limitReached) return;
      lineCount++;
      lines.push(line);
      if (onLine) onLine(line, lineCount);
      if (limit && lineCount >= limit) {
        limitReached = true;
        proc.kill('SIGTERM');
        rl.close();
      }
    });
    
    proc.stderr.on('data', (data) => { stderr += data.toString(); });
    
    proc.on('close', (code) => {
      if (limitReached || code === 0) {
        resolve({ lines, exitCode: ExitCodes.SUCCESS });
      } else {
        resolve({ lines, exitCode: detectErrorType(stderr), error: stderr.trim() });
      }
    });
    
    proc.on('error', (err) => {
      resolve({ lines, exitCode: ExitCodes.APPLESCRIPT_ERROR, error: err.message });
    });
  });
}

// ============================================================================
// Extractors
// ============================================================================

async function extractArtists(options = {}) {
  const result = await runAppleScript(APPLESCRIPTS.artists, options);
  return { artists: result.lines, exitCode: result.exitCode, error: result.error };
}

async function extractTracks(options = {}) {
  const result = await runAppleScript(APPLESCRIPTS.tracks, options);
  if (result.exitCode !== ExitCodes.SUCCESS) {
    return { tracks: [], exitCode: result.exitCode, error: result.error };
  }
  const tracks = result.lines.map(line => {
    const [title, artist, albumArtist, album] = line.split('|||');
    return { title: title || '', artist: artist || '', albumArtist: albumArtist || '', album: album || '' };
  });
  return { tracks, exitCode: ExitCodes.SUCCESS };
}

async function extractPlaylists(options = {}) {
  const result = await runAppleScript(APPLESCRIPTS.playlists, options);
  return { playlists: result.lines, exitCode: result.exitCode, error: result.error };
}

async function extractPlaylistTracks(options = {}) {
  const result = await runAppleScript(APPLESCRIPTS.playlistTracks, options);
  if (result.exitCode !== ExitCodes.SUCCESS) {
    return { playlistTracks: [], exitCode: result.exitCode, error: result.error };
  }
  const playlistTracks = result.lines.map(line => {
    const [playlist, track, artist] = line.split('|||');
    return { playlist: playlist || '', track: track || '', artist: artist || '' };
  });
  return { playlistTracks, exitCode: ExitCodes.SUCCESS };
}

// ============================================================================
// Normalizers
// ============================================================================

function createNormalizer(options = {}) {
  const { noTrim = false, sort = false } = options;
  const seen = new Map();
  
  return {
    add(value) {
      if (!noTrim) value = value.trim();
      if (!value) return false;
      const key = value.toLocaleLowerCase();
      if (!seen.has(key)) {
        seen.set(key, value);
        return true;
      }
      return false;
    },
    getUniqueValues() {
      let values = [...seen.values()];
      if (sort) values.sort((a, b) => a.localeCompare(b));
      return values;
    }
  };
}

function normalizeFromField(items, field, options = {}) {
  const normalizer = createNormalizer(options);
  for (const item of items) {
    if (item[field]) normalizer.add(item[field]);
  }
  return normalizer.getUniqueValues();
}

function normalizeArtistsFromTracks(tracks, options = {}) {
  const { fallbackAlbumArtist = false, noTrim = false, sort = false } = options;
  const normalizer = createNormalizer({ noTrim, sort });
  for (const track of tracks) {
    let artist = track.artist;
    if (fallbackAlbumArtist && (!artist || !artist.trim())) {
      artist = track.albumArtist;
    }
    if (artist) normalizer.add(artist);
  }
  return normalizer.getUniqueValues();
}

function prepareDetailedTracks(tracks, options = {}) {
  const { sort = false } = options;
  let result = tracks.map(t => ({
    title: (t.title || '').trim(),
    artist: (t.artist || '').trim(),
    album_artist: (t.albumArtist || '').trim(),
    album: (t.album || '').trim()
  }));
  if (sort) result.sort((a, b) => a.title.localeCompare(b.title));
  return result;
}

function preparePlaylistTracks(playlistTracks, options = {}) {
  const { sort = false } = options;
  let result = playlistTracks.map(pt => ({
    playlist: (pt.playlist || '').trim(),
    track: (pt.track || '').trim(),
    artist: (pt.artist || '').trim()
  }));
  if (sort) {
    result.sort((a, b) => {
      const cmp = a.playlist.localeCompare(b.playlist);
      return cmp !== 0 ? cmp : a.track.localeCompare(b.track);
    });
  }
  return result;
}

// ============================================================================
// CSV writing
// ============================================================================

function escapeField(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) return '"' + str.replace(/"/g, '""') + '"';
  return str;
}

function writeSingleColumnCSV(filePath, values, header) {
  const content = [header, ...values.map(escapeField)].join('\n') + '\n';
  writeFileSync(filePath, content, { encoding: 'utf8' });
}

function writeMultiColumnCSV(filePath, rows, headers) {
  const headerLine = headers.map(escapeField).join(',');
  const dataLines = rows.map(row => headers.map(h => escapeField(row[h])).join(','));
  const content = [headerLine, ...dataLines].join('\n') + '\n';
  writeFileSync(filePath, content, { encoding: 'utf8' });
}

// ============================================================================
// Handlers for each type
// ============================================================================

async function handleArtists(outPath, options) {
  if (options.fallbackAlbumArtist) {
    const { tracks, exitCode, error } = await extractTracks({ limit: options.limit });
    if (exitCode !== ExitCodes.SUCCESS) {
      console.error(getErrorMessage(exitCode, error));
      process.exit(exitCode);
    }
    const unique = normalizeArtistsFromTracks(tracks, {
      fallbackAlbumArtist: true,
      noTrim: options.noTrim,
      sort: options.sort
    });
    writeSingleColumnCSV(outPath, unique, 'artist');
    console.error(`Exported ${unique.length} unique artists to ${outPath}`);
  } else {
    const { artists, exitCode, error } = await extractArtists({ limit: options.limit });
    if (exitCode !== ExitCodes.SUCCESS) {
      console.error(getErrorMessage(exitCode, error));
      process.exit(exitCode);
    }
    const normalizer = createNormalizer({ noTrim: options.noTrim, sort: options.sort });
    for (const a of artists) normalizer.add(a);
    const unique = normalizer.getUniqueValues();
    writeSingleColumnCSV(outPath, unique, 'artist');
    console.error(`Exported ${unique.length} unique artists to ${outPath}`);
  }
  process.exit(ExitCodes.SUCCESS);
}

async function handleAlbums(outPath, options) {
  const { tracks, exitCode, error } = await extractTracks({ limit: options.limit });
  if (exitCode !== ExitCodes.SUCCESS) {
    console.error(getErrorMessage(exitCode, error));
    process.exit(exitCode);
  }
  const unique = normalizeFromField(tracks, 'album', { noTrim: options.noTrim, sort: options.sort });
  writeSingleColumnCSV(outPath, unique, 'album');
  console.error(`Exported ${unique.length} unique albums to ${outPath}`);
  process.exit(ExitCodes.SUCCESS);
}

async function handleTracks(outPath, options) {
  const { tracks, exitCode, error } = await extractTracks({ limit: options.limit });
  if (exitCode !== ExitCodes.SUCCESS) {
    console.error(getErrorMessage(exitCode, error));
    process.exit(exitCode);
  }
  const unique = normalizeFromField(tracks, 'title', { noTrim: options.noTrim, sort: options.sort });
  writeSingleColumnCSV(outPath, unique, 'track');
  console.error(`Exported ${unique.length} unique tracks to ${outPath}`);
  process.exit(ExitCodes.SUCCESS);
}

async function handlePlaylists(outPath, options) {
  const { playlists, exitCode, error } = await extractPlaylists({ limit: options.limit });
  if (exitCode !== ExitCodes.SUCCESS) {
    console.error(getErrorMessage(exitCode, error));
    process.exit(exitCode);
  }
  const normalizer = createNormalizer({ noTrim: options.noTrim, sort: options.sort });
  for (const p of playlists) normalizer.add(p);
  const unique = normalizer.getUniqueValues();
  writeSingleColumnCSV(outPath, unique, 'playlist');
  console.error(`Exported ${unique.length} playlists to ${outPath}`);
  process.exit(ExitCodes.SUCCESS);
}

async function handlePlaylistTracks(outPath, options) {
  const { playlistTracks, exitCode, error } = await extractPlaylistTracks({ limit: options.limit });
  if (exitCode !== ExitCodes.SUCCESS) {
    console.error(getErrorMessage(exitCode, error));
    process.exit(exitCode);
  }
  const prepared = preparePlaylistTracks(playlistTracks, { sort: options.sort });
  writeMultiColumnCSV(outPath, prepared, ['playlist', 'track', 'artist']);
  console.error(`Exported ${prepared.length} playlist tracks to ${outPath}`);
  process.exit(ExitCodes.SUCCESS);
}

async function handleDetailed(outPath, options) {
  const { tracks, exitCode, error } = await extractTracks({ limit: options.limit });
  if (exitCode !== ExitCodes.SUCCESS) {
    console.error(getErrorMessage(exitCode, error));
    process.exit(exitCode);
  }
  const prepared = prepareDetailedTracks(tracks, { sort: options.sort });
  writeMultiColumnCSV(outPath, prepared, ['title', 'artist', 'album_artist', 'album']);
  console.error(`Exported ${prepared.length} tracks to ${outPath}`);
  process.exit(ExitCodes.SUCCESS);
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const options = parseArgs(process.argv.slice(2));
  
  if (options.help) {
    if (options.helpType) {
      printTypeHelp(options.helpType);
    } else {
      printHelp();
    }
    process.exit(0);
  }
  
  const outPath = path.resolve(options.out);
  console.error(`Extracting ${options.type} from Music.app...`);
  
  switch (options.type) {
    case 'artists': await handleArtists(outPath, options); break;
    case 'albums': await handleAlbums(outPath, options); break;
    case 'tracks': await handleTracks(outPath, options); break;
    case 'playlists': await handlePlaylists(outPath, options); break;
    case 'playlist-tracks': await handlePlaylistTracks(outPath, options); break;
    case 'detailed': await handleDetailed(outPath, options); break;
  }
}

main().catch((err) => {
  console.error(`Unexpected error: ${err.message}`);
  process.exit(1);
});
