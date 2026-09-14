import { isJsonArray, type JsonObject, type JsonValue } from "@lomi./shared";
import { maxResultRows } from "../env-config.js";

type ToolTextContent = { type: "text"; text: string };

type ToolSuccessResult<T extends JsonObject> = {
  content: ToolTextContent[];
  structuredContent: T;
};

type ToolErrorResult = {
  content: ToolTextContent[];
  isError: true;
};

type StructuredRows = JsonObject & {
  rows: JsonValue[];
  truncated?: boolean;
  truncated_to?: number;
};

export function toolSuccess<T extends JsonObject>(
  value: T,
): ToolSuccessResult<T> {
  const compact = compactStructured(value);
  return {
    content: [{ type: "text", text: JSON.stringify(compact, null, 2) }],
    structuredContent: compact,
  };
}

export function toolError(message: string): ToolErrorResult {
  return {
    content: [{ type: "text", text: message }],
    isError: true,
  };
}

function compactStructured<T extends JsonObject>(value: T): T {
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

function hasRows(value: JsonObject): value is StructuredRows {
  return isJsonArray(value.rows);
}
