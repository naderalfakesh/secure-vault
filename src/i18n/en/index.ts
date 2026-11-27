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
