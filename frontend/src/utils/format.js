/**
 * Display helpers.
 *
 * Rule: a value that is genuinely absent renders as "Not available" (or a short
 * dash in dense table cells). Nothing is defaulted to 0, "-1" or an em dash that
 * could be mistaken for a real measurement.
 */

export const NOT_AVAILABLE = 'Not available';

export function isMissing(value) {
  return value === null || value === undefined || value === '';
}

/** Plain number with Indian digit grouping. */
export function num(value, { fallback = NOT_AVAILABLE, digits = 0 } = {}) {
  if (isMissing(value) || Number.isNaN(Number(value))) return fallback;
  return Number(value).toLocaleString('en-IN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** Rupees in crore, switching to lakh crore above 1,00,000 Cr. */
export function crore(value, { fallback = NOT_AVAILABLE, compact = false } = {}) {
  if (isMissing(value) || Number.isNaN(Number(value))) return fallback;
  const v = Number(value);
  if (compact && Math.abs(v) >= 100000) {
    return `Rs ${(v / 100000).toFixed(2)} Lakh Cr`;
  }
  return `Rs ${v.toLocaleString('en-IN', { maximumFractionDigits: 0 })} Cr`;
}

export function pct(value, { fallback = NOT_AVAILABLE, digits = 1, sign = false } = {}) {
  if (isMissing(value) || Number.isNaN(Number(value))) return fallback;
  const v = Number(value);
  const prefix = sign && v > 0 ? '+' : '';
  return `${prefix}${v.toFixed(digits)}%`;
}

export function months(value, { fallback = NOT_AVAILABLE } = {}) {
  if (isMissing(value) || Number.isNaN(Number(value))) return fallback;
  return `${Number(value)} mo`;
}

/** Compact dash for dense table cells where a full sentence would not fit. */
export function cell(value, formatter = num) {
  if (isMissing(value)) return '--';
  return formatter(value);
}

/** Render a metric from the evaluation API, which returns null when unmeasurable. */
export function metric(value, { digits = 3 } = {}) {
  if (isMissing(value) || Number.isNaN(Number(value))) return NOT_AVAILABLE;
  return Number(value).toFixed(digits);
}

export function shortenMinistry(name) {
  if (!name) return NOT_AVAILABLE;
  return name.replace('Ministry of ', '').replace('Department of ', '');
}
