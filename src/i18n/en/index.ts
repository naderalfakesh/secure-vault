import { backup } from './backup';
import { changePin } from './changePin';
import { common } from './common';
import { errors } from './errors';
import { format } from './format';
import { library } from './library';
import { lock } from './lock';
import { nav } from './nav';
import { onboarding } from './onboarding';
import { scan } from './scan';
import { session } from './session';
import { settings } from './settings';
import { share } from './share';
import { ui } from './ui';
import { unavailable } from './unavailable';
import { viewer } from './viewer';

/**
 * The English string table, the source for every other language (handover
 * §7, §10.1, F17). Each namespace lives in its own file; keys are fully
 * qualified, so the spread never hides one namespace's key behind another's
 * (`src/i18n/__tests__/i18n.test.ts` checks that).
 */
export const namespaces = {
  common,
  format,
  ui,
  nav,
  lock,
  onboarding,
  unavailable,
  session,
  errors,
  changePin,
  library,
  viewer,
  scan,
  share,
  settings,
  backup,
} as const;

export const en = {
  ...common,
  ...format,
  ...ui,
  ...nav,
  ...lock,
  ...onboarding,
  ...unavailable,
  ...session,
  ...errors,
  ...changePin,
  ...library,
  ...viewer,
  ...scan,
  ...share,
  ...settings,
  ...backup,
} as const;
