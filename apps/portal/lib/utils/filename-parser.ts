/**
 * Filename Parser Utilities
 * Extracts date ranges and normalizes filenames for duplicate detection
 */

export interface ParsedFilename {
  normalized: string;
  dateStart?: Date;
  dateEnd?: Date;
  original: string;
}

/**
 * Extract date range from filename patterns like:
 * - "Transaction List 01 Jul 2025 to 31 Jul 2025.csv"
 * - "Statement_2025-07-01_to_2025-07-31.xlsx"
 * - "Bank Statement July 2025.csv"
 */
export function parseFilename(filename: string): ParsedFilename {
  const result: ParsedFilename = {
    normalized: normalizeFilename(filename),
    original: filename,
  };

  // Try various date range patterns
  const patterns = [
    // "01 Jul 2025 to 31 Jul 2025" or "01 Jul 2025 - 31 Jul 2025"
    /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})\s+(?:to|-)\s+(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})/i,
    // "2025-07-01 to 2025-07-31" or "2025-07-01 - 2025-07-31"
    /(\d{4})-(\d{2})-(\d{2})\s+(?:to|-)\s+(\d{4})-(\d{2})-(\d{2})/,
    // "07/01/2025 to 07/31/2025" or "07/01/2025 - 07/31/2025"
    /(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(?:to|-)\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/,
    // Single month pattern "July 2025" or "Jul 2025"
    /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})/i,
  ];

  for (const pattern of patterns) {
    const match = filename.match(pattern);
    if (match) {
      if (pattern === patterns[0]) {
        // DD MMM YYYY to DD MMM YYYY
        const monthNames: Record<string, number> = {
          jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
          jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
        };
        const startMonth = monthNames[match[2].toLowerCase().substring(0, 3)];
        const endMonth = monthNames[match[5].toLowerCase().substring(0, 3)];
        result.dateStart = new Date(parseInt(match[3]), startMonth, parseInt(match[1]));
        result.dateEnd = new Date(parseInt(match[6]), endMonth, parseInt(match[4]));
        break;
      } else if (pattern === patterns[1]) {
        // YYYY-MM-DD to YYYY-MM-DD
        result.dateStart = new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
        result.dateEnd = new Date(parseInt(match[4]), parseInt(match[5]) - 1, parseInt(match[6]));
        break;
      } else if (pattern === patterns[2]) {
        // MM/DD/YYYY to MM/DD/YYYY
        result.dateStart = new Date(parseInt(match[3]), parseInt(match[1]) - 1, parseInt(match[2]));
        result.dateEnd = new Date(parseInt(match[6]), parseInt(match[4]) - 1, parseInt(match[5]));
        break;
      } else if (pattern === patterns[3]) {
        // Single month - use first and last day of month
        const monthNames: Record<string, number> = {
          jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
          jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
        };
        const month = monthNames[match[1].toLowerCase().substring(0, 3)];
        const year = parseInt(match[2]);
        result.dateStart = new Date(year, month, 1);
        result.dateEnd = new Date(year, month + 1, 0); // Last day of month
        break;
      }
    }
  }

  return result;
}

/**
 * Normalize filename for pattern matching
 * Removes extra spaces, converts to lowercase, removes file extension
 */
export function normalizeFilename(filename: string): string {
  return filename
    .toLowerCase()
    .replace(/\.[^/.]+$/, '') // Remove extension
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Check if two date ranges overlap
 */
export function dateRangesOverlap(
  start1: Date | undefined,
  end1: Date | undefined,
  start2: Date | undefined,
  end2: Date | undefined
): boolean {
  if (!start1 || !end1 || !start2 || !end2) {
    return false;
  }
  return start1 <= end2 && start2 <= end1;
}

