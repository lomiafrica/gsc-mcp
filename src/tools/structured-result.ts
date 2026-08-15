import { maxResultRows } from '../env-config.js';

interface StructuredObject {}

interface ToolSuccessResult<T extends StructuredObject> {
  content: Array<{ type: 'text'; text: string }>;
  structuredContent: T;
}

interface ToolErrorResult {
  content: Array<{ type: 'text'; text: string }>;
  isError: true;
}

export function toolSuccess<T extends StructuredObject>(
  value: T,
): ToolSuccessResult<T> {
  const compact = compactStructured(value);
  return {
    content: [{ type: 'text', text: JSON.stringify(compact, null, 2) }],
    structuredContent: compact,
  };
}

export function toolError(message: string): ToolErrorResult {
  return {
    content: [{ type: 'text', text: message }],
    isError: true,
  };
}

function compactStructured<T extends StructuredObject>(value: T): T {
  const maxRows = maxResultRows();
  if (!hasRows(value)) {
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
  };
}

function hasRows(
  value: StructuredObject,
): value is StructuredObject & { rows: StructuredObject[] } {
  return 'rows' in value && Array.isArray(value.rows);
}
