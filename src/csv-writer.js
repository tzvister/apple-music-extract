import { writeFileSync } from 'node:fs';

/**
 * Escape a single CSV field according to RFC4180
 * - Wrap in quotes if field contains comma, quote, or newline
 * - Escape quotes by doubling them
 * @param {string} value - The field value to escape
 * @returns {string} The escaped field
 */
export function escapeField(value) {
  // Check if escaping is needed
  if (/[",\n\r]/.test(value)) {
    // Double any existing quotes and wrap in quotes
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

/**
 * Generate CSV content from an array of artists
 * @param {string[]} artists - Array of artist names
 * @returns {string} RFC4180-compliant CSV content
 */
export function generateCSV(artists) {
  const header = 'artist';
  const rows = artists.map(escapeField);
  const lines = [header, ...rows];
  
  // Join with newlines and add trailing newline
  return lines.join('\n') + '\n';
}

/**
 * Write artists to a CSV file
 * @param {string} filePath - Path to write the CSV file
 * @param {string[]} artists - Array of artist names
 * @throws {Error} If file write fails
 */
export function writeCSV(filePath, artists) {
  const content = generateCSV(artists);
  
  // Write as UTF-8
  writeFileSync(filePath, content, { encoding: 'utf8' });
}
