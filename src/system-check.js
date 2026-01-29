import { platform } from 'node:os';
import { execSync } from 'node:child_process';

/**
 * Check if running on macOS
 * @returns {{ ok: boolean, message?: string }}
 */
export function checkMacOS() {
  if (platform() !== 'darwin') {
    return {
      ok: false,
      message: `This tool only works on macOS.

You are running: ${platform()}

Apple Music Library export requires macOS and the Music.app.`
    };
  }
  return { ok: true };
}

/**
 * Check Node.js version
 * @returns {{ ok: boolean, message?: string }}
 */
export function checkNodeVersion() {
  const version = process.versions.node;
  const major = parseInt(version.split('.')[0], 10);
  
  if (major < 18) {
    return {
      ok: false,
      message: `Node.js 18 or later is required.

You are running: Node.js ${version}

Please upgrade Node.js: https://nodejs.org/`
    };
  }
  return { ok: true };
}

/**
 * Check if osascript is available
 * @returns {{ ok: boolean, message?: string }}
 */
export function checkOsascript() {
  try {
    execSync('which osascript', { stdio: 'ignore' });
    return { ok: true };
  } catch {
    return {
      ok: false,
      message: `osascript command not found.

This tool requires macOS with AppleScript support.
osascript should be available at /usr/bin/osascript on any macOS system.`
    };
  }
}

/**
 * Check if Music.app exists
 * @returns {{ ok: boolean, message?: string }}
 */
export function checkMusicApp() {
  try {
    execSync('test -d "/System/Applications/Music.app" || test -d "/Applications/Music.app"', { stdio: 'ignore' });
    return { ok: true };
  } catch {
    return {
      ok: false,
      message: `Music.app not found.

This tool requires the Apple Music app to be installed.
Music.app should be in /System/Applications/ or /Applications/.`
    };
  }
}

/**
 * Run all system checks
 * @returns {{ ok: boolean, message?: string }}
 */
export function runAllChecks() {
  const checks = [
    checkMacOS,
    checkNodeVersion,
    checkOsascript,
    checkMusicApp
  ];
  
  for (const check of checks) {
    const result = check();
    if (!result.ok) {
      return result;
    }
  }
  
  return { ok: true };
}
