import { writeFileSync } from 'node:fs';

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
 * Generate single-column CSV content from an array of values
 * @param {string[]} values - Array of values
 * @param {string} header - Column header name
 * @returns {string} RFC4180-compliant CSV content
 */
export function generateSingleColumnCSV(values, header = 'value') {
  const rows = values.map(escapeField);
  const lines = [header, ...rows];
  
  return lines.join('\n') + '\n';
}

/**
 * Generate multi-column CSV content from an array of objects
 * @param {Object[]} rows - Array of row objects
 * @param {string[]} headers - Array of column header names (also used as object keys)
 * @returns {string} RFC4180-compliant CSV content
 */
export function generateMultiColumnCSV(rows, headers) {
  const headerLine = headers.map(escapeField).join(',');
  
  const dataLines = rows.map(row => {
    return headers.map(header => escapeField(row[header])).join(',');
  });
  
  return [headerLine, ...dataLines].join('\n') + '\n';
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
