import { maxResultRows } from '../env-config.js';

export function toolSuccess<T extends Record<string, unknown>>(
  value: T,
): {
  content: Array<{ type: 'text'; text: string }>;
  structuredContent: T;
} {
  const compact = compactStructured(value);
  return {
    content: [{ type: 'text', text: JSON.stringify(compact, null, 2) }],
    structuredContent: compact,
  };
}

export function toolError(message: string): {
  content: Array<{ type: 'text'; text: string }>;
  isError: true;
} {
  return {
    content: [{ type: 'text', text: message }],
    isError: true,
  };
}

function compactStructured<T extends Record<string, unknown>>(value: T): T {
  const maxRows = maxResultRows();
  if (!Array.isArray(value.rows)) {
    return value;
  }
  if (value.rows.length <= maxRows) {
    return value;
  }
  return {
    ...value,
    rows: value.rows.slice(0, maxRows),
    truncated: true,
    truncated_to: maxRows,
  } as T;
}
