import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Script paths
const SCRIPTS = {
  artists: path.join(__dirname, '../scripts/extract-artists.applescript'),
  tracks: path.join(__dirname, '../scripts/extract-tracks.applescript'),
  playlists: path.join(__dirname, '../scripts/extract-playlists.applescript'),
  playlistTracks: path.join(__dirname, '../scripts/extract-playlist-tracks.applescript')
};

/**
 * Error codes for extraction failures
 */
export const ExitCodes = {
  SUCCESS: 0,
  MUSIC_UNAVAILABLE: 2,
  PERMISSION_DENIED: 3,
  APPLESCRIPT_ERROR: 4,
  FILE_WRITE_ERROR: 5
};

/**
 * Detect the type of error from osascript stderr output
 * @param {string} stderr - The stderr output from osascript
 * @returns {number} The appropriate exit code
 */
function detectErrorType(stderr) {
  const lowerStderr = stderr.toLowerCase();
  
  // Permission/authorization errors
  if (
    lowerStderr.includes('not authorized') ||
    lowerStderr.includes('assistive access') ||
    lowerStderr.includes('user canceled') ||
    lowerStderr.includes('erraeventnotpermitted') ||
    lowerStderr.includes('-1743') // AppleEvent permission denied
  ) {
    return ExitCodes.PERMISSION_DENIED;
  }
  
  // Music.app not available
  if (
    lowerStderr.includes('application isn\'t running') ||
    lowerStderr.includes('application "music" can\'t be found') ||
    lowerStderr.includes('connection is invalid') ||
    lowerStderr.includes('couldn\'t launch')
  ) {
    return ExitCodes.MUSIC_UNAVAILABLE;
  }
  
  return ExitCodes.APPLESCRIPT_ERROR;
}

/**
 * Get a user-friendly error message based on exit code
 * @param {number} exitCode - The exit code
 * @param {string} stderr - The original stderr message
 * @returns {string} User-friendly error message
 */
export function getErrorMessage(exitCode, stderr = '') {
  switch (exitCode) {
    case ExitCodes.MUSIC_UNAVAILABLE:
      return 'Error: Music.app is not available or cannot be launched.\n\nMake sure Music.app is installed and try running it manually first.';
    
    case ExitCodes.PERMISSION_DENIED:
      return `Error: Automation permission denied.

To fix this:
1. Open System Settings → Privacy & Security → Automation
2. Find "Terminal" (or your terminal app) in the list
3. Enable the toggle for "Music"
4. Re-run this command

If you don't see Terminal listed, run the command once to trigger the prompt.`;
    
    case ExitCodes.APPLESCRIPT_ERROR:
      return `Error: Unexpected extraction error.\n\nDetails: ${stderr}`;
    
    case ExitCodes.FILE_WRITE_ERROR:
      return `Error: Failed to write CSV file.\n\nDetails: ${stderr}`;
    
    default:
      return `Error: Unknown error (code ${exitCode}).\n\nDetails: ${stderr}`;
  }
}

/**
 * Run an AppleScript and collect output lines
 * @param {string} scriptPath - Path to the AppleScript file
 * @param {Object} options - Options
 * @returns {Promise<{lines: string[], exitCode: number, error?: string}>}
 */
function runAppleScript(scriptPath, options = {}) {
  return new Promise((resolve) => {
    const { limit, onLine } = options;
    const lines = [];
    let stderr = '';
    let lineCount = 0;
    let limitReached = false;
    
    const proc = spawn('osascript', [scriptPath], {
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    const rl = createInterface({
      input: proc.stdout,
      crlfDelay: Infinity
    });
    
    rl.on('line', (line) => {
      if (limitReached) return;
      
      lineCount++;
      lines.push(line);
      
      if (onLine) {
        onLine(line, lineCount);
      }
      
      if (limit && lineCount >= limit) {
        limitReached = true;
        proc.kill('SIGTERM');
        rl.close();
      }
    });
    
    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    proc.on('close', (code) => {
      if (limitReached) {
        resolve({ lines, exitCode: ExitCodes.SUCCESS });
        return;
      }
      
      if (code === 0) {
        resolve({ lines, exitCode: ExitCodes.SUCCESS });
        return;
      }
      
      const exitCode = detectErrorType(stderr);
      resolve({ lines, exitCode, error: stderr.trim() });
    });
    
    proc.on('error', (err) => {
      resolve({
        lines,
        exitCode: ExitCodes.APPLESCRIPT_ERROR,
        error: err.message
      });
    });
  });
}

/**
 * Extract artists from Music.app library (original behavior)
 * @param {Object} options - Extraction options
 * @returns {Promise<{artists: string[], exitCode: number, error?: string}>}
 */
export async function extractArtists(options = {}) {
  const result = await runAppleScript(SCRIPTS.artists, options);
  return { artists: result.lines, exitCode: result.exitCode, error: result.error };
}

/**
 * Extract full track data from Music.app library
 * @param {Object} options - Extraction options
 * @returns {Promise<{tracks: Object[], exitCode: number, error?: string}>}
 */
export async function extractTracks(options = {}) {
  const result = await runAppleScript(SCRIPTS.tracks, options);
  
  if (result.exitCode !== ExitCodes.SUCCESS) {
    return { tracks: [], exitCode: result.exitCode, error: result.error };
  }
  
  // Parse the delimited format: title|||artist|||album_artist|||album
  const tracks = result.lines.map(line => {
    const [title, artist, albumArtist, album] = line.split('|||');
    return {
      title: title || '',
      artist: artist || '',
      albumArtist: albumArtist || '',
      album: album || ''
    };
  });
  
  return { tracks, exitCode: ExitCodes.SUCCESS };
}

/**
 * Extract playlist names from Music.app
 * @param {Object} options - Extraction options
 * @returns {Promise<{playlists: string[], exitCode: number, error?: string}>}
 */
export async function extractPlaylists(options = {}) {
  const result = await runAppleScript(SCRIPTS.playlists, options);
  return { playlists: result.lines, exitCode: result.exitCode, error: result.error };
}

/**
 * Extract playlists with their tracks from Music.app
 * @param {Object} options - Extraction options
 * @returns {Promise<{playlistTracks: Object[], exitCode: number, error?: string}>}
 */
export async function extractPlaylistTracks(options = {}) {
  const result = await runAppleScript(SCRIPTS.playlistTracks, options);
  
  if (result.exitCode !== ExitCodes.SUCCESS) {
    return { playlistTracks: [], exitCode: result.exitCode, error: result.error };
  }
  
  // Parse the delimited format: playlist|||track|||artist
  const playlistTracks = result.lines.map(line => {
    const [playlist, track, artist] = line.split('|||');
    return {
      playlist: playlist || '',
      track: track || '',
      artist: artist || ''
    };
  });
  
  return { playlistTracks, exitCode: ExitCodes.SUCCESS };
}
