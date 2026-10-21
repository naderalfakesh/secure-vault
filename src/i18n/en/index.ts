import { common } from './common';
import { format } from './format';

/**
 * The English string table, the source for every other language (handover
 * §7, §10.1, F17). Each namespace lives in its own file; keys are fully
 * qualified, so the spread never hides one namespace's key behind another's
 * (`src/i18n/__tests__/strings.test.ts` checks that).
 */
export const namespaces = { common, format } as const;

export const en = {
  ...common,
  ...format,
} as const;
