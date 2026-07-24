import { describe, expect, it } from 'vitest';

import { buildCapabilityState } from '../auth/capabilities.js';
import type { CredentialContext } from '../auth/credential-provider.js';
import { mutationToolsEnabled } from '../auth/credential-provider.js';
import { GSC_READONLY_SCOPE } from '../auth/constants.js';
import { assertInspectionUrlUnderSite, inclusiveDateRange } from '../google/schemas.js';
import { toolSuccess } from '../tools/structured-result.js';

describe('schemas', () => {
  it('accepts inspection URLs under domain properties', () => {
    expect(() =>
      assertInspectionUrlUnderSite(
        'sc-domain:lomi.africa',
        'https://docs.lomi.africa/guide',
      ),
    ).not.toThrow();
  });

  it('rejects inspection URLs outside the property', () => {
    expect(() =>
      assertInspectionUrlUnderSite(
        'sc-domain:lomi.africa',
        'https://example.com/',
      ),
    ).toThrow();
  });

  it('builds inclusive date ranges', () => {
    const range = inclusiveDateRange(28);
    expect(range.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(range.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('capabilities', () => {
  const readonlyContext: CredentialContext = {
    mode: 'oauth',
    scopes: [GSC_READONLY_SCOPE],
    canWrite: false,
    getAccessToken: async () => 'token',
  };

  it('disables mutation tools without write scope', () => {
    expect(mutationToolsEnabled(readonlyContext)).toBe(false);
    const state = buildCapabilityState(readonlyContext);
    expect(state.mutation_tools_enabled).toBe(false);
    expect(state.search_analytics.disclosure).toContain('top rows');
  });
});

describe('structured results', () => {
  it('truncates oversized row arrays', () => {
    process.env.GSC_MCP_MAX_RESULT_ROWS = '2';
    const result = toolSuccess({
      rows: [{ a: 1 }, { a: 2 }, { a: 3 }],
    });
    expect('truncated' in result.structuredContent && result.structuredContent.truncated).toBe(true);
    expect(result.structuredContent.rows).toHaveLength(2);
    delete process.env.GSC_MCP_MAX_RESULT_ROWS;
  });
});
