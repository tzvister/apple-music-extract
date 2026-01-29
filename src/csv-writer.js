import { writeFileSync } from 'node:fs';
import chalk from 'chalk';

// Consistent color scheme for column types
const COLUMN_COLORS = {
  artist: chalk.magenta,
  album: chalk.yellow,
  track: chalk.green,
  playlist: chalk.cyan,
  title: chalk.green,  // alias for track
  // Separator color
  separator: chalk.dim
};

/**
 * Get color function for a column type
 * @param {string} columnName - The column name
 * @returns {Function} Chalk color function
 */
function getColumnColor(columnName) {
  return COLUMN_COLORS[columnName.toLowerCase()] || chalk.white;
}

/**
 * Escape a single CSV field according to RFC4180
 * - Wrap in quotes if field contains comma, quote, or newline
 * - Escape quotes by doubling them
 * @param {string} value - The field value to escape
 * @returns {string} The escaped field
 */
export function escapeField(value) {
  if (value === null || value === undefined) {
    return '';
  }
  
  const str = String(value);
  
  // Check if escaping is needed
  if (/[",\n\r]/.test(str)) {
    // Double any existing quotes and wrap in quotes
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

/**
 * Capitalize first letter of a string
 * @param {string} str - The string to capitalize
 * @returns {string} Capitalized string
 */
function capitalize(str) {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Format header for display (capitalize, replace underscores with spaces)
 * @param {string} header - Raw header name
 * @returns {string} Formatted header
 */
function formatHeader(header) {
  // Replace underscores with spaces, then capitalize each word
  return header
    .split('_')
    .map(word => capitalize(word))
    .join(' ');
}

/**
 * Generate single-column CSV content from an array of values
 * @param {string[]} values - Array of values
 * @param {string} header - Column header name
 * @returns {string} RFC4180-compliant CSV content with header
 */
export function generateSingleColumnCSV(values, header = 'value') {
  const rows = values.map(escapeField);
  const formattedHeader = formatHeader(header);
  const lines = [formattedHeader, ...rows];
  
  return lines.join('\n') + '\n';
}

/**
 * Generate single-column data only (no header) for stdout
 * @param {string[]} values - Array of values
 * @returns {string} Data lines only, one per line
 */
export function generateSingleColumnData(values) {
  const rows = values.map(escapeField);
  return rows.join('\n') + '\n';
}

/**
 * Generate multi-column CSV content from an array of objects
 * @param {Object[]} rows - Array of row objects
 * @param {string[]} headers - Array of column header names (also used as object keys)
 * @returns {string} RFC4180-compliant CSV content with header
 */
export function generateMultiColumnCSV(rows, headers) {
  const headerLine = headers.map(h => escapeField(formatHeader(h))).join(',');
  
  const dataLines = rows.map(row => {
    return headers.map(header => escapeField(row[header])).join(',');
  });
  
  return [headerLine, ...dataLines].join('\n') + '\n';
}

/**
 * Generate multi-column data only (no header) for stdout
 * @param {Object[]} rows - Array of row objects
 * @param {string[]} headers - Array of column header names (used as object keys)
 * @returns {string} Data lines only
 */
export function generateMultiColumnData(rows, headers) {
  const dataLines = rows.map(row => {
    return headers.map(header => escapeField(row[header])).join(',');
  });
  
  return dataLines.join('\n') + '\n';
}

/**
 * Generate CSV content from artists (backward compatible)
 * @param {string[]} artists - Array of artist names
 * @returns {string} RFC4180-compliant CSV content
 */
export function generateCSV(artists) {
  return generateSingleColumnCSV(artists, 'artist');
}

/**
 * Write single-column values to a CSV file
 * @param {string} filePath - Path to write the CSV file
 * @param {string[]} values - Array of values
 * @param {string} header - Column header name
 * @throws {Error} If file write fails
 */
export function writeSingleColumnCSV(filePath, values, header = 'value') {
  const content = generateSingleColumnCSV(values, header);
  writeFileSync(filePath, content, { encoding: 'utf8' });
}

/**
 * Write multi-column data to a CSV file
 * @param {string} filePath - Path to write the CSV file
 * @param {Object[]} rows - Array of row objects
 * @param {string[]} headers - Array of column header names
 * @throws {Error} If file write fails
 */
export function writeMultiColumnCSV(filePath, rows, headers) {
  const content = generateMultiColumnCSV(rows, headers);
  writeFileSync(filePath, content, { encoding: 'utf8' });
}

/**
 * Write artists to a CSV file (backward compatible)
 * @param {string} filePath - Path to write the CSV file
 * @param {string[]} artists - Array of artist names
 * @throws {Error} If file write fails
 */
export function writeCSV(filePath, artists) {
  writeSingleColumnCSV(filePath, artists, 'artist');
}

/**
 * Write content to stdout
 * @param {string} content - The content to write
 */
export function writeToStdout(content) {
  process.stdout.write(content);
}

/**
 * Generate colorized single-column data for terminal display
 * @param {string[]} values - Array of values
 * @param {string} columnType - The column type (artist, album, track, playlist)
 * @returns {string} Colorized output
 */
export function generateColorizedSingleColumn(values, columnType) {
  const colorFn = getColumnColor(columnType);
  const rows = values.map(v => colorFn(v));
  return rows.join('\n') + '\n';
}

/**
 * Generate colorized multi-column data for terminal display
 * @param {Object[]} rows - Array of row objects
 * @param {string[]} headers - Array of column header names
 * @returns {string} Colorized output
 */
export function generateColorizedMultiColumn(rows, headers) {
  const separator = COLUMN_COLORS.separator(' · ');
  
  const dataLines = rows.map(row => {
    const coloredFields = headers.map(header => {
      const colorFn = getColumnColor(header);
      const value = row[header] || '';
      return colorFn(value);
    });
    return coloredFields.join(separator);
  });
  
  return dataLines.join('\n') + '\n';
}
