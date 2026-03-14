// ─── utils/csvParser.js — CSV Parsing Wrapper ────────────────────
// Wraps papaparse for robust CSV import with quoted-field handling.
// Returns { data, headers, error } where data is an array of objects
// keyed by CSV column headers.

import Papa from "papaparse";

/**
 * Parse a CSV File object into structured data.
 * @param {File} file — a File from <input type="file">
 * @returns {Promise<{ data: Object[], headers: string[], error: string|null }>}
 */
export function parseCSVFile(file) {
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      complete(results) {
        if (results.errors.length > 0) {
          const msg = results.errors.map((e) => e.message).join("; ");
          resolve({ data: [], headers: [], error: `CSV parse error: ${msg}` });
          return;
        }
        const headers = results.meta.fields || [];
        resolve({ data: results.data, headers, error: null });
      },
      error(err) {
        resolve({ data: [], headers: [], error: `CSV read error: ${err.message}` });
      },
    });
  });
}
