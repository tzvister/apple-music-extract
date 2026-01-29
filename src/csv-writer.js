import { writeFileSync } from 'node:fs';
import chalk from 'chalk';

// Consistent color scheme for column types (softer palette)
const COLUMN_COLORS = {
  artist: chalk.hex('#C9A0DC'),   // soft lavender
  album: chalk.hex('#F0C674'),    // soft gold
  track: chalk.hex('#8ABEB7'),    // soft teal
  playlist: chalk.hex('#81A2BE'), // soft blue
  title: chalk.hex('#8ABEB7'),    // alias for track
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
 * Handles compound formats like "Artist - Album" and "Artist - Track"
 * @param {string[]} values - Array of values
 * @param {string} columnType - The column type (artist, album, track, playlist)
 * @returns {string} Colorized output
 */
export function generateColorizedSingleColumn(values, columnType) {
  const separator = COLUMN_COLORS.separator(' · ');
  
  // For album and track types, values are "Artist - Album" or "Artist - Track"
  // Parse and colorize each part separately
  if (columnType === 'album' || columnType === 'track') {
    const rows = values.map(v => {
      const dashIndex = v.indexOf(' - ');
      if (dashIndex > -1) {
        const artist = v.substring(0, dashIndex);
        const second = v.substring(dashIndex + 3); // Skip " - "
        const artistColored = COLUMN_COLORS.artist(artist);
        const secondColored = columnType === 'album' 
          ? COLUMN_COLORS.album(second)
          : COLUMN_COLORS.track(second);
        return artistColored + separator + secondColored;
      }
      // No dash, just colorize as the column type
      return getColumnColor(columnType)(v);
    });
    return rows.join('\n') + '\n';
  }
  
  // Simple single-value columns (artist, playlist)
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
