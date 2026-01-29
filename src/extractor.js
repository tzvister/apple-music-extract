import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = path.join(__dirname, '../scripts/extract-artists.applescript');

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
 * Extract artists from Music.app library
 * @param {Object} options - Extraction options
 * @param {number} [options.limit] - Maximum number of lines to process
 * @param {function} [options.onArtist] - Callback for each artist line
 * @returns {Promise<{artists: string[], exitCode: number, error?: string}>}
 */
export function extractArtists(options = {}) {
  return new Promise((resolve) => {
    const { limit, onArtist } = options;
    const artists = [];
    let stderr = '';
    let lineCount = 0;
    let limitReached = false;
    
    const proc = spawn('osascript', [SCRIPT_PATH], {
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    // Create readline interface for line-by-line processing
    const rl = createInterface({
      input: proc.stdout,
      crlfDelay: Infinity
    });
    
    rl.on('line', (line) => {
      if (limitReached) return;
      
      lineCount++;
      artists.push(line);
      
      if (onArtist) {
        onArtist(line, lineCount);
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
      // If we killed it due to limit, that's success
      if (limitReached) {
        resolve({ artists, exitCode: ExitCodes.SUCCESS });
        return;
      }
      
      // osascript returns 0 on success
      if (code === 0) {
        resolve({ artists, exitCode: ExitCodes.SUCCESS });
        return;
      }
      
      // Determine error type from stderr
      const exitCode = detectErrorType(stderr);
      resolve({ artists, exitCode, error: stderr.trim() });
    });
    
    proc.on('error', (err) => {
      // spawn error (e.g., osascript not found - unlikely on macOS)
      resolve({
        artists,
        exitCode: ExitCodes.APPLESCRIPT_ERROR,
        error: err.message
      });
    });
  });
}
